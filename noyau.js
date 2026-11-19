/* Mes tâches · logique des données (dans le navigateur, sans serveur)
 *
 * Modèle (version 2) :
 *   projets   { uid: { id, titre, groupement, couleur, couleur_depuis, ordre, complete_le, archive_le, cree_le, maj } }
 *   taches    { uid: { id, projet_id, texte, ordre, cree_le, finalise_le, recurrence, copie_uid, couleur, couleur_depuis, maj } }
 *             couleur de la tâche (2.2) : pastille ; 'blanc' = aucune ; jamais 'gris' (une tâche se coche)
 *   couleurs  { uid: { id, projet_id, couleur, le } }        historique des changements de couleur
 *   supprimes { uid: horodatage }                            pour que la fusion entre appareils respecte les suppressions
 *   reglages  { veille_minutes, maj }
 *
 * « maj » est un horodatage en millisecondes : lors d'une fusion, la version la plus récente gagne.
 * Les dates visibles sont au format « AAAA-MM-JJ HH:MM:SS », en heure locale.
 */
(() => {
  'use strict';

  const GROUPEMENTS = ['Entreprise', 'Proposition', 'Production', 'Développement', 'Innovation', 'Famille', 'Personnel', 'Entretien maison'];
  const COULEURS = ['vert', 'jaune', 'orange', 'rouge', 'vert-p', 'jaune-p', 'orange-p', 'rouge-p', 'blanc', 'gris'];
  /* Couleurs des projets (2.16) : servent à reconnaître un projet ou un groupe, pas à la priorité.
     10 familles × 6 nuances (1 = pâle … 6 = foncé). Les anciennes couleurs restent valides pour les projets existants. */
  const FAMILLES_PROJET = [
    ['rouge', 'rouge', ['#FDE2E1', '#F9B8B5', '#F28B87', '#E5534D', '#C62F2B', '#8E1C1A']],
    ['orange', 'orange', ['#FFE8D4', '#FFCB9E', '#FFA866', '#F7862F', '#D9650F', '#9C450A']],
    ['jaune', 'jaune', ['#FFF6CC', '#FFEB8F', '#FFDC4A', '#F5C400', '#D19F00', '#8F6C00']],
    ['vert', 'vert', ['#E2F5DD', '#BDE8B3', '#8FD47F', '#57B847', '#3A8F30', '#24601E']],
    ['turquoise', 'turquoise', ['#D9F4F1', '#A8E6DF', '#6DD0C5', '#2FB1A4', '#1D8178', '#11564F']],
    ['bleu', 'bleu', ['#DDEBFC', '#B1D0F8', '#7FB0F0', '#4A88E0', '#2C63B8', '#1B3F7C']],
    ['violet', 'violet', ['#E9E2FB', '#CFC0F5', '#AE95EC', '#8A68DE', '#6542B8', '#43297F']],
    ['rose', 'rose', ['#FCE1F0', '#F7B8DB', '#EF88C2', '#E055A3', '#B8327E', '#7E1D55']],
    ['brun', 'brun', ['#F1E6DA', '#DDC6AB', '#C3A27F', '#9F7A54', '#7A5A3A', '#523B25']],
    ['ardoise', 'ardoise', ['#EDEEF0', '#D3D6DB', '#B0B5BD', '#858C97', '#5D6470', '#3A3F48']],
  ];
  const PALETTE_PROJET = FAMILLES_PROJET.flatMap(([cle, nom, nuances]) =>
    nuances.map((hex, i) => ({ id: `${cle}${i + 1}`, nom: `${nom} ${i + 1}`, famille: cle, nuance: i + 1, hex })));
  const COULEURS_PROJET = [...COULEURS, ...PALETTE_PROJET.map((c) => c.id)];
  const FORMAT_ECHANGE = 'outil-taches';
  const VERSION_ECHANGE = 1;
  const TOMBES_JOURS = 120;

  class ErreurNoyau extends Error {}

  /* =========================================================
   * Outils
   * ======================================================= */

  const pad = (n) => String(n).padStart(2, '0');
  const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const formatDateHeure = (d) => `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const maintenant = () => formatDateHeure(new Date());
  const aujourdhui = () => formatDate(new Date());
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
  const copie = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  let dernierMaj = 0;
  /** Horodatage strictement croissant (deux changements dans la même milliseconde restent ordonnés). */
  const horodatage = () => { dernierMaj = Math.max(Date.now(), dernierMaj + 1); return dernierMaj; };

  function dateHeure(v, nullPermis = false) {
    if (v === null || v === undefined || v === '') {
      if (nullPermis) return null;
      throw new ErreurNoyau('Date manquante.');
    }
    if (typeof v !== 'string') throw new ErreurNoyau('Date invalide.');
    let s = v.replace('T', ' ').slice(0, 19);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += ' 00:00:00';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) throw new ErreurNoyau(`Date invalide : ${v}`);
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) throw new ErreurNoyau(`Date invalide : ${v}`);
    return s;
  }

  function dateSeule(v, nullPermis = true) {
    if (v === null || v === undefined || v === '') {
      if (nullPermis) return null;
      throw new ErreurNoyau('Date manquante.');
    }
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ErreurNoyau('Date invalide.');
    const [a, mo, j] = v.split('-').map(Number);
    const d = new Date(Date.UTC(a, mo - 1, j));
    if (d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== j) throw new ErreurNoyau('Date invalide.');
    return v;
  }

  function texteTache(v) {
    if (typeof v !== 'string') throw new ErreurNoyau('Texte invalide.');
    const s = v.replace(/[\u0000-\u0008\u000B-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!s) throw new ErreurNoyau('Le texte de la tâche est vide.');
    if ([...s].length > 2000) throw new ErreurNoyau('Le texte de la tâche est trop long (2000 caractères au maximum).');
    return s;
  }

  function texteBrut(v) {
    let s = '';
    for (let i = 0; i < v.length; i++) {
      const c = v[i];
      if (c === '\\' && i + 1 < v.length) s += v[++i];
      else if (c === '*' && v[i + 1] === '*') i++;
      else s += c;
    }
    return s;
  }

  function titreProjet(v) {
    if (typeof v !== 'string') throw new ErreurNoyau('Titre invalide.');
    const s = v.replace(/\s+/g, ' ').trim();
    return [...(s || 'Sans titre')].slice(0, 255).join('');
  }

  function groupementValide(v) {
    if (!listeGroupements().includes(v)) throw new ErreurNoyau('Groupement inconnu.');
    return v;
  }

  /** Lien d'un projet : http(s) seulement ; « exemple.com » devient « https://exemple.com ». */
  function lienValide(v) {
    if (v === null || v === undefined) return null;
    let s = String(v).trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    let u;
    try { u = new URL(s); } catch { throw new ErreurNoyau('Ce lien n’est pas une adresse web valide.'); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new ErreurNoyau('Seuls les liens web (https://…) sont acceptés.');
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') throw new ErreurNoyau('Ce lien n’est pas une adresse web valide.');
    if (u.href.length > 2000) throw new ErreurNoyau('Ce lien est trop long.');
    return u.href;
  }

  /* ---------- Groupements : liste modifiable (gardée dans les réglages, qui suivent les appareils) ---------- */

  function listeGroupements() {
    const l = M.reglages && Array.isArray(M.reglages.groupements) ? M.reglages.groupements.filter((g) => typeof g === 'string' && g.trim()) : [];
    return l.length ? l : GROUPEMENTS.slice();
  }

  /** Liste affichée : la liste réglée, plus tout groupement encore utilisé par un projet (ex. renommé sur un autre appareil). */
  function groupementsAffiches() {
    const l = listeGroupements();
    for (const p of Object.values(M.projets)) if (p.groupement && !l.includes(p.groupement)) l.push(p.groupement);
    return l;
  }

  function nomGroupement(v) {
    const n = [...String(v ?? '').replace(/\s+/g, ' ').trim()].slice(0, 40).join('');
    if (!n) throw new ErreurNoyau('Donne un nom au groupement.');
    return n;
  }

  function enregistrerGroupements(l) {
    M.reglages.groupements = l;
    M.reglages.maj = horodatage();
  }

  function couleurTacheValide(v) {
    if (v === null || v === undefined || v === '') return 'blanc';
    if (!COULEURS.includes(v) || v === 'gris') throw new ErreurNoyau('Couleur de tâche inconnue.');
    return v;
  }

  function couleurValide(v) {
    if (!COULEURS_PROJET.includes(v)) throw new ErreurNoyau('Couleur inconnue.');
    return v;
  }

  /* =========================================================
   * Récurrence (même logique que la version serveur)
   * ======================================================= */

  function recurrenceValider(r) {
    if (r === null || r === undefined || r === '' || (Array.isArray(r) && !r.length)) return null;
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch { r = null; } }
    if (!r || typeof r !== 'object' || !r.type) throw new ErreurNoyau('Récurrence invalide.');
    const n = Math.max(1, Math.min(365, parseInt(r.intervalle ?? 1, 10) || 1));
    switch (r.type) {
      case 'jour': return { type: 'jour', intervalle: n };
      case 'semaine': {
        const js = parseInt(r.jour_semaine ?? 1, 10);
        if (!(js >= 1 && js <= 7)) throw new ErreurNoyau('Jour de la semaine invalide.');
        return { type: 'semaine', intervalle: n, jour_semaine: js };
      }
      case 'mois': {
        let jm = r.jour_mois ?? 1;
        if (jm !== 'dernier') {
          jm = parseInt(jm, 10);
          if (!(jm >= 1 && jm <= 31)) throw new ErreurNoyau('Jour du mois invalide.');
        }
        return { type: 'mois', intervalle: n, jour_mois: jm };
      }
      case 'annee': {
        const mois = parseInt(r.mois ?? 1, 10), jour = parseInt(r.jour ?? 1, 10);
        if (!(mois >= 1 && mois <= 12 && jour >= 1 && jour <= 31)) throw new ErreurNoyau('Date annuelle invalide.');
        return { type: 'annee', intervalle: n, mois, jour };
      }
      case 'date': return { type: 'date', date: dateSeule(r.date ?? null, false) };
    }
    throw new ErreurNoyau('Type de récurrence inconnu.');
  }

  const versUTC = (s) => { const [a, m, j] = s.split('-').map(Number); return new Date(Date.UTC(a, m - 1, j)); };
  const deUTC = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const joursDansMois = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();

  function jourDansMois(a, m, jour) {
    const dernier = joursDansMois(a, m);
    const j = jour === 'dernier' ? dernier : Math.min(Number(jour), dernier);
    return `${a}-${pad(m)}-${pad(j)}`;
  }

  /** Première date de la série (alignée sur l'ancre) qui dépasse la borne. */
  function seriePremiere(r, ancre, borne, strict) {
    const n = r.intervalle || 1;
    const ok = (c) => (strict ? c > borne : c >= borne);
    switch (r.type) {
      case 'jour': {
        const d = versUTC(ancre);
        for (let i = 0; i < 40000; i++) {
          const c = deUTC(d);
          if (ok(c)) return c;
          d.setUTCDate(d.getUTCDate() + n);
        }
        return null;
      }
      case 'semaine': {
        const d = versUTC(ancre);
        while (((d.getUTCDay() + 6) % 7) + 1 !== Number(r.jour_semaine)) d.setUTCDate(d.getUTCDate() + 1);
        for (let i = 0; i < 6000; i++) {
          const c = deUTC(d);
          if (ok(c)) return c;
          d.setUTCDate(d.getUTCDate() + 7 * n);
        }
        return null;
      }
      case 'mois': {
        let a = +ancre.slice(0, 4), m = +ancre.slice(5, 7);
        for (let i = 0; i < 3000; i++) {
          const c = jourDansMois(a, m, r.jour_mois);
          if (ok(c)) return c;
          m += n;
          while (m > 12) { m -= 12; a++; }
        }
        return null;
      }
      case 'annee': {
        let a = +ancre.slice(0, 4);
        for (let i = 0; i < 600; i++) {
          const c = jourDansMois(a, Number(r.mois), Number(r.jour));
          if (ok(c)) return c;
          a += n;
        }
        return null;
      }
    }
    return null;
  }

  /** Prochaine date après avoir coché : première date de la série après aujourd'hui. */
  function recurrenceProchaine(r, ancre, jour) {
    ancre = ancre.slice(0, 10);
    if (r.type === 'date') return r.date > jour ? r.date : null;
    return seriePremiere(r, ancre, ancre > jour ? ancre : jour, true);
  }

  /* =========================================================
   * Échéances (paiements de taxes) : mois de l'année + jour (ou dernier jour)
   * ======================================================= */

  const ECHEANCES_DEFAUT = [
    { id: 'def-das-ca', nom: 'Remises Canada – DAS', mois: [1, 4, 7, 10], jour: 15, note: '' },
    { id: 'def-das-qc', nom: 'Remises Québec – DAS', mois: [1, 4, 7, 10], jour: 15, note: '' },
    { id: 'def-tps-tvq', nom: 'TPS/TVH et TVQ (LMW-10)', mois: [2, 5, 8, 11], jour: 'dernier', note: 'via Revenu Québec' },
    { id: 'def-registre', nom: 'Registre des entreprises – mise à jour annuelle', mois: [11], jour: 17, note: '' },
    { id: 'def-cnesst', nom: 'CNESST – déclaration des salaires', mois: [3], jour: 15, note: 'par Mallette' },
  ];

  function echeanceValider(e, existante = {}) {
    const nom = String(e.nom ?? existante.nom ?? '').trim().slice(0, 120);
    if (!nom) throw new ErreurNoyau('Donne un nom au paiement.');
    const mois = [...new Set((e.mois ?? existante.mois ?? []).map(Number).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
    if (!mois.length) throw new ErreurNoyau('Choisis au moins un mois.');
    let jour = e.jour ?? existante.jour ?? 15;
    if (jour !== 'dernier') { jour = parseInt(jour, 10); if (!(jour >= 1 && jour <= 31)) throw new ErreurNoyau('Jour invalide.'); }
    const note = String(e.note ?? existante.note ?? '').trim().slice(0, 200);
    return { nom, mois, jour, note };
  }

  /** Dates d'une échéance entre deux jours (AAAA-MM-JJ), bornes comprises. */
  function datesEcheance(ec, du, au) {
    const res = [];
    let a = +du.slice(0, 4);
    const fin = +au.slice(0, 4);
    for (; a <= fin; a++) {
      for (const m of ec.mois) {
        const d = jourDansMois(a, m, ec.jour);
        if (d >= du && d <= au) res.push(d);
      }
    }
    return res;
  }

  /** Prochains paiements non payés (et ceux en retard depuis la création de l'échéance, 120 jours au plus). */
  function echeancesAVenir(jour = aujourdhui(), { horizon = 400 } = {}) {
    const recul = deUTC(new Date(versUTC(jour).getTime() - 120 * 86400000));
    const loin = deUTC(new Date(versUTC(jour).getTime() + horizon * 86400000));
    const liste = [];
    for (const ec of Object.values(M.echeances || {})) {
      const depuis = ec.depuis && ec.depuis > recul ? ec.depuis : recul;
      for (const d of datesEcheance(ec, depuis, loin)) {
        if (ec.payes && ec.payes[d]) continue;
        liste.push({ id: ec.id, nom: ec.nom, note: ec.note || '', date: d });
      }
    }
    return liste.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.nom.localeCompare(y.nom, 'fr')));
  }

  /* =========================================================
   * Modèle
   * ======================================================= */

  function modeleVide() {
    return {
      format: 'mes-taches', version: 2,
      projets: {}, taches: {}, couleurs: {}, supprimes: {}, echeances: {}, images: {},
      reglages: { veille_minutes: 15, maj: 0 },
      derniere_sauvegarde: null,
    };
  }

  let M = modeleVide();
  let surChangement = () => {};

  let compteImagesCache = null;
  function changer() { compteImagesCache = null; surChangement(); }

  /** Nombre d'images par tâche (mis en cache jusqu'au prochain changement). */
  function compteImages() {
    if (!compteImagesCache) {
      compteImagesCache = new Map();
      for (const im of Object.values(M.images || {})) compteImagesCache.set(im.tache_id, (compteImagesCache.get(im.tache_id) || 0) + 1);
    }
    return compteImagesCache;
  }

  function projetDe(id) {
    const p = M.projets[id];
    if (!p) throw new ErreurNoyau('Projet introuvable.');
    return p;
  }
  function tacheDe(id) {
    const t = M.taches[id];
    if (!t) throw new ErreurNoyau('Tâche introuvable.');
    return t;
  }

  function ajouterEnregistrement(collection, rec) {
    delete M.supprimes[rec.id];
    rec.maj = horodatage();
    M[collection][rec.id] = rec;
    return rec;
  }
  function toucher(rec) { rec.maj = horodatage(); return rec; }
  function supprimerEnregistrement(collection, id) {
    if (!M[collection][id]) return;
    delete M[collection][id];
    M.supprimes[id] = horodatage();
  }

  function noterCouleur(projetId, couleur, le) {
    const id = uid();
    delete M.supprimes[id];
    M.couleurs[id] = { id, projet_id: projetId, couleur, le };
  }

  function historique(projetIds) {
    const voulu = new Set(projetIds);
    return Object.values(M.couleurs).filter((c) => voulu.has(c.projet_id))
      .sort((a, b) => (a.le < b.le ? -1 : a.le > b.le ? 1 : 0))
      .map((c) => ({ projet_id: c.projet_id, couleur: c.couleur, le: c.le }));
  }

  const versProjet = (p) => {
    const { maj: _m, ...reste } = p;
    return { ...reste, uid: p.id };
  };
  const versTache = (t) => {
    const { maj: _m, copie_uid: _c, ...reste } = t;
    return { ...reste, uid: t.id, recurrence: copie(t.recurrence) || null, couleur: t.couleur || 'blanc', couleur_depuis: t.couleur_depuis || null, images: compteImages().get(t.id) || 0 };
  };
  const parOrdre = (a, b) => a.ordre - b.ordre || (a.cree_le < b.cree_le ? -1 : a.cree_le > b.cree_le ? 1 : 0) || (a.id < b.id ? -1 : 1);

  /* =========================================================
   * Actions (mêmes noms et mêmes réponses que l'ancienne API)
   * ======================================================= */

  const ACTIONS = {
    donnees() {
      // Dernière activité d'un projet : lui-même ou la plus récente de ses tâches (créée, modifiée, cochée).
      const activite = new Map();
      for (const t of Object.values(M.taches)) activite.set(t.projet_id, Math.max(activite.get(t.projet_id) || 0, t.maj || 0));
      const projets = Object.values(M.projets).filter((p) => !p.archive_le).sort(parOrdre)
        .map((p) => ({ ...versProjet(p), modifie_le: Math.max(p.maj || 0, activite.get(p.id) || 0) }));
      const actifs = new Set(projets.map((p) => p.id));
      const m = maintenant();
      // Tâches apparues par récurrence (copie créée quand l'occurrence précédente a été cochée).
      const occurrences = new Set(Object.values(M.taches).map((t) => t.copie_uid).filter(Boolean));
      const taches = Object.values(M.taches)
        .filter((t) => !t.finalise_le && t.cree_le <= m && actifs.has(t.projet_id))
        .sort(parOrdre).map((t) => ({ ...versTache(t), occurrence: occurrences.has(t.id) }));
      return {
        projets, taches,
        couleurs: historique(projets.map((p) => p.id)),
        compte_archives: Object.values(M.taches).filter((t) => t.finalise_le).length,
        maintenant: m,
      };
    },

    projet_creer(e) {
      const titre = titreProjet(e.titre ?? 'Nouveau projet');
      const groupement = groupementValide(e.groupement ?? listeGroupements()[0]);
      const ordres = Object.values(M.projets).map((p) => p.ordre);
      const m = maintenant();
      const p = ajouterEnregistrement('projets', {
        id: uid(), titre, groupement, couleur: 'blanc', couleur_depuis: m,
        ordre: (ordres.length ? Math.min(...ordres) : 0) - 1, complete_le: null, archive_le: null, cree_le: m,
      });
      noterCouleur(p.id, 'blanc', m);
      changer();
      return { projet: versProjet(p) };
    },

    projet_modifier(e) {
      const p = projetDe(e.id);
      if ('titre' in e) p.titre = titreProjet(e.titre);
      if ('groupement' in e) p.groupement = groupementValide(e.groupement);
      if ('lien' in e) p.lien = lienValide(e.lien);
      if ('couleur' in e) {
        const c = couleurValide(e.couleur);
        if (c !== p.couleur) {
          const m = maintenant();
          p.couleur = c; p.couleur_depuis = m; p.complete_le = c === 'gris' ? m : null;
          noterCouleur(p.id, c, m);
        }
      }
      toucher(p);
      changer();
      return { projet: versProjet(p), couleurs: historique([p.id]) };
    },

    projet_retablir(e) {
      const p = projetDe(e.id);
      const hist = historique([p.id]).filter((c) => c.couleur !== 'gris');
      const precedente = hist.length ? hist[hist.length - 1].couleur : 'blanc';
      return ACTIONS.projet_modifier({ id: p.id, couleur: precedente });
    },

    projets_ordonner(e) {
      if (!Array.isArray(e.ids) || e.ids.length > 5000) throw new ErreurNoyau('Ordre invalide.');
      e.ids.forEach((id, i) => {
        const p = M.projets[id];
        if (p && p.ordre !== i) { p.ordre = i; toucher(p); }
      });
      changer();
      return { ok: true };
    },

    taches_ordonner(e) {
      projetDe(e.projet_id);
      if (!Array.isArray(e.ids) || e.ids.length > 5000) throw new ErreurNoyau('Ordre invalide.');
      e.ids.forEach((id, i) => {
        const t = M.taches[id];
        if (t && t.projet_id === e.projet_id && t.ordre !== i) { t.ordre = i; toucher(t); }
      });
      changer();
      return { ok: true };
    },

    projet_archiver(e) {
      const p = projetDe(e.id);
      const m = maintenant();
      for (const t of Object.values(M.taches)) {
        if (t.projet_id !== p.id || t.finalise_le) continue;
        if (t.cree_le > m) supprimerEnregistrement('taches', t.id);
        else { t.finalise_le = m; toucher(t); }
      }
      p.archive_le = m;
      toucher(p);
      changer();
      return { ok: true };
    },

    projet_supprimer(e) {
      const p = projetDe(e.id);
      for (const t of Object.values(M.taches)) if (t.projet_id === p.id) supprimerEnregistrement('taches', t.id);
      for (const im of Object.values(M.images || {})) if (!M.taches[im.tache_id]) supprimerEnregistrement('images', im.id);
      for (const c of Object.values(M.couleurs)) if (c.projet_id === p.id) delete M.couleurs[c.id];
      supprimerEnregistrement('projets', p.id);
      changer();
      return { ok: true };
    },

    tache_creer(e) {
      const p = projetDe(e.projet_id);
      if (p.archive_le) throw new ErreurNoyau('Ce projet est archivé.');
      const texte = texteTache(e.texte);
      const ordres = Object.values(M.taches).filter((t) => t.projet_id === p.id).map((t) => t.ordre);
      const t = ajouterEnregistrement('taches', {
        id: uid(), projet_id: p.id, texte, ordre: (ordres.length ? Math.max(...ordres) : -1) + 1,
        cree_le: maintenant(), finalise_le: null, recurrence: null, copie_uid: null, couleur: 'blanc', couleur_depuis: null,
      });
      changer();
      return { tache: versTache(t) };
    },

    tache_modifier(e) {
      const t = tacheDe(e.id);
      if ('texte' in e) t.texte = texteTache(e.texte);
      if ('recurrence' in e) t.recurrence = recurrenceValider(e.recurrence);
      if ('lien' in e) t.lien = lienValide(e.lien);
      if ('couleur' in e) {
        const c = couleurTacheValide(e.couleur);
        if (c !== (t.couleur || 'blanc')) { t.couleur = c; t.couleur_depuis = c === 'blanc' ? null : maintenant(); }
      }
      toucher(t);
      changer();
      return { tache: versTache(t) };
    },

    tache_finaliser(e) {
      const t = tacheDe(e.id);
      if (t.finalise_le) return { prochaine: null };
      let prochaine = null, copieUid = null;
      if (t.recurrence) {
        const r = recurrenceValider(t.recurrence);
        prochaine = r ? recurrenceProchaine(r, t.cree_le, aujourdhui()) : null;
        if (prochaine) {
          copieUid = uid();
          ajouterEnregistrement('taches', {
            id: copieUid, projet_id: t.projet_id, texte: t.texte, ordre: t.ordre,
            cree_le: `${prochaine} 00:00:00`, finalise_le: null,
            recurrence: r.type === 'date' ? null : r, copie_uid: null,
            couleur: t.couleur || 'blanc', couleur_depuis: t.couleur_depuis || null, lien: t.lien || null,
          });
        }
      }
      t.finalise_le = maintenant();
      t.copie_uid = copieUid;
      toucher(t);
      changer();
      return { prochaine };
    },

    /** Annule une suppression : la tâche revient telle quelle (copie gardée par l'interface). */
    tache_reinserer(e) {
      const t = e.tache;
      if (!t || typeof t !== 'object' || !t.id || !M.projets[t.projet_id]) throw new ErreurNoyau('Impossible de remettre cette tâche.');
      const { maj: _m, ...reste } = copie(t);
      ajouterEnregistrement('taches', { ...reste, texte: texteTache(reste.texte) });
      for (const im of e.images || []) if (im && im.id && im.tache_id === t.id) { const { maj: _x, ...r } = copie(im); ajouterEnregistrement('images', r); }
      changer();
      return { tache: versTache(M.taches[t.id]) };
    },

    tache_restaurer(e) {
      const t = tacheDe(e.id);
      if (t.copie_uid) {
        const c = M.taches[t.copie_uid];
        if (c && !c.finalise_le && c.cree_le > maintenant()) supprimerEnregistrement('taches', c.id);
      }
      t.finalise_le = null; t.copie_uid = null;
      toucher(t);
      const p = M.projets[t.projet_id];
      if (p && p.archive_le) { p.archive_le = null; toucher(p); }
      changer();
      return { tache: versTache(t) };
    },

    tache_supprimer(e) {
      tacheDe(e.id);
      const images = Object.values(M.images || {}).filter((im) => im.tache_id === e.id).map((im) => copie(im));
      for (const im of images) supprimerEnregistrement('images', im.id);
      supprimerEnregistrement('taches', e.id);
      changer();
      return { ok: true, images };
    },

    recurrence_apercu(e) {
      const r = recurrenceValider(e.recurrence);
      if (!r) return { prochaine: null };
      const ancre = dateSeule(String(e.cree_le || aujourdhui()).slice(0, 10), false);
      return { prochaine: recurrenceProchaine(r, ancre, aujourdhui()) };
    },

    archives(_e, params = {}) {
      const champ = params.type === 'cree' ? 'cree_le' : 'finalise_le';
      const du = dateSeule(params.du ?? null), au = dateSeule(params.au ?? null);
      const limite = 3000;
      let liste = Object.values(M.taches).filter((t) => t.finalise_le);
      if (du) liste = liste.filter((t) => t[champ] >= `${du} 00:00:00`);
      if (au) liste = liste.filter((t) => t[champ] <= `${au} 23:59:59`);
      liste.sort((a, b) => (a[champ] < b[champ] ? 1 : a[champ] > b[champ] ? -1 : 0));
      const tronque = liste.length > limite;
      const taches = liste.slice(0, limite).map(versTache);
      const ids = [...new Set(taches.map((t) => t.projet_id))];
      const projets = ids.map((id) => M.projets[id]).filter(Boolean).sort(parOrdre).map(versProjet);
      return { taches, projets, couleurs: historique(ids), tronque };
    },

    echeances() {
      return { echeances: Object.values(M.echeances || {}).map((e) => copie(e)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), initialisees: Boolean(M.reglages.echeances_init) };
    },

    /** Calendrier habituel : ids fixes, pour qu'il ne soit jamais créé en double entre deux appareils. */
    echeances_defaut() {
      const depuis = aujourdhui();
      for (const d of ECHEANCES_DEFAUT) if (!M.echeances[d.id] && !M.supprimes[d.id]) ajouterEnregistrement('echeances', { ...copie(d), depuis, payes: {} });
      M.reglages.echeances_init = true; M.reglages.maj = horodatage();
      changer();
      return ACTIONS.echeances();
    },

    echeance_creer(e) {
      const v = echeanceValider(e);
      const ec = ajouterEnregistrement('echeances', { id: uid(), ...v, depuis: aujourdhui(), payes: {} });
      M.reglages.echeances_init = true; M.reglages.maj = horodatage();
      changer();
      return { echeance: copie(ec) };
    },

    echeance_modifier(e) {
      const ec = M.echeances[e.id];
      if (!ec) throw new ErreurNoyau('Paiement introuvable.');
      Object.assign(ec, echeanceValider(e, ec));
      toucher(ec);
      changer();
      return { echeance: copie(ec) };
    },

    echeance_supprimer(e) {
      if (!M.echeances[e.id]) throw new ErreurNoyau('Paiement introuvable.');
      supprimerEnregistrement('echeances', e.id);
      changer();
      return { ok: true };
    },

    /** Marque une date d'échéance comme payée (ou l'annule). */
    echeance_payer(e) {
      const ec = M.echeances[e.id];
      if (!ec) throw new ErreurNoyau('Paiement introuvable.');
      const d = dateSeule(e.date, false);
      ec.payes = ec.payes || {};
      if (e.paye === false) delete ec.payes[d]; else ec.payes[d] = maintenant();
      // On ne garde que deux ans d'historique de paiements.
      const limite = deUTC(new Date(versUTC(aujourdhui()).getTime() - 730 * 86400000));
      for (const k of Object.keys(ec.payes)) if (k < limite) delete ec.payes[k];
      toucher(ec);
      changer();
      return { echeance: copie(ec) };
    },

    /* ----- Images (la description ; les octets chiffrés sont gérés par stockage.js) ----- */

    image_ajouter(e) {
      const t = tacheDe(e.tache_id);
      if (!/^[A-Za-z0-9-]{8,64}$/.test(String(e.id || ''))) throw new ErreurNoyau('Identifiant d’image invalide.');
      const im = ajouterEnregistrement('images', {
        id: e.id, tache_id: t.id, projet_id: t.projet_id,
        nom: [...String(e.nom || 'image').trim()].slice(0, 120).join('') || 'image',
        type: /^image\/(webp|jpeg|png|gif)$/.test(e.type) ? e.type : 'image/webp',
        largeur: Math.max(0, Math.round(Number(e.largeur) || 0)), hauteur: Math.max(0, Math.round(Number(e.hauteur) || 0)),
        taille: Math.max(0, Math.round(Number(e.taille) || 0)), cree_le: maintenant(),
        prise_le: (() => { try { return e.prise_le ? dateHeure(e.prise_le, true) : null; } catch { return null; } })(),
      });
      changer();
      return { image: copie(im) };
    },

    /** « Conserver » : l'image n'est jamais retirée automatiquement. */
    image_garder(e) {
      const ids = Array.isArray(e.ids) ? e.ids : [e.id];
      for (const id of ids) { const im = M.images?.[id]; if (im) { im.garder = Boolean(e.garder); toucher(im); } }
      changer();
      return { ok: true };
    },

    /** Supprime plusieurs images ; renvoie leurs copies pour pouvoir annuler. */
    images_supprimer(e) {
      const copies = [];
      for (const id of e.ids || []) { const im = M.images?.[id]; if (im) { copies.push(copie(im)); supprimerEnregistrement('images', id); } }
      changer();
      return { images: copies };
    },

    images_reinserer(e) {
      let n = 0;
      for (const im of e.images || []) {
        if (!im || !im.id || !M.taches[im.tache_id]) continue;
        const { maj: _m, ...r } = copie(im);
        ajouterEnregistrement('images', r); n++;
      }
      changer();
      return { n };
    },

    /** Retire les images non conservées de plus de « jours » jours (31 par défaut). */
    images_expirer(e = {}) {
      const jours = Math.max(1, Number(e.jours) || JOURS_IMAGES);
      const limite = new Date(Date.now() - jours * 86400000);
      const pad = (n) => String(n).padStart(2, '0');
      const lim = `${limite.getFullYear()}-${pad(limite.getMonth() + 1)}-${pad(limite.getDate())} ${pad(limite.getHours())}:${pad(limite.getMinutes())}:${pad(limite.getSeconds())}`;
      const retirees = [];
      for (const im of Object.values(M.images || {})) {
        if (!im.garder && im.cree_le && im.cree_le < lim) { retirees.push(copie(im)); supprimerEnregistrement('images', im.id); }
      }
      if (retirees.length) changer();
      return { images: retirees };
    },

    image_supprimer(e) {
      const im = M.images?.[e.id];
      if (!im) throw new ErreurNoyau('Image introuvable.');
      const c = copie(im);
      supprimerEnregistrement('images', e.id);
      changer();
      return { image: c };
    },

    image_reinserer(e) {
      const im = e.image;
      if (!im || !im.id || !M.taches[im.tache_id]) throw new ErreurNoyau('Impossible de remettre cette image.');
      const { maj: _m, ...r } = copie(im);
      ajouterEnregistrement('images', r);
      changer();
      return { image: copie(M.images[im.id]) };
    },

    /** Images d'une tâche, ou toutes (galerie), les plus récentes d'abord, avec leur tâche et leur projet. */
    images(e = {}) {
      const liste = Object.values(M.images || {})
        .filter((im) => (!e.tache_id || im.tache_id === e.tache_id) && M.taches[im.tache_id])
        .sort((a, b) => (a.cree_le < b.cree_le ? 1 : a.cree_le > b.cree_le ? -1 : 0) || (b.maj || 0) - (a.maj || 0))
        .map((im) => {
          const t = M.taches[im.tache_id];
          const p = M.projets[t.projet_id];
          return { ...copie(im), projet_id: t.projet_id, tache_texte: t.texte, tache_finalisee: Boolean(t.finalise_le), projet_titre: p ? p.titre : '', projet_couleur: p ? p.couleur : 'blanc', projet_archive: Boolean(p?.archive_le) };
        });
      if (e.tache_id) liste.reverse(); // dans une tâche : ordre d'ajout
      return { images: liste };
    },

    groupements() {
      const compte = new Map();
      for (const p of Object.values(M.projets)) compte.set(p.groupement, (compte.get(p.groupement) || 0) + 1);
      return { groupements: groupementsAffiches().map((nom) => ({ nom, projets: compte.get(nom) || 0 })) };
    },

    groupement_ajouter(e) {
      const nom = nomGroupement(e.nom);
      const l = groupementsAffiches();
      if (l.some((g) => g.toLowerCase() === nom.toLowerCase())) throw new ErreurNoyau('Ce groupement existe déjà.');
      l.push(nom);
      enregistrerGroupements(l);
      changer();
      return ACTIONS.groupements();
    },

    groupement_renommer(e) {
      const ancien = String(e.ancien ?? '');
      const nouveau = nomGroupement(e.nouveau);
      const l = groupementsAffiches();
      const i = l.indexOf(ancien);
      if (i < 0) throw new ErreurNoyau('Groupement introuvable.');
      if (nouveau !== ancien && l.some((g, j) => j !== i && g.toLowerCase() === nouveau.toLowerCase())) throw new ErreurNoyau('Ce groupement existe déjà.');
      l[i] = nouveau;
      for (const p of Object.values(M.projets)) if (p.groupement === ancien) { p.groupement = nouveau; toucher(p); }
      enregistrerGroupements(l);
      changer();
      return ACTIONS.groupements();
    },

    /** Retire un groupement ; ses projets (archivés compris) passent dans « vers ». */
    groupement_supprimer(e) {
      const nom = String(e.nom ?? '');
      const l = groupementsAffiches();
      if (!l.includes(nom)) throw new ErreurNoyau('Groupement introuvable.');
      if (l.length <= 1) throw new ErreurNoyau('Il faut garder au moins un groupement.');
      const reste = l.filter((g) => g !== nom);
      const utilises = Object.values(M.projets).filter((p) => p.groupement === nom);
      if (utilises.length) {
        const vers = String(e.vers ?? '');
        if (!reste.includes(vers)) throw new ErreurNoyau('Choisis où déplacer les projets de ce groupement.');
        for (const p of utilises) { p.groupement = vers; toucher(p); }
      }
      enregistrerGroupements(reste);
      changer();
      return ACTIONS.groupements();
    },

    groupements_ordonner(e) {
      const l = groupementsAffiches();
      const voulu = (e.liste || []).filter((g) => l.includes(g));
      if (voulu.length !== l.length) throw new ErreurNoyau('Liste de groupements incomplète.');
      enregistrerGroupements(voulu);
      changer();
      return ACTIONS.groupements();
    },

    sauvegarde_info() {
      const parAnnee = new Map();
      for (const t of Object.values(M.taches)) {
        const a = +t.cree_le.slice(0, 4);
        if (!parAnnee.has(a)) parAnnee.set(a, { annee: a, taches: 0, projets: new Set() });
        const x = parAnnee.get(a);
        x.taches++; x.projets.add(t.projet_id);
      }
      return {
        annees: [...parAnnee.values()].sort((a, b) => b.annee - a.annee).map((x) => ({ annee: x.annee, taches: x.taches, projets: x.projets.size })),
        projets: Object.keys(M.projets).length,
        derniere_sauvegarde: M.derniere_sauvegarde,
        zip_disponible: true,
        taille_max_mo: 50,
      };
    },
  };

  /** Point d'entrée unique, qui imite l'ancienne API (réponses copiées, jamais l'objet interne). */
  async function api(action, { donnees, params } = {}) {
    const f = ACTIONS[action];
    if (!f) throw new ErreurNoyau(`Action inconnue : ${action}`);
    return copie(f(copie(donnees) || {}, params || {}));
  }

  /* =========================================================
   * Fusion entre appareils
   * ======================================================= */

  /** Fusionne deux modèles : enregistrement par enregistrement, le plus récent gagne ; les suppressions sont respectées. */
  function fusionner(a, b) {
    const r = modeleVide();
    const limite = Date.now() - TOMBES_JOURS * 86400000;
    for (const src of [a.supprimes || {}, b.supprimes || {}]) {
      for (const [k, v] of Object.entries(src)) if (v > limite && (!r.supprimes[k] || v > r.supprimes[k])) r.supprimes[k] = v;
    }
    for (const coll of ['projets', 'taches', 'echeances', 'images']) {
      const ids = new Set([...Object.keys(a[coll] || {}), ...Object.keys(b[coll] || {})]);
      for (const id of ids) {
        const x = a[coll]?.[id], y = b[coll]?.[id];
        const gagnant = !x ? y : !y ? x : (y.maj > x.maj ? y : x);
        const tombe = r.supprimes[id];
        if (tombe && tombe >= gagnant.maj) continue;
        r[coll][id] = copie(gagnant);
      }
    }
    for (const id of Object.keys(r.taches)) if (!r.projets[r.taches[id].projet_id]) delete r.taches[id];
    for (const src of [a.couleurs || {}, b.couleurs || {}]) {
      for (const [id, c] of Object.entries(src)) if (r.projets[c.projet_id] && !r.supprimes[id]) r.couleurs[id] = copie(c);
    }
    const ra = a.reglages || {}, rb = b.reglages || {};
    r.reglages = copie((rb.maj || 0) > (ra.maj || 0) ? rb : ra);
    if (!r.reglages.veille_minutes && r.reglages.veille_minutes !== 0) r.reglages.veille_minutes = 15;
    r.derniere_sauvegarde = [a.derniere_sauvegarde, b.derniere_sauvegarde].filter(Boolean).sort().pop() || null;
    return r;
  }

  /** Signature du contenu (pour savoir si une fusion a changé quelque chose). */
  function signature(m) {
    const parts = [];
    for (const coll of ['projets', 'taches', 'echeances', 'images']) for (const [k, v] of Object.entries(m[coll] || {}).sort()) parts.push(k + ':' + v.maj);
    parts.push(Object.keys(m.couleurs).length, Object.keys(m.supprimes).length, m.reglages.maj || 0);
    return parts.join('|');
  }

  /** Remplace tout le contenu (restauration d'une copie) en marquant comme supprimé ce qui disparaît. */
  function remplacerTout(nouveau) {
    const n = copie(nouveau);
    for (const coll of ['projets', 'taches']) {
      for (const id of Object.keys(M[coll])) if (!n[coll][id]) supprimerEnregistrement(coll, id);
      M[coll] = {};
      for (const rec of Object.values(n[coll])) ajouterEnregistrement(coll, rec);
    }
    M.couleurs = n.couleurs || {};
    changer();
  }

  /* =========================================================
   * Format d'échange (.zip) : identique à la version serveur
   * ======================================================= */

  function donneesEchange(annee = null, { encours = true, archives = true, couleurs = true } = {}) {
    let taches = Object.values(M.taches);
    if (annee !== null) taches = taches.filter((t) => t.cree_le.startsWith(`${annee}-`));
    if (encours && !archives) taches = taches.filter((t) => !t.finalise_le);
    else if (archives && !encours) taches = taches.filter((t) => t.finalise_le);
    else if (!encours && !archives) taches = [];
    taches.sort((a, b) => (a.projet_id < b.projet_id ? -1 : a.projet_id > b.projet_id ? 1 : 0) || parOrdre(a, b));
    const avecTaches = new Set(taches.map((t) => t.projet_id));
    const projets = Object.values(M.projets).sort(parOrdre)
      .filter((p) => annee === null || avecTaches.has(p.id) || p.cree_le.startsWith(`${annee}-`));
    const ids = new Set(projets.map((p) => p.id));
    return {
      projets: projets.map((p) => ({
        uid: p.id, titre: p.titre, groupement: p.groupement, couleur: p.couleur, couleur_depuis: p.couleur_depuis, lien: p.lien || null,
        ordre: p.ordre, complete_le: p.complete_le, archive_le: p.archive_le, cree_le: p.cree_le,
      })),
      taches: taches.map((t) => ({
        uid: t.id, projet_uid: t.projet_id, texte: t.texte, ordre: t.ordre, cree_le: t.cree_le,
        finalise_le: t.finalise_le, recurrence: t.recurrence || null, copie_uid: t.copie_uid || null,
        couleur: t.couleur || 'blanc', couleur_depuis: t.couleur_depuis || null, lien: t.lien || null,
      })),
      couleurs: couleurs ? historique([...ids]).map((c) => ({ projet_uid: c.projet_id, couleur: c.couleur, le: c.le })) : [],
    };
  }

  function totaux(d) {
    const archivees = d.taches.filter((t) => t.finalise_le).length;
    return { projets: d.projets.length, taches: d.taches.length, en_cours: d.taches.length - archivees, archivees, couleurs: d.couleurs.length };
  }

  function libelleRecurrence(r) {
    if (!r) return '';
    const n = r.intervalle || 1;
    const jours = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    switch (r.type) {
      case 'jour': return n === 1 ? 'chaque jour' : `tous les ${n} jours`;
      case 'semaine': return `${n === 1 ? 'chaque semaine' : `toutes les ${n} semaines`}, le ${jours[r.jour_semaine] || ''}`;
      case 'mois': return `${n === 1 ? 'chaque mois' : `tous les ${n} mois`}, le ${r.jour_mois === 'dernier' ? 'dernier jour' : r.jour_mois}`;
      case 'annee': return `${n === 1 ? 'chaque année' : `tous les ${n} ans`}, le ${pad(r.jour)}-${pad(r.mois)}`;
      case 'date': return `le ${r.date}`;
    }
    return '';
  }

  function construireCsv(d) {
    const projets = Object.fromEntries(d.projets.map((p) => [p.uid, p]));
    const cellule = (v) => {
      const s = String(v ?? '');
      return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lignes = [['Projet', 'Groupement', 'Couleur du projet', 'Tâche', 'Créée le', 'Finalisée le', 'Récurrence', 'Couleur de la tâche']];
    for (const t of d.taches) {
      const p = projets[t.projet_uid] || { titre: '', groupement: '', couleur: '' };
      lignes.push([p.titre, p.groupement, p.couleur, texteBrut(t.texte), t.cree_le, t.finalise_le || '', libelleRecurrence(t.recurrence),
        t.couleur && t.couleur !== 'blanc' ? t.couleur : '']);
    }
    return '﻿' + lignes.map((l) => l.map(cellule).join(';')).join('\n') + '\n';
  }

  /* ---------- .zip minimal (écriture sans compression, lecture avec ou sans) ---------- */

  const TABLE_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(o) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < o.length; i++) c = TABLE_CRC[(c ^ o[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function creerZip(fichiers) {
    const enc = new TextEncoder();
    const d = new Date();
    const heure = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const jour = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    const morceaux = [], central = [];
    let decalage = 0;
    for (const [nom, contenu] of fichiers) {
      const n = enc.encode(nom);
      const c = typeof contenu === 'string' ? enc.encode(contenu) : contenu;
      const crc = crc32(c);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true); local.setUint16(10, heure, true); local.setUint16(12, jour, true);
      local.setUint32(14, crc, true); local.setUint32(18, c.length, true); local.setUint32(22, c.length, true);
      local.setUint16(26, n.length, true); local.setUint16(28, 0, true);
      morceaux.push(new Uint8Array(local.buffer), n, c);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true); cd.setUint16(12, heure, true); cd.setUint16(14, jour, true);
      cd.setUint32(16, crc, true); cd.setUint32(20, c.length, true); cd.setUint32(24, c.length, true);
      cd.setUint16(28, n.length, true); cd.setUint32(42, decalage, true);
      central.push(new Uint8Array(cd.buffer), n);
      decalage += 30 + n.length + c.length;
    }
    const tailleCentral = central.reduce((s, x) => s + x.length, 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true);
    fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
    fin.setUint32(12, tailleCentral, true); fin.setUint32(16, decalage, true);
    return new Blob([...morceaux, ...central, new Uint8Array(fin.buffer)], { type: 'application/zip' });
  }

  async function lireZip(octets) {
    const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    let fin = -1;
    for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65557); i--) {
      if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    }
    if (fin < 0) throw new ErreurNoyau("Ce fichier n'est pas un .zip lisible.");
    const nb = v.getUint16(fin + 10, true);
    let p = v.getUint32(fin + 16, true);
    const dec = new TextDecoder();
    const entrees = new Map();
    for (let k = 0; k < nb; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new ErreurNoyau('Fichier .zip abîmé.');
      const methode = v.getUint16(p + 10, true);
      const tailleC = v.getUint32(p + 20, true), tailleN = v.getUint32(p + 24, true);
      const ln = v.getUint16(p + 28, true), lx = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true);
      const local = v.getUint32(p + 42, true);
      entrees.set(dec.decode(octets.subarray(p + 46, p + 46 + ln)), { methode, tailleC, tailleN, local });
      p += 46 + ln + lx + lc;
    }
    async function lireOctets(nom) {
      const e = entrees.get(nom);
      if (!e) return null;
      if (e.tailleN > 100 * 1024 * 1024) throw new ErreurNoyau(`Fichier trop volumineux dans le .zip : ${nom}`);
      const debut = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
      const brut = octets.subarray(debut, debut + e.tailleC);
      if (e.methode === 0) return brut.slice();
      if (e.methode === 8) {
        if (typeof DecompressionStream !== 'function') throw new ErreurNoyau('Ce navigateur ne sait pas lire ce .zip compressé.');
        const flux = new Blob([brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(flux).arrayBuffer());
      }
      throw new ErreurNoyau(`Compression non prise en charge dans le .zip : ${nom}`);
    }
    async function lire(nom) {
      const e = entrees.get(nom);
      if (!e) return null;
      if (e.tailleN > 100 * 1024 * 1024) throw new ErreurNoyau(`Fichier trop volumineux dans le .zip : ${nom}`);
      const debut = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
      const brut = octets.subarray(debut, debut + e.tailleC);
      if (e.methode === 0) return dec.decode(brut);
      if (e.methode === 8) {
        if (typeof DecompressionStream !== 'function') throw new ErreurNoyau('Ce navigateur ne sait pas lire ce .zip compressé.');
        const flux = new Blob([brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return dec.decode(await new Response(flux).arrayBuffer());
      }
      throw new ErreurNoyau('Méthode de compression non prise en charge dans ce .zip.');
    }
    return { noms: [...entrees.keys()], lire, lireOctets };
  }

  const JOURS_IMAGES = 31;
  const EXT_IMAGE = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' };

  /** lireImage(id) → Promise<Uint8Array|null> : fourni par l'app (les octets sont chiffrés sur l'appareil). */
  async function exporter({ periode = 'tout', encours = true, archives = true, couleurs = true, lireImage = null } = {}) {
    let annee = null;
    if (periode !== 'tout') {
      if (!/^\d{4}$/.test(String(periode))) throw new ErreurNoyau('Période invalide.');
      annee = Number(periode);
    }
    const d = donneesEchange(annee, { encours, archives, couleurs });
    const manifeste = {
      format: FORMAT_ECHANGE, version: VERSION_ECHANGE, app_version: Noyau.VERSION_APP, cree_le: maintenant(),
      periode: String(periode), contenu: { en_cours: encours, archives, couleurs }, totaux: totaux(d),
    };
    const json = (x) => JSON.stringify(x, null, 4);
    const fichiers = [
      ['manifeste.json', json(manifeste)], ['projets.json', json(d.projets)], ['taches.json', json(d.taches)],
      ['couleurs.json', json(d.couleurs)], ['taches.csv', construireCsv(d)],
    ];
    if (lireImage) {
      const tachesIds = new Set(d.taches.map((t) => t.uid));
      const descr = [];
      let manquantes = 0;
      for (const im of Object.values(M.images || {})) {
        if (!tachesIds.has(im.tache_id)) continue;
        let octets = null;
        try { octets = await lireImage(im.id, im.type); } catch { octets = null; }
        if (!octets) { manquantes++; continue; }
        const fichier = `images/${im.id}.${EXT_IMAGE[im.type] || 'webp'}`;
        fichiers.push([fichier, octets]);
        descr.push({ uid: im.id, tache_uid: im.tache_id, nom: im.nom, type: im.type, largeur: im.largeur, hauteur: im.hauteur, taille: im.taille, cree_le: im.cree_le, prise_le: im.prise_le || null, garder: Boolean(im.garder), fichier });
      }
      fichiers.push(['images.json', json(descr)]);
      manifeste.totaux.images = descr.length;
      if (manquantes) manifeste.images_manquantes = manquantes;
      fichiers[0] = ['manifeste.json', json(manifeste)];
    }
    const blob = creerZip(fichiers);
    M.derniere_sauvegarde = maintenant();
    changer();
    return { blob, nom: `taches-${periode}_${aujourdhui()}.zip` };
  }

  function chaineUid(v) {
    if (typeof v !== 'string' || !/^[A-Za-z0-9-]{8,36}$/.test(v)) throw new ErreurNoyau('Identifiant invalide dans le fichier.');
    return v;
  }

  function validerEchange(d) {
    for (const cle of ['projets', 'taches']) if (!Array.isArray(d[cle])) throw new ErreurNoyau(`Le fichier ne contient pas de liste « ${cle} ».`);
    const vus = new Set();
    const projets = [];
    for (const p of d.projets) {
      if (!p || typeof p !== 'object') throw new ErreurNoyau('Projet illisible dans le fichier.');
      const id = chaineUid(p.uid);
      if (vus.has(id)) continue;
      vus.add(id);
      const cree = dateHeure(p.cree_le);
      const groupement = typeof p.groupement === 'string' ? [...p.groupement.trim()].slice(0, 40).join('') : '';
      projets.push({
        uid: id, titre: titreProjet(p.titre ?? ''), groupement: groupement || GROUPEMENTS[0],
        couleur: COULEURS_PROJET.includes(p.couleur) ? p.couleur : 'blanc',
        couleur_depuis: dateHeure(p.couleur_depuis, true) || cree, ordre: parseInt(p.ordre, 10) || 0,
        complete_le: dateHeure(p.complete_le, true), archive_le: dateHeure(p.archive_le, true), cree_le: cree,
        lien: (() => { try { return lienValide(p.lien); } catch { return null; } })(),
      });
    }
    vus.clear();
    const taches = [];
    for (const t of d.taches) {
      if (!t || typeof t !== 'object') throw new ErreurNoyau('Tâche illisible dans le fichier.');
      const id = chaineUid(t.uid);
      if (vus.has(id)) continue;
      vus.add(id);
      taches.push({
        uid: id, projet_uid: chaineUid(t.projet_uid), texte: texteTache(t.texte ?? ''), ordre: parseInt(t.ordre, 10) || 0,
        cree_le: dateHeure(t.cree_le), finalise_le: dateHeure(t.finalise_le, true),
        recurrence: recurrenceValider(t.recurrence ?? null), copie_uid: t.copie_uid ? chaineUid(t.copie_uid) : null,
        couleur: COULEURS.includes(t.couleur) && t.couleur !== 'gris' ? t.couleur : 'blanc',
        couleur_depuis: COULEURS.includes(t.couleur) && t.couleur !== 'gris' && t.couleur !== 'blanc' ? (() => { try { return dateHeure(t.couleur_depuis, true); } catch { return null; } })() : null,
        lien: (() => { try { return lienValide(t.lien); } catch { return null; } })(),
      });
    }
    const couleurs = [];
    for (const c of d.couleurs || []) {
      if (!c || !COULEURS_PROJET.includes(c.couleur)) continue;
      couleurs.push({ projet_uid: chaineUid(c.projet_uid), couleur: c.couleur, le: dateHeure(c.le) });
    }
    return { projets, taches, couleurs };
  }

  async function lireFichierEchange(fichier) {
    const octets = new Uint8Array(await fichier.arrayBuffer());
    const zip = await lireZip(octets);
    const manifesteNom = zip.noms.find((n) => /(^|\/)manifeste\.json$/.test(n) && !n.includes('__MACOSX'));
    if (!manifesteNom) throw new ErreurNoyau("Ce .zip ne vient pas de l'outil de tâches (manifeste.json absent).");
    const prefixe = manifesteNom.slice(0, -'manifeste.json'.length);
    const json = async (nom, requis) => {
      const t = await zip.lire(prefixe + nom);
      if (t === null) { if (requis) throw new ErreurNoyau(`Fichier manquant dans le .zip : ${nom}`); return null; }
      try { return JSON.parse(t); } catch { throw new ErreurNoyau(`Fichier illisible dans le .zip : ${nom}`); }
    };
    const manifeste = await json('manifeste.json', true);
    if (manifeste.format !== FORMAT_ECHANGE) throw new ErreurNoyau("Ce .zip ne vient pas de l'outil de tâches.");
    const version = parseInt(manifeste.version, 10) || 0;
    if (version < 1 || version > VERSION_ECHANGE) throw new ErreurNoyau(`Format version ${version} : cette version de l'app ne sait pas le lire.`);
    const donnees = validerEchange({
      projets: await json('projets.json', true), taches: await json('taches.json', true), couleurs: (await json('couleurs.json', false)) || [],
    });
    let periode = String(manifeste.periode ?? 'tout');
    if (periode !== 'tout' && !/^\d{4}$/.test(periode)) periode = 'tout';
    // Images (2.14) : description + octets en clair dans le .zip
    const descr = (await json('images.json', false)) || [];
    donnees.images = [];
    if (Array.isArray(descr)) {
      for (const im of descr.slice(0, 5000)) {
        if (!im || typeof im !== 'object' || !/^[A-Za-z0-9-]{8,64}$/.test(String(im.uid || '')) || typeof im.fichier !== 'string') continue;
        const octets = await zip.lireOctets(prefixe + im.fichier);
        if (!octets || !octets.length) continue;
        donnees.images.push({
          uid: im.uid, tache_uid: String(im.tache_uid || ''), nom: String(im.nom || 'image').slice(0, 120),
          type: EXT_IMAGE[im.type] ? im.type : 'image/webp',
          largeur: Number(im.largeur) || 0, hauteur: Number(im.hauteur) || 0, taille: octets.length,
          cree_le: (() => { try { return dateHeure(im.cree_le, true) || maintenant(); } catch { return maintenant(); } })(),
          prise_le: (() => { try { return dateHeure(im.prise_le, true); } catch { return null; } })(),
          garder: Boolean(im.garder),
          octets,
        });
      }
    }
    return { manifeste, periode, donnees };
  }

  /** Écrit des données d'échange : 'fusion' (ajoute ce qui manque) ou 'remplacer' (la période du fichier). */
  function ecrireEchange(d, mode, periode) {
    const stats = { projets_ajoutes: 0, projets_mis_a_jour: 0, taches_ajoutees: 0, taches_ignorees: 0, images_ajoutees: 0, images_a_stocker: [] };
    if (mode === 'remplacer') {
      if (periode === 'tout') {
        for (const id of Object.keys(M.taches)) supprimerEnregistrement('taches', id);
        for (const id of Object.keys(M.projets)) supprimerEnregistrement('projets', id);
        M.couleurs = {};
      } else {
        for (const t of Object.values(M.taches)) if (t.cree_le.startsWith(`${periode}-`)) supprimerEnregistrement('taches', t.id);
      }
    }
    const ordres = Object.values(M.projets).map((p) => p.ordre);
    const ordreMax = ordres.length ? Math.max(...ordres) : 0;
    const nouveaux = new Set();
    {
      const l = groupementsAffiches();
      const ajout = [...new Set(d.projets.map((p) => p.groupement))].filter((g) => g && !l.includes(g));
      if (ajout.length) enregistrerGroupements([...l, ...ajout]);
    }
    d.projets.forEach((p, i) => {
      const existant = M.projets[p.uid];
      const champs = {
        titre: p.titre, groupement: p.groupement, couleur: p.couleur, couleur_depuis: p.couleur_depuis,
        complete_le: p.complete_le, archive_le: p.archive_le, lien: p.lien || null,
      };
      if (existant) {
        if (mode !== 'fusion') { Object.assign(existant, champs); toucher(existant); stats.projets_mis_a_jour++; }
        return;
      }
      ajouterEnregistrement('projets', { id: p.uid, ...champs, ordre: ordreMax + 1 + i, cree_le: p.cree_le });
      nouveaux.add(p.uid);
      stats.projets_ajoutes++;
    });
    const parProjet = new Map();
    for (const c of d.couleurs) { if (!parProjet.has(c.projet_uid)) parProjet.set(c.projet_uid, []); parProjet.get(c.projet_uid).push(c); }
    for (const [puid, liste] of parProjet) {
      if (!M.projets[puid]) continue;
      if (!nouveaux.has(puid)) {
        if (mode === 'fusion') continue;
        for (const c of Object.values(M.couleurs)) if (c.projet_id === puid) delete M.couleurs[c.id];
      }
      for (const c of liste) noterCouleur(puid, c.couleur, c.le);
    }
    for (const p of d.projets) if (nouveaux.has(p.uid) && !parProjet.has(p.uid)) noterCouleur(p.uid, p.couleur, p.couleur_depuis);
    for (const t of d.taches) {
      if (M.taches[t.uid] || !M.projets[t.projet_uid]) { stats.taches_ignorees++; continue; }
      ajouterEnregistrement('taches', {
        id: t.uid, projet_id: t.projet_uid, texte: t.texte, ordre: t.ordre, cree_le: t.cree_le,
        finalise_le: t.finalise_le, recurrence: t.recurrence, copie_uid: t.copie_uid,
        couleur: t.couleur || 'blanc', couleur_depuis: t.couleur_depuis || null, lien: t.lien || null,
      });
      stats.taches_ajoutees++;
    }
    for (const im of d.images || []) {
      const t = M.taches[im.tache_uid];
      if (!t || M.images[im.uid]) continue;
      ajouterEnregistrement('images', {
        id: im.uid, tache_id: t.id, projet_id: t.projet_id, nom: im.nom, type: im.type,
        largeur: im.largeur, hauteur: im.hauteur, taille: im.taille, cree_le: im.cree_le, prise_le: im.prise_le || null, garder: Boolean(im.garder),
      });
      stats.images_a_stocker.push({ id: im.uid, type: im.type, octets: im.octets });
      stats.images_ajoutees++;
    }
    if (mode === 'remplacer') for (const im of Object.values(M.images)) if (!M.taches[im.tache_id]) supprimerEnregistrement('images', im.id);
    if (mode === 'remplacer' && periode !== 'tout') {
      const dansFichier = new Set(d.projets.map((p) => p.uid));
      for (const p of Object.values(M.projets)) {
        if (!p.cree_le.startsWith(`${periode}-`) || dansFichier.has(p.id)) continue;
        if (!Object.values(M.taches).some((t) => t.projet_id === p.id)) {
          for (const c of Object.values(M.couleurs)) if (c.projet_id === p.id) delete M.couleurs[c.id];
          supprimerEnregistrement('projets', p.id);
        }
      }
    }
    changer();
    return stats;
  }

  /* =========================================================
   * Interface publique
   * ======================================================= */

  window.Noyau = {
    VERSION_APP: '2.16.2',
    GROUPEMENTS, COULEURS, COULEURS_PROJET, PALETTE_PROJET, FAMILLES_PROJET, ErreurNoyau,
    get groupements() { return groupementsAffiches(); },
    JOURS_IMAGES: 31,
    api,
    get modele() { return M; },
    charger(m) { M = m ? normaliser(m) : modeleVide(); compteImagesCache = null; },
    vider() { M = modeleVide(); },
    modeleVide, fusionner, signature, remplacerTout, normaliser,
    surChangement(f) { surChangement = f; },
    reglages() { return copie(M.reglages); },
    changerReglages(r) { Object.assign(M.reglages, r, { maj: horodatage() }); changer(); },
    exporter, lireFichierEchange, ecrireEchange, totaux,
    echeancesAVenir,
    outils: { recurrenceProchaine, recurrenceValider, texteBrut, maintenant, aujourdhui, crc32, creerZip, lireZip },
  };

  function normaliser(m) {
    const n = { ...modeleVide(), ...copie(m) };
    for (const k of ['projets', 'taches', 'couleurs', 'supprimes', 'echeances', 'images']) if (!n[k] || typeof n[k] !== 'object') n[k] = {};
    if (!n.reglages || typeof n.reglages !== 'object') n.reglages = { veille_minutes: 15, maj: 0 };
    return n;
  }
})();
