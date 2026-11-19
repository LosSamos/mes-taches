/* Mes tâches · stockage sur l'appareil (IndexedDB) et synchronisation Google Drive
 *
 * - Le coffre chiffré est toujours gardé sur l'appareil : l'app fonctionne hors ligne.
 * - Avec Google Drive, le même coffre est envoyé dans un dossier « Mes tâches » que l'app crée.
 *   Elle utilise l'accès « drive.file » : elle ne voit que ses propres fichiers.
 * - Avant chaque envoi, si le fichier du Drive a changé (autre appareil), les deux versions sont fusionnées.
 * - Une copie par jour est gardée dans le dossier (les 60 plus récentes).
 */
(() => {
  'use strict';

  const CFG = window.MES_TACHES_CONFIG || {};
  const API = String(CFG.driveApi || 'https://www.googleapis.com').replace(/\/$/, '');
  const PORTEE = 'https://www.googleapis.com/auth/drive.file';
  // Google Agenda, en lecture seule : la liste des agendas et leurs événements.
  const PORTEES_AGENDA = [
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly',
  ];
  const NOM_DOSSIER = 'Mes tâches';
  const NOM_FICHIER = 'mes-taches.coffre';
  const COPIES_GARDEES = 60;

  /* =========================================================
   * IndexedDB : petites clés / valeurs
   * ======================================================= */

  let dbPromesse = null;
  function db() {
    if (!dbPromesse) {
      dbPromesse = new Promise((ok, ko) => {
        const r = indexedDB.open('mes-taches', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ko(r.error);
      });
    }
    return dbPromesse;
  }
  async function kv(mode, f) {
    const base = await db();
    return new Promise((ok, ko) => {
      const tx = base.transaction('kv', mode);
      const r = f(tx.objectStore('kv'));
      tx.oncomplete = () => ok(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => ko(tx.error);
      tx.onabort = () => ko(tx.error);
    });
  }
  const lire = (k) => kv('readonly', (s) => s.get(k));
  const ecrire = (k, v) => kv('readwrite', (s) => s.put(v, k));
  const effacer = (k) => kv('readwrite', (s) => s.delete(k));
  const toutEffacer = () => kv('readwrite', (s) => s.clear());

  /* =========================================================
   * État
   * ======================================================= */

  const E = {
    enveloppe: null,   // en-tête du coffre (clés enveloppées), sans les données
    cle: null,         // clé de données (non exportable)
    drive: { actif: false, compte: null, dossier_id: null, fichier_id: null, version: null, derniere_copie: null, dernier_envoi: null },
    jeton: null,       // { access_token, expire, portees }
    agenda: false,     // afficher Google Agenda sur cet appareil
    generation: 0,     // augmente à chaque modification locale
    generationEnvoyee: 0,
    statut: 'local',
    message: '',
  };
  const ecouteurs = { statut: new Set(), distant: new Set() };

  function definirStatut(statut, message = '') {
    E.statut = statut; E.message = message;
    for (const f of ecouteurs.statut) { try { f(etat()); } catch (e) { console.error(e); } }
  }

  function etat() {
    return {
      statut: E.statut, message: E.message, driveActif: E.drive.actif, compte: E.drive.compte,
      dernierEnvoi: E.drive.dernier_envoi, enAttente: E.generation !== E.generationEnvoyee,
      googleConfigure: googleConfigure(), deverrouille: Boolean(E.cle),
    };
  }

  const sauverDrive = () => ecrire('drive', { ...E.drive });

  class ErreurSync extends Error {
    constructor(message, code) { super(message); this.code = code; }
  }

  /* =========================================================
   * Google : connexion (Google Identity Services, jeton d'accès)
   * ======================================================= */

  function googleConfigure() {
    return Boolean(CFG.googleClientId) && !String(CFG.googleClientId).includes('A_REMPLIR');
  }

  function attendreGIS() {
    if (!window.google?.accounts?.oauth2 && !document.getElementById('script-gis')) {
      const s = document.createElement('script');
      s.id = 'script-gis';
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      document.head.append(s);
    }
    return new Promise((ok, ko) => {
      const debut = Date.now();
      (function verifier() {
        if (window.google?.accounts?.oauth2) return ok(window.google.accounts.oauth2);
        if (Date.now() - debut > 15000) return ko(new ErreurSync('Le service de connexion Google ne répond pas. Vérifie ta connexion Internet.'));
        setTimeout(verifier, 150);
      })();
    });
  }

  let clientJeton = null;
  let attenteJeton = null;

  /** Demande un jeton d'accès. À appeler depuis un clic (sinon le navigateur bloque la fenêtre Google).
   *  Le même jeton sert à Drive et, si elle est activée, à Google Agenda : un seul clic renouvelle les deux. */
  async function connecterGoogle({ agenda = E.agenda } = {}) {
    if (!googleConfigure()) throw new ErreurSync("La connexion Google n'est pas encore configurée (config.js).");
    const oauth2 = await attendreGIS();
    if (!clientJeton) {
      clientJeton = oauth2.initTokenClient({
        client_id: CFG.googleClientId,
        scope: PORTEE,
        callback: (r) => {
          const a = attenteJeton; attenteJeton = null;
          if (!a) return;
          if (r.error) a.ko(new ErreurSync(r.error === 'access_denied' ? "L'accès à Google Drive a été refusé." : `Connexion Google : ${r.error}`));
          else if (oauth2.hasGrantedAllScopes && !oauth2.hasGrantedAllScopes(r, PORTEE)) a.ko(new ErreurSync("Coche l'accès à Google Drive dans la fenêtre Google : sans lui, rien ne peut être enregistré."));
          else a.ok(r);
        },
        error_callback: (err) => {
          const a = attenteJeton; attenteJeton = null;
          if (a) a.ko(new ErreurSync(err?.type === 'popup_closed' ? 'La fenêtre Google a été fermée.' : 'La fenêtre Google n’a pas pu s’ouvrir (bloqueur de fenêtres ?).'));
        },
      });
    }
    const reponse = await new Promise((ok, ko) => {
      attenteJeton = { ok, ko };
      const options = { prompt: '', scope: [PORTEE, ...(agenda ? PORTEES_AGENDA : [])].join(' '), include_granted_scopes: true };
      if (E.drive.compte) options.login_hint = E.drive.compte;
      clientJeton.requestAccessToken(options);
    });
    E.jeton = {
      access_token: reponse.access_token,
      expire: Date.now() + (Number(reponse.expires_in || 3600) - 120) * 1000,
      portees: String(reponse.scope || PORTEE),
    };
    await ecrire('jeton', E.jeton);
    try {
      const a = await requete('GET', '/drive/v3/about', { query: { fields: 'user(emailAddress)' } });
      if (a.user?.emailAddress) E.drive.compte = a.user.emailAddress;
    } catch { /* l'adresse n'est qu'informative */ }
    return E.jeton;
  }

  const jetonValide = () => Boolean(E.jeton && E.jeton.expire > Date.now());
  const agendaAutorise = () => jetonValide() && PORTEES_AGENDA.every((p) => String(E.jeton.portees || '').split(/\s+/).includes(p));

  async function reglerAgenda(actif) {
    E.agenda = Boolean(actif);
    await ecrire('agenda', E.agenda);
  }

  /* =========================================================
   * Google Drive : requêtes REST
   * ======================================================= */

  async function requete(methode, chemin, { query, corps, type, texte = false, octets = false } = {}) {
    if (!jetonValide()) throw new ErreurSync('Reconnexion à Google nécessaire.', 'jeton');
    let url = API + chemin;
    if (query) url += '?' + new URLSearchParams(query);
    const entetes = { Authorization: `Bearer ${E.jeton.access_token}` };
    let body;
    if (corps !== undefined) {
      if (corps instanceof Blob) { body = corps; entetes['Content-Type'] = type || corps.type || 'application/octet-stream'; }
      else if (typeof corps === 'string') { body = corps; entetes['Content-Type'] = type || 'application/json'; }
      else { body = JSON.stringify(corps); entetes['Content-Type'] = 'application/json'; }
    }
    let rep;
    try {
      rep = await fetch(url, { method: methode, headers: entetes, body });
    } catch {
      throw new ErreurSync('Google Drive est injoignable (hors ligne ?).', 'reseau');
    }
    if (rep.status === 401) { E.jeton = null; await effacer('jeton'); throw new ErreurSync('Reconnexion à Google nécessaire.', 'jeton'); }
    if (rep.status === 404) throw new ErreurSync('Fichier introuvable dans Google Drive.', 'introuvable');
    if (!rep.ok) {
      let detail = '', raisons = '';
      try {
        const e = (await rep.json()).error || {};
        detail = e.message || '';
        raisons = [e.status, ...(e.errors || []).map((x) => x.reason), ...(e.details || []).map((x) => x.reason)].filter(Boolean).join(' ');
      } catch { /* rien */ }
      const err = new ErreurSync(`Google Drive a refusé la demande (${rep.status}${detail ? ' : ' + detail : ''}).`, rep.status >= 500 || rep.status === 429 ? 'reseau' : 'drive');
      err.statut = rep.status;
      err.detail = detail;
      err.raisons = raisons;
      throw err;
    }
    if (rep.status === 204) return null;
    if (octets) return new Uint8Array(await rep.arrayBuffer());
    return texte ? rep.text() : rep.json();
  }

  const echapperQ = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  async function chercher(role) {
    const r = await requete('GET', '/drive/v3/files', {
      query: {
        q: `appProperties has { key='role' and value='${echapperQ(role)}' } and trashed=false`,
        fields: 'files(id,name,version,createdTime,size,parents)', orderBy: 'createdTime desc', pageSize: '200', spaces: 'drive',
      },
    });
    return r.files || [];
  }

  async function assurerDossier() {
    if (E.drive.dossier_id) return E.drive.dossier_id;
    const existants = await chercher('dossier');
    if (existants.length) {
      E.drive.dossier_id = existants[0].id;
    } else {
      const d = await requete('POST', '/drive/v3/files', {
        query: { fields: 'id' },
        corps: { name: NOM_DOSSIER, mimeType: 'application/vnd.google-apps.folder', appProperties: { role: 'dossier', app: 'mes-taches' } },
      });
      E.drive.dossier_id = d.id;
    }
    await sauverDrive();
    return E.drive.dossier_id;
  }

  function multipart(meta, contenu) {
    const frontiere = 'mt' + Math.random().toString(36).slice(2);
    const corps = `--${frontiere}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`
      + `--${frontiere}\r\nContent-Type: application/json\r\n\r\n${contenu}\r\n--${frontiere}--`;
    return { corps, type: `multipart/related; boundary=${frontiere}` };
  }

  async function creerFichierPrincipal(texte) {
    const dossier = await assurerDossier();
    const { corps, type } = multipart({
      name: NOM_FICHIER, parents: [dossier], mimeType: 'application/json',
      appProperties: { role: 'principal', app: 'mes-taches' },
    }, texte);
    const f = await requete('POST', '/upload/drive/v3/files', { query: { uploadType: 'multipart', fields: 'id,version' }, corps, type });
    E.drive.fichier_id = f.id; E.drive.version = String(f.version);
    await sauverDrive();
    return f;
  }

  const telecharger = (id) => requete('GET', `/drive/v3/files/${encodeURIComponent(id)}`, { query: { alt: 'media' }, texte: true });
  const metaFichier = (id) => requete('GET', `/drive/v3/files/${encodeURIComponent(id)}`, { query: { fields: 'id,version,trashed' } });
  const envoyerFichier = (id, texte) => requete('PATCH', `/upload/drive/v3/files/${encodeURIComponent(id)}`, {
    query: { uploadType: 'media', fields: 'id,version' }, corps: texte, type: 'application/json',
  });

  /* =========================================================
   * Coffre sur l'appareil
   * ======================================================= */

  async function chargerEtat() {
    const d = await lire('drive');
    if (d) Object.assign(E.drive, d);
    E.jeton = (await lire('jeton')) || null;
    E.agenda = Boolean(await lire('agenda'));
    const c = await lire('coffre');
    if (c) { E.generation = c.en_attente ? 1 : 0; E.generationEnvoyee = 0; }
    definirStatut(E.drive.actif ? (jetonValide() ? 'ok' : 'reconnexion') : 'local');
    return { coffreLocal: Boolean(c), drive: { ...E.drive } };
  }

  async function texteLocal() {
    const c = await lire('coffre');
    return c ? c.texte : null;
  }

  async function memoriserCle() {
    const minutes = Number(Noyau.reglages().veille_minutes) || 0;
    await ecrire('cle', { cle: E.cle, expire: minutes > 0 ? Date.now() + minutes * 60000 : null });
  }

  /** Prolonge la session mémorisée (appelée lors de l'activité). */
  let dernierProlongement = 0;
  async function prolonger() {
    if (!E.cle || Date.now() - dernierProlongement < 30000) return;
    dernierProlongement = Date.now();
    await memoriserCle();
  }

  async function ouvrirAvecCle(texte, cle) {
    const modele = await Coffre.dechiffrer(texte, cle);
    Noyau.charger(modele);
    E.cle = cle;
    E.enveloppe = Coffre.enveloppeDe(texte);
  }

  /** Reprend la session si la mise en veille n'est pas dépassée. */
  async function reprendre() {
    const m = await lire('cle');
    const texte = await texteLocal();
    if (!m || !m.cle || !texte || (m.expire && m.expire < Date.now())) { if (m) await effacer('cle'); return false; }
    try { await ouvrirAvecCle(texte, m.cle); } catch { await effacer('cle'); return false; }
    await memoriserCle();
    return true;
  }

  async function deverrouiller(mdp) {
    const texte = await texteLocal();
    if (!texte) throw new ErreurSync('Aucun coffre sur cet appareil.');
    const cle = await Coffre.ouvrir(texte, mdp);
    if (!cle) return false;
    await ouvrirAvecCle(texte, cle);
    await memoriserCle();
    return true;
  }

  /** Clé de récupération + nouveau mot de passe. */
  async function recuperer(cleRecuperation, nouveau) {
    const texte = await texteLocal();
    if (!texte) throw new ErreurSync('Aucun coffre sur cet appareil.');
    const enveloppe = await Coffre.changerMotDePasse(texte, cleRecuperation, nouveau, { avecRecuperation: true });
    const cle = await Coffre.ouvrir(enveloppe, nouveau);
    await ouvrirAvecCle(texte, cle);
    E.enveloppe = Coffre.enveloppeDe(enveloppe);
    await memoriserCle();
    marquerChangement();
    await enregistrerMaintenant();
    return true;
  }

  async function creer(mdp) {
    const { enveloppe, cle, cleRecuperation } = await Coffre.creer(mdp);
    E.enveloppe = enveloppe; E.cle = cle;
    Noyau.vider();
    await memoriserCle();
    marquerChangement();
    await enregistrerMaintenant();
    return cleRecuperation;
  }

  async function changerMotDePasse(actuel, nouveau) {
    const texte = await Coffre.chiffrer(E.enveloppe, E.cle, Noyau.modele);
    const env = await Coffre.changerMotDePasse(texte, actuel, nouveau);
    E.enveloppe = Coffre.enveloppeDe(env);
    marquerChangement();
    await enregistrerMaintenant();
  }

  async function nouvelleCleRecuperation(mdp) {
    const texte = await Coffre.chiffrer(E.enveloppe, E.cle, Noyau.modele);
    const { enveloppe, cleRecuperation } = await Coffre.nouvelleRecuperation(texte, mdp);
    E.enveloppe = Coffre.enveloppeDe(enveloppe);
    marquerChangement();
    await enregistrerMaintenant();
    return cleRecuperation;
  }

  async function verrouiller() {
    await vider();
    E.cle = null; E.enveloppe = null;
    Noyau.vider();
    await effacer('cle');
  }

  /* =========================================================
   * Enregistrement et synchronisation
   * ======================================================= */

  let minuterieDrive = null;
  let fileLocale = Promise.resolve();
  let sauvegardeDemandee = false;

  /** Enregistre sur l'appareil, tout de suite et dans l'ordre (plusieurs demandes rapprochées n'en font qu'une). */
  function sauvegarderLocal() {
    if (sauvegardeDemandee) return fileLocale;
    sauvegardeDemandee = true;
    fileLocale = fileLocale.then(async () => {
      sauvegardeDemandee = false;
      await enregistrerLocal();
    }).catch((e) => console.error('Enregistrement sur l’appareil :', e));
    return fileLocale;
  }

  function marquerChangement() {
    E.generation++;
    sauvegarderLocal();
    clearTimeout(minuterieDrive);
    minuterieDrive = setTimeout(() => synchroniser().catch(() => {}), 1500);
    if (E.drive.actif && E.statut === 'ok') definirStatut('attente');
  }

  async function enregistrerLocal() {
    if (!E.cle) return;
    const generation = E.generation;
    const texte = await Coffre.chiffrer(E.enveloppe, E.cle, Noyau.modele);
    await ecrire('coffre', { texte, en_attente: generation !== E.generationEnvoyee, enregistre_le: Date.now() });
  }

  /** Enregistre tout de suite, sur l'appareil puis dans Drive (si possible). */
  async function enregistrerMaintenant() {
    await sauvegarderLocal();
    clearTimeout(minuterieDrive);
    try { await synchroniser(); } catch { /* le statut dit déjà ce qui se passe */ }
  }

  /** Avant de fermer ou de verrouiller : attendre que l'appareil soit à jour. */
  async function vider() {
    await fileLocale;
  }

  /**
   * Trouve le fichier principal du Drive : celui qu'on connaît, sinon le plus récent
   * (s'il a été remplacé depuis un autre appareil). Retourne { version } ou null s'il n'y en a aucun.
   */
  async function resoudreFichier() {
    if (E.drive.fichier_id) {
      try {
        const m = await metaFichier(E.drive.fichier_id);
        if (!m.trashed) return m;
      } catch (e) { if (e.code !== 'introuvable') throw e; }
    }
    const autres = await chercher('principal');
    if (!autres.length) { E.drive.fichier_id = null; E.drive.version = null; return null; }
    if (autres[0].id !== E.drive.fichier_id) {
      E.drive.fichier_id = autres[0].id;
      E.drive.version = null;
      if (autres[0].parents?.[0]) E.drive.dossier_id = autres[0].parents[0];
    }
    return { id: autres[0].id, version: autres[0].version };
  }

  let enCours = null, relancer = false;

  async function synchroniser() {
    if (!E.cle) return;
    if (!E.drive.actif) { definirStatut('local'); return; }
    if (!jetonValide()) { definirStatut('reconnexion'); return; }
    if (enCours) { relancer = true; return enCours; }
    enCours = (async () => {
      definirStatut('synchro');
      try {
        let distantSignature = null;
        let distantChange = false;
        let enveloppeChangee = false;
        const meta = await resoudreFichier();
        if (meta) {
          if (String(meta.version) !== String(E.drive.version)) {
            const texteDistant = await telecharger(E.drive.fichier_id);
            const entete = Coffre.lire(texteDistant);
            if (entete.id !== E.enveloppe.id) throw new ErreurSync('Le coffre du Drive ne correspond pas à celui de cet appareil.', 'conflit');
            const distant = await Coffre.dechiffrer(texteDistant, E.cle);
            // Mot de passe ou clé de récupération changés sur un autre appareil : on adopte la nouvelle serrure.
            if ((entete.maj || 0) > (E.enveloppe.maj || 0)) { E.enveloppe = Coffre.enveloppeDe(texteDistant); enveloppeChangee = true; }
            // Fusion sans attente : aucune modification locale ne peut se glisser entre lecture et écriture.
            const avant = Noyau.signature(Noyau.modele);
            const fusion = Noyau.fusionner(Noyau.modele, Noyau.normaliser(distant));
            Noyau.charger(fusion);
            distantSignature = Noyau.signature(Noyau.normaliser(distant));
            distantChange = Noyau.signature(fusion) !== avant;
            E.drive.version = String(meta.version);
          }
        }
        const generation = E.generation;
        const doitEnvoyer = !E.drive.fichier_id || E.generation !== E.generationEnvoyee
          || (distantSignature !== null && distantSignature !== Noyau.signature(Noyau.modele));
        if (doitEnvoyer) {
          const texte = await Coffre.chiffrer(E.enveloppe, E.cle, Noyau.modele);
          let r;
          if (!E.drive.fichier_id) r = await creerFichierPrincipal(texte);
          else r = await envoyerFichier(E.drive.fichier_id, texte);
          E.drive.version = String(r.version);
          E.generationEnvoyee = generation;
          await ecrire('coffre', { texte, en_attente: generation !== E.generation, enregistre_le: Date.now() });
        } else if (distantChange || enveloppeChangee) {
          await sauvegarderLocal();
        }
        E.drive.dernier_envoi = Date.now();
        await sauverDrive();
        definirStatut(E.generation !== E.generationEnvoyee ? 'attente' : 'ok');
        if (distantChange) for (const f of ecouteurs.distant) { try { f(); } catch (e) { console.error(e); } }
        copieQuotidienne().catch((e) => console.warn('Copie quotidienne :', e.message));
        envoyerImages().then(() => nettoyerImages()).catch((e) => console.warn('Images :', e.message));
      } catch (e) {
        if (e.code === 'jeton') definirStatut('reconnexion');
        else if (e.code === 'reseau') definirStatut('hors-ligne', e.message);
        else definirStatut('erreur', e.message);
        throw e;
      } finally {
        enCours = null;
      }
    })();
    try { await enCours; } finally {
      if (relancer) { relancer = false; setTimeout(() => synchroniser().catch(() => {}), 50); }
    }
  }

  /* =========================================================
   * Copies dans le Drive
   * ======================================================= */

  const pad = (n) => String(n).padStart(2, '0');
  const jour = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  async function copierPrincipal(nom) {
    const dossier = await assurerDossier();
    return requete('POST', `/drive/v3/files/${encodeURIComponent(E.drive.fichier_id)}/copy`, {
      query: { fields: 'id,name,createdTime' },
      corps: { name: nom, parents: [dossier], appProperties: { role: 'copie', app: 'mes-taches' } },
    });
  }

  async function elaguer() {
    const copies = await chercher('copie');
    for (const c of copies.slice(COPIES_GARDEES)) {
      await requete('PATCH', `/drive/v3/files/${encodeURIComponent(c.id)}`, { corps: { trashed: true } });
    }
  }

  let copieEnCours = false;
  async function copieQuotidienne() {
    if (copieEnCours || !E.drive.actif || !E.drive.fichier_id || E.drive.derniere_copie === jour() || !jetonValide()) return;
    copieEnCours = true; // deux synchronisations rapprochées ne font qu'une copie
    try {
      const nom = `copie-${jour()}.coffre`;
      // Un autre appareil a peut-être déjà fait la copie du jour.
      if (!(await chercher('copie')).some((c) => c.name === nom)) await copierPrincipal(nom);
      E.drive.derniere_copie = jour();
      await sauverDrive();
      await elaguer();
    } finally {
      copieEnCours = false;
    }
  }

  /** Copie immédiate, avant une opération risquée (import, restauration). */
  async function copieAvant(raison) {
    if (!E.drive.actif || !jetonValide()) return false;
    await synchroniser();
    if (!E.drive.fichier_id) return false;
    const d = new Date();
    await copierPrincipal(`copie-${jour()}-${pad(d.getHours())}h${pad(d.getMinutes())}-avant-${raison}.coffre`);
    await elaguer();
    return true;
  }

  async function listerCopies() {
    if (!E.drive.actif) return [];
    return (await chercher('copie')).map((c) => ({ id: c.id, nom: c.name, cree_le: c.createdTime, taille: Number(c.size || 0) }));
  }

  async function restaurerCopie(id) {
    const texte = await telecharger(id);
    const entete = Coffre.lire(texte);
    if (entete.id !== E.enveloppe.id) throw new ErreurSync("Cette copie appartient à un autre coffre.");
    const modele = await Coffre.dechiffrer(texte, E.cle);
    await copieAvant('restauration');
    Noyau.remplacerTout(Noyau.normaliser(modele));
    await enregistrerMaintenant();
  }

  /* =========================================================
   * Premier branchement au Drive
   * ======================================================= */

  /**
   * Après connexion Google sur un appareil SANS coffre local :
   * récupère le coffre du Drive s'il existe. Retourne true si un coffre a été trouvé.
   */
  async function recupererDuDrive() {
    const fichiers = await chercher('principal');
    E.drive.actif = true;
    if (!fichiers.length) { await sauverDrive(); return false; }
    const f = fichiers[0];
    const texte = await telecharger(f.id);
    Coffre.lire(texte);
    E.drive.fichier_id = f.id;
    E.drive.version = String(f.version);
    E.drive.dossier_id = (f.parents && f.parents[0]) || null;
    await ecrire('coffre', { texte, en_attente: false, enregistre_le: Date.now() });
    await sauverDrive();
    return true;
  }

  /**
   * Active Drive sur un appareil qui a déjà un coffre (déverrouillé).
   * Retourne 'envoye' (aucun coffre dans le Drive : on envoie celui-ci), 'fusionne', ou 'conflit'.
   */
  async function activerDrive() {
    const fichiers = await chercher('principal');
    E.drive.actif = true;
    if (!fichiers.length) {
      E.drive.fichier_id = null;
      await sauverDrive();
      marquerChangement();
      await enregistrerMaintenant();
      return 'envoye';
    }
    const f = fichiers[0];
    const entete = Coffre.lire(await telecharger(f.id));
    E.drive.fichier_id = f.id;
    E.drive.version = null; // force la lecture et la fusion
    E.drive.dossier_id = (f.parents && f.parents[0]) || null;
    if (entete.id !== E.enveloppe.id) { E.drive.actif = false; await sauverDrive(); return 'conflit'; }
    await sauverDrive();
    await synchroniser();
    return 'fusionne';
  }

  /** Conflit : on garde le coffre de cet appareil, celui du Drive part à la corbeille (30 jours). */
  async function remplacerCoffreDrive() {
    const f = (await chercher('principal'))[0];
    if (f) await requete('PATCH', `/drive/v3/files/${encodeURIComponent(f.id)}`, { corps: { trashed: true } });
    E.drive.actif = true; E.drive.fichier_id = null; E.drive.version = null;
    await sauverDrive();
    marquerChangement();
    await enregistrerMaintenant();
  }

  /** Conflit : on prend le coffre du Drive, celui de l'appareil est remplacé (il faut son mot de passe). */
  async function prendreCoffreDrive() {
    E.cle = null; E.enveloppe = null; Noyau.vider();
    await effacer('cle');
    E.drive.fichier_id = null;
    return recupererDuDrive();
  }

  async function deconnecterDrive() {
    const jeton = E.jeton?.access_token;
    E.drive.actif = false; E.jeton = null;
    await effacer('jeton');
    await sauverDrive();
    if (jeton && window.google?.accounts?.oauth2?.revoke) { try { window.google.accounts.oauth2.revoke(jeton, () => {}); } catch { /* rien */ } }
    definirStatut('local');
  }

  /** Efface tout ce que l'app garde sur cet appareil (le Drive n'est pas touché). */
  async function oublierAppareil() {
    E.cle = null; E.enveloppe = null; E.jeton = null; E.agenda = false;
    E.drive = { actif: false, compte: null, dossier_id: null, fichier_id: null, version: null, derniere_copie: null, dernier_envoi: null };
    Noyau.vider();
    await toutEffacer();
  }

  /* =========================================================
   * Images (2.14) : chaque image est un petit fichier chiffré à part
   * (« img:ID » et « mini:ID » sur l'appareil, « ID.image » et « ID.mini » dans le dossier du Drive).
   * Le coffre ne garde que leur description ; il reste donc léger à synchroniser.
   * ======================================================= */

  const imagesDrive = new Map();      // `${id}:${sorte}` → id du fichier dans le Drive
  let imagesDriveListees = false;
  let envoiImages = null;
  let nettoyageFait = false;

  async function listerImagesDrive() {
    imagesDrive.clear();
    let page;
    do {
      const r = await requete('GET', '/drive/v3/files', {
        query: {
          q: "appProperties has { key='role' and value='image' } and trashed=false",
          fields: 'nextPageToken,files(id,appProperties)', pageSize: '1000', spaces: 'drive', ...(page ? { pageToken: page } : {}),
        },
      });
      for (const f of r.files || []) imagesDrive.set(`${f.appProperties?.image_id}:${f.appProperties?.sorte}`, f.id);
      page = r.nextPageToken;
    } while (page);
    imagesDriveListees = true;
  }

  async function attenteImages() { return (await lire('images_attente')) || []; }

  /** Enregistre une image (et sa miniature) chiffrées sur l'appareil, puis l'envoie au Drive dès que possible. */
  async function imageEnregistrer(id, { image, mini }) {
    if (!E.cle) throw new ErreurSync('Coffre verrouillé.', 'verrou');
    for (const [sorte, blob] of [['img', image], ['mini', mini]]) {
      const c = await Coffre.chiffrerOctets(E.cle, new Uint8Array(await blob.arrayBuffer()));
      await ecrire(`${sorte}:${id}`, c);
    }
    const a = await attenteImages();
    if (!a.includes(id)) { a.push(id); await ecrire('images_attente', a); }
    envoyerImages().catch(() => {});
  }

  /** Lit une image (« img » ou « mini ») : sur l'appareil, sinon dans le Drive (puis gardée sur l'appareil). */
  async function imageLire(id, sorte = 'mini', type = 'image/webp') {
    if (!E.cle) throw new ErreurSync('Coffre verrouillé.', 'verrou');
    let c = await lire(`${sorte}:${id}`);
    if (!c) {
      if (!E.drive.actif) throw new ErreurSync('Image absente de cet appareil.', 'absente');
      if (!jetonValide()) throw new ErreurSync('Reconnexion à Google nécessaire.', 'jeton');
      const cle = `${id}:${sorte === 'img' ? 'image' : 'mini'}`;
      if (!imagesDrive.has(cle)) await listerImagesDrive();
      const fid = imagesDrive.get(cle);
      if (!fid) throw new ErreurSync('Image pas encore arrivée dans le Drive.', 'absente');
      c = await requete('GET', `/drive/v3/files/${encodeURIComponent(fid)}`, { query: { alt: 'media' }, octets: true });
      await ecrire(`${sorte}:${id}`, c);
    }
    const o = await Coffre.dechiffrerOctets(E.cle, c);
    return new Blob([o], { type });
  }

  function multipartBinaire(meta, octets) {
    const frontiere = 'mt' + Math.random().toString(36).slice(2);
    const debut = `--${frontiere}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${frontiere}\r\nContent-Type: application/octet-stream\r\n\r\n`;
    return { corps: new Blob([debut, octets, `\r\n--${frontiere}--`]), type: `multipart/related; boundary=${frontiere}` };
  }

  /** Envoie au Drive les images ajoutées sur cet appareil (y compris hors ligne). */
  function envoyerImages() {
    if (envoiImages) return envoiImages;
    envoiImages = (async () => {
      try {
        if (!E.cle || !E.drive.actif || !jetonValide()) return;
        let a = await attenteImages();
        if (!a.length) return;
        const dossier = await assurerDossier();
        if (!imagesDriveListees) await listerImagesDrive();
        for (const id of [...a]) {
          if (Noyau.modele.images?.[id]) {
            for (const [locale, sorte] of [['img', 'image'], ['mini', 'mini']]) {
              if (imagesDrive.has(`${id}:${sorte}`)) continue;
              const c = await lire(`${locale}:${id}`);
              if (!c) continue;
              const { corps, type } = multipartBinaire({
                name: `${id}.${sorte}`, parents: [dossier], mimeType: 'application/octet-stream',
                appProperties: { role: 'image', app: 'mes-taches', image_id: id, sorte },
              }, c);
              const f = await requete('POST', '/upload/drive/v3/files', { query: { uploadType: 'multipart', fields: 'id' }, corps, type });
              imagesDrive.set(`${id}:${sorte}`, f.id);
            }
          }
          a = (await attenteImages()).filter((x) => x !== id);
          await ecrire('images_attente', a);
        }
      } finally { envoiImages = null; }
    })();
    return envoiImages;
  }

  /** Met à la corbeille du Drive (30 jours) les images supprimées, et les retire de l'appareil. Une fois par séance. */
  async function nettoyerImages() {
    if (nettoyageFait || !E.cle) return;
    nettoyageFait = true;
    const supprimees = Noyau.modele.supprimes || {};
    const locales = await kv('readonly', (st) => st.getAllKeys());
    for (const k of locales || []) {
      const m = /^(img|mini):(.+)$/.exec(k);
      if (m && supprimees[m[2]]) await effacer(k);
    }
    if (!E.drive.actif || !jetonValide()) return;
    await listerImagesDrive();
    for (const [cle, fid] of imagesDrive) {
      const id = cle.split(':')[0];
      if (!supprimees[id]) continue;
      try { await requete('PATCH', `/drive/v3/files/${encodeURIComponent(fid)}`, { corps: { trashed: true } }); imagesDrive.delete(cle); } catch { /* on réessaiera */ }
    }
  }

  /* =========================================================
   * Déclencheurs automatiques
   * ======================================================= */

  window.addEventListener('online', () => synchroniser().catch(() => {}));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') vider().catch(() => {});
    else synchroniser().catch(() => {});
  });
  window.addEventListener('pagehide', () => { vider().catch(() => {}); });
  setInterval(() => { if (document.visibilityState === 'visible') synchroniser().catch(() => {}); }, 120000);

  window.Sync = {
    ErreurSync,
    chargerEtat, etat, reprendre, deverrouiller, recuperer, creer, verrouiller, changerMotDePasse, nouvelleCleRecuperation,
    marquerChangement, enregistrerMaintenant, synchroniser, prolonger, memoriserCle,
    connecterGoogle, googleConfigure, jetonValide, agendaAutorise, reglerAgenda, recupererDuDrive,
    imageEnregistrer, imageLire, envoyerImages, imagesEnAttente: attenteImages, activerDrive, remplacerCoffreDrive, prendreCoffreDrive,
    deconnecterDrive, oublierAppareil, listerCopies, restaurerCopie, copieAvant,
    surStatut(f) { ecouteurs.statut.add(f); return () => ecouteurs.statut.delete(f); },
    surDistant(f) { ecouteurs.distant.add(f); return () => ecouteurs.distant.delete(f); },
    get enveloppe() { return E.enveloppe; },
    get agenda() { return E.agenda; },
    requeteGoogle: (chemin, query) => requete('GET', chemin, { query }),
  };
})();
