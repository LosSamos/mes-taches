/* Mes tâches · coffre chiffré
 *
 * Les données sont chiffrées en AES-256-GCM avec une clé de données aléatoire.
 * Cette clé est elle-même enveloppée deux fois :
 *   - par une clé dérivée du mot de passe (PBKDF2-SHA-256, 600 000 itérations) ;
 *   - par une clé dérivée de la clé de récupération.
 * Changer de mot de passe ne réécrit donc que l'enveloppe, jamais les données ni les copies.
 *
 * Fichier (texte JSON) :
 *   { format, version, id, maj, kdf:{algo, iterations}, cle_mdp:{sel,iv,cle}, cle_recup:{sel,iv,cle},
 *     compression, iv, donnees }
 */
(() => {
  'use strict';

  const FORMAT = 'mes-taches-coffre';
  const ITERATIONS = 600000;
  const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789'; // sans I, L, O, U : pas de confusion

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const subtle = crypto.subtle;

  class ErreurCoffre extends Error {}

  function b64(octets) {
    const u = octets instanceof Uint8Array ? octets : new Uint8Array(octets);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function deb64(s) {
    const bin = atob(s);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  const aleatoire = (n) => crypto.getRandomValues(new Uint8Array(n));

  async function deriver(secret, sel, iterations) {
    const base = await subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations },
      base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
  }

  async function envelopper(cleDonnees, secret, iterations) {
    const sel = aleatoire(16), iv = aleatoire(12);
    const kek = await deriver(secret, sel, iterations);
    const cle = await subtle.wrapKey('raw', cleDonnees, kek, { name: 'AES-GCM', iv });
    return { sel: b64(sel), iv: b64(iv), cle: b64(cle) };
  }

  async function desenvelopper(env, secret, iterations, extractible = false) {
    const kek = await deriver(secret, deb64(env.sel), iterations);
    try {
      return await subtle.unwrapKey('raw', deb64(env.cle), kek, { name: 'AES-GCM', iv: deb64(env.iv) },
        { name: 'AES-GCM', length: 256 }, extractible, ['encrypt', 'decrypt']);
    } catch {
      return null;
    }
  }

  /* ---------- Clé de récupération : 32 caractères, groupés par 4 ---------- */

  function nouvelleCleRecuperation() {
    const o = aleatoire(20); // 160 bits
    let bits = 0, val = 0, s = '';
    for (const b of o) {
      val = (val << 8) | b; bits += 8;
      while (bits >= 5) { s += ALPHABET[(val >>> (bits - 5)) & 31]; bits -= 5; }
    }
    return s.match(/.{4}/g).join('-');
  }

  function normaliserCle(saisie) {
    return String(saisie).toUpperCase().replace(/[^A-Z0-9]/g, '')
      .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  }

  /* ---------- Compression (si le navigateur la permet) ---------- */

  const peutCompresser = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  async function flux(octets, transformation) {
    const r = new Blob([octets]).stream().pipeThrough(transformation);
    return new Uint8Array(await new Response(r).arrayBuffer());
  }

  /* ---------- API ---------- */

  function verifierMotDePasse(mdp) {
    if (typeof mdp !== 'string' || [...mdp].length < 12) {
      throw new ErreurCoffre('Le mot de passe doit compter au moins 12 caractères. Une phrase de passe est idéale.');
    }
  }

  /** Crée un coffre neuf. Retourne { enveloppe, cle, cleRecuperation }. */
  async function creer(mdp) {
    verifierMotDePasse(mdp);
    const cleExtractible = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const cleRecuperation = nouvelleCleRecuperation();
    const enveloppe = {
      format: FORMAT,
      version: 1,
      id: b64(aleatoire(12)).replace(/[+/=]/g, ''),
      maj: Date.now(),
      kdf: { algo: 'PBKDF2-SHA-256', iterations: ITERATIONS },
      cle_mdp: await envelopper(cleExtractible, mdp, ITERATIONS),
      cle_recup: await envelopper(cleExtractible, normaliserCle(cleRecuperation), ITERATIONS),
    };
    // En mémoire, on ne garde qu'une version non exportable de la clé.
    const cle = await subtle.importKey('raw', await subtle.exportKey('raw', cleExtractible), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    return { enveloppe, cle, cleRecuperation };
  }

  function lire(texte) {
    let f;
    try { f = typeof texte === 'string' ? JSON.parse(texte) : texte; } catch { f = null; }
    if (!f || f.format !== FORMAT || !f.cle_mdp || !f.cle_recup) {
      throw new ErreurCoffre("Ce fichier n'est pas un coffre « Mes tâches ».");
    }
    if (f.version > 1) throw new ErreurCoffre("Ce coffre vient d'une version plus récente de l'app. Recharge l'app pour la mettre à jour.");
    return f;
  }

  /** Ouvre la clé avec le mot de passe. Retourne la clé, ou null si le mot de passe est faux. */
  async function ouvrir(fichier, mdp, extractible = false) {
    const f = lire(fichier);
    return desenvelopper(f.cle_mdp, mdp, f.kdf.iterations, extractible);
  }

  async function ouvrirAvecRecuperation(fichier, cleRecuperation, extractible = false) {
    const f = lire(fichier);
    return desenvelopper(f.cle_recup, normaliserCle(cleRecuperation), f.kdf.iterations, extractible);
  }

  /** Nouvelle enveloppe « mot de passe » (la clé de données ne change pas). */
  async function changerMotDePasse(fichier, ancienOuCle, nouveau, { avecRecuperation = false } = {}) {
    verifierMotDePasse(nouveau);
    const f = lire(fichier);
    const cle = avecRecuperation
      ? await desenvelopper(f.cle_recup, normaliserCle(ancienOuCle), f.kdf.iterations, true)
      : await desenvelopper(f.cle_mdp, ancienOuCle, f.kdf.iterations, true);
    if (!cle) throw new ErreurCoffre(avecRecuperation ? 'Clé de récupération incorrecte.' : 'Le mot de passe actuel est incorrect.');
    const cleMdp = await envelopper(cle, nouveau, f.kdf.iterations);
    return { ...f, cle_mdp: cleMdp, maj: Date.now() };
  }

  /** Nouvelle clé de récupération (l'ancienne cesse de fonctionner). */
  async function nouvelleRecuperation(fichier, mdp) {
    const f = lire(fichier);
    const cle = await desenvelopper(f.cle_mdp, mdp, f.kdf.iterations, true);
    if (!cle) throw new ErreurCoffre('Le mot de passe est incorrect.');
    const cleRecuperation = nouvelleCleRecuperation();
    const cleRecup = await envelopper(cle, normaliserCle(cleRecuperation), f.kdf.iterations);
    return { enveloppe: { ...f, cle_recup: cleRecup, maj: Date.now() }, cleRecuperation };
  }

  /** Chiffre un objet avec la clé de données, dans l'enveloppe donnée. Retourne le texte du fichier. */
  async function chiffrer(enveloppe, cle, objet) {
    let octets = enc.encode(JSON.stringify(objet));
    let compression = null;
    if (peutCompresser) { octets = await flux(octets, new CompressionStream('gzip')); compression = 'gzip'; }
    const iv = aleatoire(12);
    const donnees = await subtle.encrypt({ name: 'AES-GCM', iv }, cle, octets);
    const { iv: _a, donnees: _b, compression: _c, ...entete } = enveloppe;
    return JSON.stringify({ ...entete, compression, iv: b64(iv), donnees: b64(donnees) });
  }

  async function dechiffrer(fichier, cle) {
    const f = lire(fichier);
    if (!f.donnees) return null;
    let octets;
    try {
      octets = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: deb64(f.iv) }, cle, deb64(f.donnees)));
    } catch {
      throw new ErreurCoffre('Déchiffrement impossible : ce fichier appartient à un autre coffre ou il est abîmé.');
    }
    if (f.compression === 'gzip') {
      if (!peutCompresser) throw new ErreurCoffre('Ce navigateur ne sait pas lire ce fichier compressé. Mets-le à jour.');
      octets = await flux(octets, new DecompressionStream('gzip'));
    }
    return JSON.parse(dec.decode(octets));
  }

  /** Enveloppe seule (sans les données), à garder en mémoire. */
  function enveloppeDe(fichier) {
    const { iv: _a, donnees: _b, compression: _c, ...entete } = lire(fichier);
    return entete;
  }

  window.Coffre = {
    ErreurCoffre, creer, lire, ouvrir, ouvrirAvecRecuperation, changerMotDePasse, nouvelleRecuperation,
    chiffrer, dechiffrer, enveloppeDe, normaliserCle, verifierMotDePasse, ITERATIONS,
  };
})();
