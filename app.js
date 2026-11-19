/* Mes tâches · interface (sans dépendance, sans serveur) */
(() => {
  'use strict';

  // L'app refuse de s'afficher dans le cadre d'un autre site (protection contre le détournement de clics).
  if (window.top !== window.self) { document.documentElement.replaceChildren(); return; }

  /* =========================================================
   * Constantes
   * ======================================================= */

  const COULEURS = {
    'vert':     { nom: 'vert',          groupe: 'urgent' },
    'jaune':    { nom: 'jaune',         groupe: 'urgent' },
    'orange':   { nom: 'orange',        groupe: 'urgent' },
    'rouge':    { nom: 'rouge',         groupe: 'urgent' },
    'vert-p':   { nom: 'vert pastel',   groupe: 'aprevoir' },
    'jaune-p':  { nom: 'jaune pastel',  groupe: 'aprevoir' },
    'orange-p': { nom: 'orange pastel', groupe: 'aprevoir' },
    'rouge-p':  { nom: 'rouge pastel',  groupe: 'aprevoir' },
    'blanc':    { nom: 'blanc',         groupe: 'defaut' },
    'gris':     { nom: 'gris',          groupe: 'complete' },
  };
  const FILTRES_COULEUR = [
    { cle: 'toutes', libelle: 'Toutes les couleurs' },
    { cle: 'urgent', libelle: 'Urgent', points: ['vert', 'jaune', 'orange', 'rouge'] },
    { cle: 'aprevoir', libelle: 'À prévoir', points: ['vert-p', 'jaune-p', 'orange-p', 'rouge-p'] },
    { cle: 'defaut', libelle: 'Par défaut', points: ['blanc'] },
  ];
  const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  const ICONES = {
    poignee: ['M9 6h.01', 'M15 6h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18h.01', 'M15 18h.01'],
    menu: ['M6 12h.01', 'M12 12h.01', 'M18 12h.01'],
    plus: ['M12 5v14', 'M5 12h14'],
    imprimer: ['M6 9V3h12v6', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v7H6z'],
    sauvegarde: ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4'],
    sortie: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
    calendrier: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18', 'M8 3v4', 'M16 3v4'],
    bas: ['M6 9l6 6 6-6'],
    gauche: ['M15 6l-6 6 6 6'],
    droite: ['M9 6l6 6-6 6'],
    recurrence: ['M17 2l4 4-4 4', 'M3 11V9a3 3 0 0 1 3-3h15', 'M7 22l-4-4 4-4', 'M21 13v2a3 3 0 0 1-3 3H3'],
    fermer: ['M6 6l12 12', 'M18 6L6 18'],
    annuler: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3'],
    coche: ['M5 12l5 5 9-11'],
    telecharger: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16'],
    televerser: ['M12 15V3', 'M7 8l5-5 5 5', 'M4 21h16'],
    oeil: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
    cadenas: ['M6 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', 'M8 11V7a4 4 0 0 1 8 0v4'],
    archive: ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4'],
    corbeille: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6'],
    cle: ['M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3.1', 'M15 7h.01'],
    compte: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 21a8 8 0 0 1 16 0'],
    nuage: ['M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18H7z'],
    horloge: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
    appareil: ['M4 5h16v11H4z', 'M2 20h20'],
    courriel: ['M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z', 'M3 7l9 6 9-6'],
  };

  /* =========================================================
   * État
   * ======================================================= */

  const S = {
    ouvert: false,
    groupements: Noyau.GROUPEMENTS,
    installation: null,
    distantEnAttente: false,
    compte: { info: null, copies: null, copiesErreur: null, toutesCopies: false },
    vue: 'encours',
    projets: [],
    taches: [],
    couleurs: [],
    compteArchives: 0,
    chargeLe: 0,
    filtre: { groupement: null, couleur: 'toutes', du: null, au: null },
    arch: { type: 'finalise', du: null, au: null, groupement: '', couleur: 'toutes', donnees: null, chargement: false },
    sauv: { apercu: null, lu: null, erreur: null, mode: 'fusion', periode: null, envoi: false },
    completesOuverts: true,
    ajoutEnCours: null,
    editionTitre: null,
    edition: 0,
  };

  /* =========================================================
   * Outils DOM
   * ======================================================= */

  const $ = (sel, el = document) => el.querySelector(sel);

  function h(tag, props, ...enfants) {
    const el = document.createElement(tag);
    if (props) {
      for (const [cle, val] of Object.entries(props)) {
        if (val === null || val === undefined || val === false) continue;
        if (cle === 'class') el.className = val;
        else if (cle === 'text') el.textContent = val;
        else if (cle.startsWith('on') && typeof val === 'function') el.addEventListener(cle.slice(2), val);
        else if (cle === 'dataset') Object.assign(el.dataset, val);
        else if (cle in el && typeof val !== 'string') el[cle] = val;
        else el.setAttribute(cle, val === true ? '' : val);
      }
    }
    ajouter(el, enfants);
    return el;
  }

  function ajouter(el, enfants) {
    for (const e of enfants) {
      if (e === null || e === undefined || e === false) continue;
      if (Array.isArray(e)) ajouter(el, e);
      else el.append(e instanceof Node ? e : document.createTextNode(String(e)));
    }
  }

  function icone(nom, taille = 16, epaisseur = 2) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', taille);
    svg.setAttribute('height', taille);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', nom === 'poignee' || nom === 'menu' ? 3.4 : epaisseur);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    for (const d of ICONES[nom] || []) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      svg.append(p);
    }
    return svg;
  }

  function points(cles) {
    return h('span', { class: 'points', 'aria-hidden': 'true' },
      cles.map((c) => h('span', { class: 'point fond-couleur', 'data-couleur': c })));
  }

  /* =========================================================
   * Dates
   * ======================================================= */

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isoComplet = (d) => `${iso(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  function lireDate(s) {
    if (!s) return null;
    const [j, hr = '00:00:00'] = s.split(' ');
    const [a, m, d] = j.split('-').map(Number);
    const [hh, mm, ss] = hr.split(':').map(Number);
    return new Date(a, m - 1, d, hh || 0, mm || 0, ss || 0);
  }

  const aujourdhui = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const lundiDe = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const joursEntre = (a, b) => Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);

  const fmtCourt = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short' });
  const fmtCourtAn = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtLong = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtJourMois = new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });

  function dateCourte(d) {
    if (!d) return '';
    return d.getFullYear() === new Date().getFullYear() ? fmtCourt.format(d) : fmtCourtAn.format(d);
  }
  const heure = (d) => `${d.getHours()} h ${pad(d.getMinutes())}`;
  const dateLongue = (d) => `${fmtLong.format(d)} à ${heure(d)}`;

  function plage(du, au) {
    if (!du && !au) return null;
    const a = lireDate(du), b = lireDate(au || du);
    if (iso(a) === iso(b)) return `Le ${fmtCourtAn.format(a)}`;
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
      return `Du ${a.getDate() === 1 ? '1er' : a.getDate()} au ${fmtCourtAn.format(b)}`;
    }
    if (a.getFullYear() === b.getFullYear()) return `Du ${fmtCourt.format(a)} au ${fmtCourtAn.format(b)}`;
    return `Du ${fmtCourtAn.format(a)} au ${fmtCourtAn.format(b)}`;
  }

  /* =========================================================
   * Texte des tâches : gras noté **ainsi**, \* pour une astérisque
   * ======================================================= */

  function decouper(s) {
    const segs = [];
    let gras = false, cur = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\' && i + 1 < s.length) { cur += s[++i]; continue; }
      if (c === '*' && s[i + 1] === '*') {
        if (cur) segs.push({ t: cur, b: gras });
        cur = ''; gras = !gras; i++;
        continue;
      }
      cur += c;
    }
    if (cur) segs.push({ t: cur, b: gras });
    return segs;
  }

  function texteBrut(s) { return decouper(s).map((x) => x.t).join(''); }

  function afficherTexte(el, s) {
    el.replaceChildren(...decouper(s).map((x) => (x.b ? h('strong', null, x.t) : document.createTextNode(x.t))));
  }

  function serialiser(el) {
    const segs = [];
    const pousser = (t, b) => {
      if (!t) return;
      const der = segs[segs.length - 1];
      if (der && der.b === b) der.t += t; else segs.push({ t, b });
    };
    const parcourir = (n, gras) => {
      if (n.nodeType === Node.TEXT_NODE) { pousser(n.data, gras); return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const tag = n.tagName;
      if (tag === 'BR') { pousser(' ', gras); return; }
      const poids = parseInt(n.style && n.style.fontWeight, 10);
      const b = gras || tag === 'B' || tag === 'STRONG' || (poids >= 600) || n.style?.fontWeight === 'bold';
      if ((tag === 'DIV' || tag === 'P') && segs.length) pousser(' ', gras);
      for (const c of n.childNodes) parcourir(c, b);
    };
    for (const c of el.childNodes) parcourir(c, false);
    // Espaces : un seul, et pas d'espace en bordure de gras
    let sortie = '';
    for (const sg of segs) {
      let t = sg.t.replace(/\s+/g, ' ');
      if (!sg.b) { sortie += echapper(t); continue; }
      const debut = t.match(/^\s*/)[0], fin = t.match(/\s*$/)[0];
      const coeur = t.trim();
      sortie += debut + (coeur ? `**${echapper(coeur)}**` : '') + (coeur ? fin : '');
    }
    return sortie.replace(/\s+/g, ' ').trim();
  }
  const echapper = (t) => t.replace(/\\/g, '\\\\').replace(/\*/g, '\\*');

  /* =========================================================
   * API
   * ======================================================= */

  class ErreurReseau extends Error {}

  /** Même interface qu'avant, mais tout se passe dans le navigateur (aucun serveur). */
  async function api(action, { donnees, params } = {}) {
    try { return await Noyau.api(action, { donnees, params }); }
    catch (e) { throw new ErreurReseau(e.message); }
  }

  async function essayer(fn) {
    try { return await fn(); }
    catch (e) {
      if (e.message !== 'Session expirée.') toast(e.message || String(e), { erreur: true });
      return undefined;
    }
  }

  /* =========================================================
   * Messages, confirmations, fenêtres flottantes
   * ======================================================= */

  function toast(message, { annuler, action, erreur = false, duree } = {}) {
    const zone = $('#toasts');
    const bouton = annuler ? { libelle: 'Annuler', fn: annuler } : action;
    const el = h('div', { class: 'toast' + (erreur ? ' erreur' : '') + (bouton ? '' : ' sans-action'), role: erreur ? 'alert' : 'status' },
      h('span', null, message),
      bouton && h('button', { type: 'button', onclick: () => { retirer(); bouton.fn(); } }, bouton.libelle));
    zone.replaceChildren(el);
    const minuterie = setTimeout(retirer, duree || (bouton ? 7000 : 4000));
    function retirer() { clearTimeout(minuterie); el.remove(); }
  }

  function confirmer(titre, message, { ok = 'Confirmer', danger = false } = {}) {
    return new Promise((resoudre) => {
      const dlg = h('dialog', { class: 'confirmer', 'aria-labelledby': 'dlg-titre' },
        h('h2', { id: 'dlg-titre' }, titre),
        h('p', null, message),
        h('div', { class: 'pied-pop' },
          h('button', { type: 'button', class: 'bouton', onclick: () => fermer(false) }, 'Annuler'),
          h('button', { type: 'button', class: 'bouton ' + (danger ? 'bouton-danger' : 'bouton-principal'), onclick: () => fermer(true) }, ok)));
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); fermer(false); });
      document.body.append(dlg);
      dlg.showModal();
      function fermer(v) { dlg.close(); dlg.remove(); resoudre(v); }
    });
  }

  let pop = null;

  function ouvrirPopover(ancre, contenu, { classe = '', aligner = 'droite', titre } = {}) {
    fermerPopover();
    const el = h('div', { class: 'popover ' + classe, role: 'dialog', 'aria-label': titre || null }, contenu);
    document.body.append(el);
    pop = { el, ancre };
    ancre.setAttribute('aria-expanded', 'true');
    positionner();
    setTimeout(() => {
      document.addEventListener('pointerdown', clicDehors, true);
      document.addEventListener('keydown', echapPop, true);
      window.addEventListener('resize', positionner);
    });
    const premier = el.querySelector('[aria-pressed="true"], [aria-checked="true"], button, input, select');
    if (premier) premier.focus({ preventScroll: true });
    return el;
  }

  function positionner() {
    if (!pop) return;
    const { el, ancre } = pop;
    const r = ancre.getBoundingClientRect();
    const l = el.offsetWidth, ht = el.offsetHeight;
    let gauche = pop.aligner === 'gauche' ? r.left : r.right - l;
    if (el.classList.contains('a-gauche-ancre')) gauche = r.left;
    gauche = Math.max(8, Math.min(gauche, window.innerWidth - l - 8));
    let haut = r.bottom + 8;
    if (haut + ht > window.innerHeight - 8 && r.top - ht - 8 > 8) haut = r.top - ht - 8;
    el.style.left = `${gauche + window.scrollX}px`;
    el.style.top = `${haut + window.scrollY}px`;
  }

  function fermerPopover(rendreFocus = false) {
    if (!pop) return;
    const { el, ancre } = pop;
    pop = null;
    el.remove();
    ancre.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', clicDehors, true);
    document.removeEventListener('keydown', echapPop, true);
    window.removeEventListener('resize', positionner);
    if (rendreFocus && ancre.isConnected) ancre.focus();
  }

  function clicDehors(e) {
    if (pop && !pop.el.contains(e.target) && !pop.ancre.contains(e.target)) fermerPopover();
  }
  function echapPop(e) {
    if (e.key === 'Escape' && pop) { e.stopPropagation(); fermerPopover(true); }
  }

  /* =========================================================
   * Édition sur place (titre de projet, texte de tâche)
   * ======================================================= */

  let editionActive = null;

  function editer(el, { valeur, gras = true, toutSelectionner = false, surValider, surEchap, surVide }) {
    if (editionActive) editionActive.terminer(true);
    S.edition++;
    const origine = valeur;
    el.contentEditable = 'true';
    el.spellcheck = true;
    el.focus();
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(el);
    if (!toutSelectionner) r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);

    let fini = false;
    const etat = {
      terminer(valider, viaEntree = false) {
        if (fini) return;
        fini = true;
        editionActive = null;
        S.edition--;
        el.removeEventListener('keydown', touche);
        el.removeEventListener('blur', perte);
        el.removeEventListener('paste', coller);
        el.contentEditable = 'false';
        cacherBarreGras();
        const nouvelle = gras ? serialiser(el) : el.textContent.replace(/\s+/g, ' ').trim();
        if (!valider) {
          if (gras) afficherTexte(el, origine); else el.textContent = origine;
          if (surEchap) surEchap();
          return;
        }
        if (nouvelle === '') {
          if (surVide) { surVide(viaEntree); return; }
          if (gras) afficherTexte(el, origine); else el.textContent = origine;
          return;
        }
        if (gras) afficherTexte(el, nouvelle);
        if (surValider) surValider(nouvelle, nouvelle !== origine, viaEntree);
      },
    };
    editionActive = etat;

    function touche(e) {
      if (e.key === 'Enter') { e.preventDefault(); etat.terminer(true, true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); etat.terminer(false); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (gras) document.execCommand('bold');
      } else if ((e.ctrlKey || e.metaKey) && ['i', 'I', 'u', 'U'].includes(e.key)) {
        e.preventDefault();
      }
    }
    function perte() { setTimeout(() => { if (document.activeElement !== el) etat.terminer(true); }, 0); }
    function coller(e) {
      e.preventDefault();
      const texte = (e.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' ');
      document.execCommand('insertText', false, texte);
    }
    el.addEventListener('keydown', touche);
    el.addEventListener('blur', perte);
    el.addEventListener('paste', coller);
    el.dataset.gras = gras ? '1' : '';
    return etat;
  }

  /* Petit bouton « B » au-dessus d'une sélection (utile au doigt) */
  let barreGras = null;
  function cacherBarreGras() { if (barreGras) { barreGras.remove(); barreGras = null; } }
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    const el = editionActive && document.activeElement;
    if (!el || el.contentEditable !== 'true' || el.dataset.gras !== '1' || !sel.rangeCount || sel.isCollapsed || !el.contains(sel.anchorNode)) {
      cacherBarreGras();
      return;
    }
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!barreGras) {
      barreGras = h('div', { class: 'barre-gras' },
        h('button', { type: 'button', 'aria-label': 'Gras', onpointerdown: (e) => { e.preventDefault(); document.execCommand('bold'); } }, 'B'),
        h('span', null, navigator.platform?.includes('Mac') ? '⌘B' : 'Ctrl+B'));
      document.body.append(barreGras);
    }
    barreGras.style.left = `${Math.max(8, r.left + window.scrollX)}px`;
    barreGras.style.top = `${r.top + window.scrollY - 48}px`;
  });

  /* =========================================================
   * Données
   * ======================================================= */

  async function charger() {
    const d = await api('donnees');
    S.projets = d.projets;
    S.taches = d.taches;
    S.couleurs = d.couleurs;
    S.compteArchives = d.compte_archives;
    S.chargeLe = Date.now();
  }

  const projetPar = (id) => S.projets.find((p) => p.id === id);
  const tachesDe = (pid) => S.taches.filter((t) => t.projet_id === pid).sort((a, b) => a.ordre - b.ordre || a.id - b.id);

  /** Couleur qu'avait un projet à un moment donné (historique des couleurs). */
  function couleurA(historique, projet, quand) {
    let c = null;
    for (const x of historique) {
      if (x.projet_id !== projet.id) continue;
      if (x.le <= quand) c = x.couleur; else if (c === null) c = x.couleur;
    }
    return c || projet.couleur;
  }

  function libelleRecurrence(r) {
    if (!r) return '';
    const n = r.intervalle || 1;
    switch (r.type) {
      case 'jour': return n === 1 ? 'chaque jour' : `tous les ${n} jours`;
      case 'semaine': return n === 1 ? `chaque ${JOURS[r.jour_semaine - 1]}` : `aux ${n} semaines (${JOURS[r.jour_semaine - 1]})`;
      case 'mois': {
        const j = r.jour_mois === 'dernier' ? 'dernier jour' : `le ${r.jour_mois}`;
        return n === 1 ? `chaque mois (${j})` : `tous les ${n} mois (${j})`;
      }
      case 'annee': {
        const j = `${r.jour}${r.jour === 1 ? 'er' : ''} ${MOIS[r.mois - 1]}`;
        return n === 1 ? `chaque année (${j})` : `tous les ${n} ans (${j})`;
      }
      case 'date': return `le ${fmtCourtAn.format(lireDate(r.date))}`;
    }
    return '';
  }

  /* =========================================================
   * Démarrage, coffre, verrouillage
   * ======================================================= */

  async function demarrer() {
    enregistrerServiceWorker();
    Noyau.surChangement(() => Sync.marquerChangement());
    Sync.surStatut(majPuceSync);
    Agenda.surChangement(majAgenda);
    Sync.surDistant(() => { if (S.ouvert) rafraichirDepuisDistant(true); });
    let info;
    try {
      info = await Sync.chargerEtat();
    } catch (e) {
      ecranSecurite(ecranMessage("L'app ne peut pas démarrer", `Le navigateur refuse le stockage local (${e.message}). Es-tu en navigation privée ?`));
      return;
    }
    if (!info.coffreLocal) { afficherAccueil(); return; }
    let repris = false;
    try { repris = await Sync.reprendre(); } catch { repris = false; }
    if (repris) await entrer();
    else afficherDeverrouillage();
  }

  async function entrer() {
    S.ouvert = true;
    $('#app').replaceChildren(h('p', { class: 'chargement' }, 'Chargement…'));
    await charger();
    S.vue = 'encours';
    rendre();
    demarrerVeille();
    Sync.synchroniser().catch(() => {});
    Agenda.demarrer().catch(() => {});
  }

  function marque() {
    return h('div', { class: 'marque' },
      h('span', { class: 'barres', 'aria-hidden': 'true' },
        h('span', { class: 'fond-couleur', 'data-couleur': 'rouge' }),
        h('span', { class: 'fond-couleur', 'data-couleur': 'jaune' }),
        h('span', { class: 'fond-couleur', 'data-couleur': 'gris' })),
      'Mes tâches');
  }

  function ecranSecurite(carte) {
    fermerPopover();
    $('#app').replaceChildren(h('div', { class: 'ecran-connexion' }, marque(), carte,
      h('p', { class: 'pied-connexion' }, icone('cadenas', 14), `Chiffré sur ton appareil · version ${Noyau.VERSION_APP}`)));
  }

  function ecranMessage(titre, message) {
    return h('div', { class: 'formulaire' }, h('h1', null, titre), h('p', { class: 'alerte erreur', role: 'alert' }, message),
      h('button', { type: 'button', class: 'bouton', onclick: () => location.reload() }, 'Réessayer'));
  }

  function champMotDePasse(id, libelle, autocomplete) {
    const input = h('input', { id, type: 'password', autocomplete, required: true, spellcheck: 'false' });
    return h('div', { class: 'champ' }, h('label', { for: id }, libelle),
      h('div', { class: 'mdp' }, input,
        h('button', {
          type: 'button', 'aria-label': 'Afficher le mot de passe', 'aria-pressed': 'false',
          onclick: (e) => {
            const montre = input.type === 'password';
            input.type = montre ? 'text' : 'password';
            e.currentTarget.setAttribute('aria-pressed', String(montre));
          },
        }, icone('oeil', 18))));
  }

  /** Bouton qui affiche « … » pendant une opération et réactive ensuite. */
  async function occupe(bouton, texte, fn) {
    const avant = bouton.textContent;
    bouton.disabled = true;
    bouton.textContent = texte;
    try { return await fn(); } finally { if (bouton.isConnected) { bouton.disabled = false; bouton.textContent = avant; } }
  }

  /* ---------- Premier lancement sur cet appareil ---------- */

  function afficherAccueil() {
    const erreur = h('p', { class: 'alerte erreur', role: 'alert', hidden: true });
    const google = Sync.googleConfigure();
    const boutonDrive = h('button', { type: 'button', class: 'bouton bouton-principal' }, icone('nuage', 18), 'Continuer avec Google Drive');
    const boutonLocal = h('button', { type: 'button', class: google ? 'bouton' : 'bouton bouton-principal' }, google ? 'Commencer sans Google Drive' : 'Commencer');

    boutonDrive.addEventListener('click', () => occupe(boutonDrive, 'Connexion à Google…', async () => {
      erreur.hidden = true;
      try {
        await Sync.connecterGoogle();
        const trouve = await Sync.recupererDuDrive();
        if (trouve) afficherDeverrouillage({ nouvelAppareil: true });
        else afficherCreation({ drive: true });
      } catch (e) { erreur.textContent = e.message; erreur.hidden = false; }
    }));
    boutonLocal.addEventListener('click', () => afficherCreation({ drive: false }));

    ecranSecurite(h('div', { class: 'formulaire' },
      h('h1', null, 'Bienvenue'),
      h('p', { class: 'aide' }, 'Tes tâches sont chiffrées avec ton mot de passe avant de quitter cet appareil. Avec Google Drive, tu les retrouves sur ton téléphone, sur un autre ordinateur, et même si cet appareil est perdu.'),
      erreur,
      google && boutonDrive,
      google && h('p', { class: 'aide' }, 'Déjà utilisé ailleurs ? Choisis Google Drive : ton coffre sera retrouvé.'),
      boutonLocal,
      !google && h('p', { class: 'aide' }, 'La synchronisation Google Drive sera disponible dès qu’elle sera configurée. Tu pourras la brancher dans Compte.')));
  }

  function afficherCreation({ drive }) {
    const erreur = h('p', { class: 'alerte erreur', role: 'alert', hidden: true });
    const bouton = h('button', { type: 'submit', class: 'bouton bouton-principal' }, 'Créer mon coffre');
    const form = h('form', { class: 'formulaire', novalidate: true },
      h('h1', null, 'Choisis ton mot de passe'),
      h('p', { class: 'aide' }, "Il chiffre tes tâches. Il n'est envoyé nulle part : personne, pas même Google, ne peut le lire ni le récupérer."),
      erreur,
      champMotDePasse('mdp1', 'Mot de passe (12 caractères ou plus)', 'new-password'),
      champMotDePasse('mdp2', 'Confirmer le mot de passe', 'new-password'),
      h('p', { class: 'aide' }, 'Astuce : quelques mots reliés par des tirets, faciles à retenir pour toi, impossibles à deviner pour les autres.'),
      bouton,
      h('button', { type: 'button', class: 'lien', onclick: () => afficherAccueil() }, 'Retour'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const mdp = $('#mdp1', form).value;
      erreur.hidden = true;
      if (mdp !== $('#mdp2', form).value) { erreur.textContent = 'Les deux mots de passe ne sont pas identiques.'; erreur.hidden = false; return; }
      try { Coffre.verifierMotDePasse(mdp); } catch (err) { erreur.textContent = err.message; erreur.hidden = false; return; }
      occupe(bouton, 'Création du coffre…', async () => {
        try {
          const cle = await Sync.creer(mdp);
          afficherCleRecuperation(cle, () => entrer().then(() => {
            if (drive) toast('Coffre créé et enregistré dans ton Google Drive.');
          }));
        } catch (err) { erreur.textContent = err.message; erreur.hidden = false; }
      });
    });
    ecranSecurite(form);
    $('#mdp1', form).focus();
  }

  function blocCle(cle) {
    const copier = h('button', { type: 'button', class: 'bouton bouton-petit' }, 'Copier');
    copier.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(cle); copier.textContent = 'Copiée'; } catch { copier.textContent = 'Copie impossible'; }
    });
    const telecharger = h('button', { type: 'button', class: 'bouton bouton-petit' }, 'Télécharger (.txt)');
    telecharger.addEventListener('click', () => {
      const texte = `Mes tâches · clé de récupération\r\n\r\n${cle}\r\n\r\nCréée le ${fmtJourMois.format(new Date())}.\r\nElle remplace ton mot de passe en cas d'oubli. Garde-la en lieu sûr, à l'abri des regards.\r\n`;
      const url = URL.createObjectURL(new Blob([texte], { type: 'text/plain;charset=utf-8' }));
      const a = h('a', { href: url, download: 'mes-taches-cle-de-recuperation.txt' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
    return h('div', { class: 'cle-recup' }, h('p', { class: 'cle-texte' }, cle), h('div', { class: 'rangee' }, copier, telecharger));
  }

  function afficherCleRecuperation(cle, suite) {
    const coche = h('input', { type: 'checkbox' });
    const bouton = h('button', { type: 'button', class: 'bouton bouton-principal', disabled: true, onclick: suite }, 'Continuer');
    coche.addEventListener('change', () => { bouton.disabled = !coche.checked; });
    ecranSecurite(h('div', { class: 'formulaire' },
      h('h1', null, 'Ta clé de récupération'),
      h('p', { class: 'aide' }, "Si tu oublies ton mot de passe, cette clé est le seul moyen de retrouver tes tâches. Personne d'autre ne peut t'aider : c'est le prix du chiffrement."),
      blocCle(cle),
      h('p', { class: 'aide' }, 'Range-la dans ton gestionnaire de mots de passe, ou imprime-la et garde-la en lieu sûr. Pas dans ton Drive à côté du coffre.'),
      h('label', { class: 'option' }, coche, "J'ai rangé ma clé de récupération en lieu sûr"),
      bouton));
  }

  function afficherDeverrouillage({ nouvelAppareil = false, raison } = {}) {
    S.ouvert = false;
    const erreur = h('p', { class: 'alerte erreur', role: 'alert', hidden: true });
    const bouton = h('button', { type: 'submit', class: 'bouton bouton-principal' }, 'Déverrouiller');
    const identifiant = h('input', { type: 'text', autocomplete: 'username', value: 'Mes tâches', hidden: true, readonly: true });
    const form = h('form', { class: 'formulaire', novalidate: true },
      h('h1', null, nouvelAppareil ? 'Coffre trouvé dans ton Drive' : 'Mes tâches est verrouillé'),
      nouvelAppareil
        ? h('p', { class: 'aide' }, 'Entre ton mot de passe pour ouvrir tes tâches sur cet appareil.')
        : raison === 'veille' && h('p', { class: 'aide' }, 'Verrouillé après une période sans activité.'),
      identifiant,
      erreur,
      champMotDePasse('mdp', 'Mot de passe', 'current-password'),
      h('button', { type: 'button', class: 'lien', onclick: () => afficherRecuperation() }, 'Mot de passe oublié ?'),
      bouton);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      erreur.hidden = true;
      const mdp = $('#mdp', form).value;
      if (!mdp) return;
      occupe(bouton, 'Ouverture…', async () => {
        try {
          const ok = await Sync.deverrouiller(mdp);
          if (!ok) {
            erreur.textContent = 'Mot de passe incorrect.';
            erreur.hidden = false;
            $('#mdp', form).select();
            return;
          }
          // Profite du clic pour reconnecter Google Drive, si le navigateur le permet encore.
          const etat = Sync.etat();
          if (etat.driveActif && !Sync.jetonValide() && navigator.userActivation?.isActive) {
            Sync.connecterGoogle().then(() => Sync.synchroniser()).catch(() => {});
          }
          await entrer();
        } catch (err) { erreur.textContent = err.message; erreur.hidden = false; }
      });
    });
    ecranSecurite(form);
    $('#mdp', form).focus();
  }

  function afficherRecuperation() {
    const erreur = h('p', { class: 'alerte erreur', role: 'alert', hidden: true });
    const bouton = h('button', { type: 'submit', class: 'bouton bouton-principal' }, 'Changer le mot de passe');
    const cle = h('input', { id: 'cle-recup', type: 'text', class: 'champ-cle', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX' });
    const form = h('form', { class: 'formulaire', novalidate: true },
      h('h1', null, 'Mot de passe oublié'),
      h('p', { class: 'aide' }, 'Entre ta clé de récupération (avec ou sans tirets), puis choisis un nouveau mot de passe.'),
      erreur,
      h('div', { class: 'champ' }, h('label', { for: 'cle-recup' }, 'Clé de récupération'), cle),
      champMotDePasse('nmdp1', 'Nouveau mot de passe (12 caractères ou plus)', 'new-password'),
      champMotDePasse('nmdp2', 'Confirmer le nouveau mot de passe', 'new-password'),
      bouton,
      h('button', { type: 'button', class: 'lien', onclick: () => afficherDeverrouillage() }, 'Retour'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      erreur.hidden = true;
      const mdp = $('#nmdp1', form).value;
      if (mdp !== $('#nmdp2', form).value) { erreur.textContent = 'Les deux mots de passe ne sont pas identiques.'; erreur.hidden = false; return; }
      if (Coffre.normaliserCle(cle.value).length !== 32) { erreur.textContent = 'La clé de récupération compte 32 caractères.'; erreur.hidden = false; return; }
      try { Coffre.verifierMotDePasse(mdp); } catch (err) { erreur.textContent = err.message; erreur.hidden = false; return; }
      occupe(bouton, 'Vérification…', async () => {
        try {
          await Sync.recuperer(cle.value, mdp);
          await entrer();
          toast('Nouveau mot de passe enregistré.');
        } catch (err) { erreur.textContent = err.message; erreur.hidden = false; }
      });
    });
    ecranSecurite(form);
    cle.focus();
  }

  /* ---------- Mise en veille ---------- */

  let derniereActivite = Date.now();
  let minuterieVeille = null;

  function demarrerVeille() {
    derniereActivite = Date.now();
    clearInterval(minuterieVeille);
    minuterieVeille = setInterval(verifierVeille, 10000);
  }

  function activite() {
    if (!S.ouvert) return;
    derniereActivite = Date.now();
    Sync.prolonger().catch(() => {});
  }
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) document.addEventListener(ev, activite, { passive: true, capture: true });

  function verifierVeille() {
    if (!S.ouvert) return;
    const minutes = Number(Noyau.reglages().veille_minutes) || 0;
    if (minutes > 0 && Date.now() - derniereActivite >= minutes * 60000) verrouillerMaintenant('veille');
  }

  async function verrouillerMaintenant(raison) {
    if (editionActive) editionActive.terminer(true);
    fermerPopover();
    document.querySelectorAll('dialog[open]').forEach((d) => { d.close(); d.remove(); });
    S.ouvert = false;
    clearInterval(minuterieVeille);
    S.projets = []; S.taches = []; S.couleurs = []; S.arch.donnees = null; S.compte.info = null;
    Agenda.vider();
    $('#toasts').replaceChildren();
    await Sync.verrouiller();
    afficherDeverrouillage({ raison });
  }

  /* ---------- Indicateur d'enregistrement ---------- */

  const TEXTES_SYNC = {
    local: ['Sur cet appareil', 'Google Drive n’est pas branché. Voir Compte.'],
    synchro: ['Enregistrement…', 'Envoi vers Google Drive'],
    attente: ['Enregistrement…', 'Les derniers changements partent vers Google Drive'],
    ok: ['Enregistré', 'Tout est enregistré dans Google Drive'],
    'hors-ligne': ['Hors ligne', 'Les changements sont gardés sur cet appareil et partiront au retour d’Internet.'],
    reconnexion: ['Reconnecter Drive', 'La connexion à Google a expiré. Clique pour la renouveler : tes changements sont gardés en attendant.'],
    erreur: ['Erreur Drive', ''],
  };

  function puceSync() {
    const b = h('button', { type: 'button', class: 'puce-sync', id: 'puce-sync', onclick: clicPuceSync });
    remplirPuce(b, Sync.etat());
    return b;
  }

  function remplirPuce(b, e) {
    const [texte, titre] = TEXTES_SYNC[e.statut] || TEXTES_SYNC.local;
    b.dataset.statut = e.statut;
    b.title = e.statut === 'erreur' ? e.message : e.statut === 'ok' && e.dernierEnvoi ? `${titre} (${heure(new Date(e.dernierEnvoi))})` : titre;
    b.replaceChildren(h('span', { class: 'puce-point', 'aria-hidden': 'true' }), texte);
  }

  function majPuceSync(e) {
    const b = $('#puce-sync');
    if (b) remplirPuce(b, e);
  }

  function clicPuceSync() {
    const e = Sync.etat();
    if (e.statut === 'reconnexion') reconnecterDrive();
    else if (e.statut === 'erreur') toast(e.message, { erreur: true, action: { libelle: 'Compte', fn: () => allerA('compte') } });
    else if (e.statut === 'hors-ligne') Sync.synchroniser().catch(() => {});
    else allerA('compte');
  }

  const reconnecterDrive = () => reconnecterGoogle();

  /** Changements arrivés d'un autre appareil. */
  async function rafraichirDepuisDistant(annoncer = false) {
    if (!S.ouvert) return;
    if (editionActive || pop || document.querySelector('dialog[open]')) { S.distantEnAttente = true; return; }
    S.distantEnAttente = false;
    await essayer(charger);
    if (S.vue === 'archives') await chargerArchives();
    else if (S.vue === 'compte') await chargerCompte();
    else rendre();
    if (annoncer) toast('Mis à jour avec les changements d’un autre appareil.');
  }

  /* ---------- Mises à jour de l'app (service worker) ---------- */

  function enregistrerServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    // Au tout premier chargement, le service worker prend la main sans qu'il faille recharger.
    const avaitUneVersion = Boolean(navigator.serviceWorker.controller);
    let rechargement = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (rechargement || !avaitUneVersion) return;
      rechargement = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const surveiller = (w) => w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) proposerMiseAJour(w);
      });
      if (reg.waiting && navigator.serviceWorker.controller) proposerMiseAJour(reg.waiting);
      reg.addEventListener('updatefound', () => surveiller(reg.installing));
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
  }

  function proposerMiseAJour(travailleur) {
    let b = $('#bandeau-maj');
    if (b) return;
    b = h('div', { id: 'bandeau-maj', class: 'bandeau', role: 'status' },
      h('span', null, 'Une nouvelle version de l’app est prête.'),
      h('button', {
        type: 'button', class: 'bouton bouton-petit',
        onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { await Sync.enregistrerMaintenant(); } catch { /* gardé sur l'appareil */ }
          travailleur.postMessage('activer');
        },
      }, 'Mettre à jour'));
    document.body.append(b);
  }

  /* =========================================================
   * Rendu général
   * ======================================================= */

  function rendre() {
    if (!S.ouvert) return;
    fermerPopover();
    let page;
    if (S.vue === 'archives') page = vueArchives();
    else if (S.vue === 'compte') page = vueCompte();
    else page = vueEnCours();
    $('#app').replaceChildren(page);
    apresRendu();
  }

  const apresRenduFile = [];
  function apresRendu() {
    while (apresRenduFile.length) apresRenduFile.shift()();
  }

  function entete(sousLaDate = null) {
    const lundi = lundiDe(new Date());
    const nbEnCours = S.taches.length;
    return h('header', { class: 'entete' },
      h('div', { class: 'entete-haut' },
        h('div', null,
          h('h1', null, 'Mes tâches'),
          h('p', { class: 'sous-titre' }, `Semaine du ${fmtJourMois.format(lundi)}`, puceSync())),
        sousLaDate,
        h('div', { class: 'actions-entete' },
          h('button', { type: 'button', class: 'bouton', onclick: imprimer }, icone('imprimer'), h('span', { class: 'libelle-option' }, 'Imprimer')),
          h('button', { type: 'button', class: 'bouton', onclick: () => allerA('compte') }, icone('compte'), h('span', { class: 'libelle-option' }, 'Compte')),
          S.vue === 'encours' && h('button', { type: 'button', class: 'bouton bouton-principal', onclick: nouveauProjet }, icone('plus', 16, 2.2), 'Nouveau projet'),
          h('button', { type: 'button', class: 'bouton bouton-icone', 'aria-label': 'Verrouiller', title: 'Verrouiller (le mot de passe sera demandé)', onclick: () => verrouillerMaintenant('manuel') }, icone('cadenas')))),
      h('nav', { class: 'onglets', 'aria-label': 'Vues' },
        h('button', { type: 'button', class: 'onglet', 'aria-current': S.vue === 'encours' ? 'page' : null, onclick: () => allerA('encours') },
          'En cours', h('span', { class: 'compte' }, nbEnCours)),
        h('button', { type: 'button', class: 'onglet', 'aria-current': S.vue === 'archives' ? 'page' : null, onclick: () => allerA('archives') },
          'Archives', h('span', { class: 'compte' }, S.compteArchives))));
  }

  async function allerA(vue) {
    if (editionActive) editionActive.terminer(true);
    S.vue = vue;
    if (vue === 'archives') { rendre(); await chargerArchives(); return; }
    if (vue === 'compte') { S.sauv.apercu = null; S.sauv.lu = null; S.sauv.erreur = null; S.compte.info = null; S.compte.copies = null; rendre(); window.scrollTo(0, 0); await chargerCompte(); return; }
    if (Date.now() - S.chargeLe > 60000) await essayer(charger);
    rendre();
    window.scrollTo(0, 0);
  }

  /* =========================================================
   * Vue « En cours »
   * ======================================================= */

  function filtreActif() {
    const f = S.filtre;
    return Boolean(f.groupement || f.couleur !== 'toutes' || f.du);
  }

  /** Projets et tâches visibles selon les filtres. */
  function selection() {
    const f = S.filtre;
    const du = f.du ? `${f.du} 00:00:00` : null;
    const au = f.du ? `${f.au || f.du} 23:59:59` : null;
    const resultat = [];
    for (const p of S.projets) {
      if (f.groupement && p.groupement !== f.groupement) continue;
      let taches = tachesDe(p.id);
      if (du) taches = taches.filter((t) => t.cree_le >= du && t.cree_le <= au);
      if (f.couleur !== 'toutes') {
        if (du) taches = taches.filter((t) => COULEURS[couleurA(S.couleurs, p, t.cree_le)]?.groupe === f.couleur);
        else if (COULEURS[p.couleur]?.groupe !== f.couleur) continue;
      }
      if (du && !taches.length) continue;
      resultat.push({ projet: p, taches });
    }
    return resultat;
  }

  function vueEnCours() {
    const sel = selection();
    const actifs = sel.filter((x) => x.projet.couleur !== 'gris');
    const completes = sel.filter((x) => x.projet.couleur === 'gris');

    let corps;
    if (!S.projets.length) {
      corps = h('div', { class: 'vide' },
        h('p', null, h('strong', null, 'Aucun projet pour l’instant.')),
        h('p', null, 'Crée ton premier projet, puis ajoute ses tâches en dessous.'),
        h('button', { type: 'button', class: 'bouton bouton-principal', onclick: nouveauProjet }, icone('plus'), 'Nouveau projet'));
    } else if (!actifs.length && !completes.length) {
      corps = h('div', { class: 'vide' },
        h('p', null, 'Rien ne correspond à ces filtres.'),
        h('button', { type: 'button', class: 'bouton', onclick: () => { S.filtre = { groupement: null, couleur: 'toutes', du: null, au: null }; rendre(); } }, 'Effacer les filtres'));
    }

    const large = ecranLarge.matches;
    const bloc = blocAujourdhui(large);
    const contenu = [
      entete(large ? null : bloc),
      filtresEnCours(),
      corps || null,
      actifs.length ? h('section', { class: 'tuiles', id: 'tuiles', 'aria-label': 'Projets' }, actifs.map(({ projet, taches }) => tuile(projet, taches))) : null,
      completes.length ? sectionCompletes(completes) : null,
    ];
    if (!large) return h('div', { class: 'page' }, ...contenu);
    return h('div', { class: 'page page-avec-cote' },
      h('aside', { class: 'cote sans-impression', 'aria-label': 'Aujourd’hui' }, bloc),
      h('div', { class: 'principal' }, ...contenu));
  }

  /* ---------- Bloc « Aujourd'hui » ---------- */

  // À gauche sur grand écran, sous la date sur téléphone et tablette.
  const ecranLarge = window.matchMedia('(min-width: 1100px)');
  ecranLarge.addEventListener?.('change', () => {
    if (S.ouvert && S.vue === 'encours' && !editionActive && !pop && !document.querySelector('dialog[open]')) rendre();
  });

  const fmtJourSemaine = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  function lirePref(cle) { try { return localStorage.getItem(cle); } catch { return null; } }
  function ecrirePref(cle, v) { try { localStorage.setItem(cle, v); } catch { /* préférence non gardée */ } }
  S.ajReplie = lirePref('mes-taches-aujourdhui-replie') === '1';

  /** Tâches revenues par récurrence aujourd'hui (ou avant, si elles ne sont pas encore cochées). */
  function tachesDuJour() {
    const fin = `${iso(new Date())} 23:59:59`;
    const ordreProjet = new Map(S.projets.map((p, i) => [p.id, i]));
    return S.taches
      .filter((t) => t.occurrence && t.cree_le <= fin && projetPar(t.projet_id) && projetPar(t.projet_id).couleur !== 'gris')
      .sort((a, b) => (a.cree_le < b.cree_le ? -1 : a.cree_le > b.cree_le ? 1 : 0) || ordreProjet.get(a.projet_id) - ordreProjet.get(b.projet_id) || a.ordre - b.ordre);
  }

  const projetsUrgents = () => S.projets.filter((p) => COULEURS[p.couleur]?.groupe === 'urgent');

  function resumeAujourdhui() {
    const ag = Agenda.etat();
    const n = { rdv: ag.statut === 'ok' || ag.statut === 'hors-ligne' ? ag.evenements.length : null, taches: tachesDuJour().length, urgents: projetsUrgents().length };
    const morceaux = [];
    if (n.rdv !== null) morceaux.push(`${n.rdv} rendez-vous`);
    morceaux.push(`${n.taches} tâche${n.taches > 1 ? 's' : ''}`);
    morceaux.push(`${n.urgents} urgent${n.urgents > 1 ? 's' : ''}`);
    return morceaux.join(' · ');
  }

  function blocAujourdhui(large) {
    const replie = !large && S.ajReplie;
    const titre = h('div', { class: 'aj-titre' },
      h('h2', null, 'Aujourd’hui'),
      h('span', { class: 'aj-date' }, majuscule(fmtJourSemaine.format(new Date()))));
    const entete = large
      ? h('div', { class: 'aj-entete' }, titre)
      : h('button', {
        type: 'button', class: 'aj-entete aj-bascule', 'aria-expanded': String(!replie), 'aria-controls': 'aj-corps',
        onclick: () => { S.ajReplie = !S.ajReplie; ecrirePref('mes-taches-aujourdhui-replie', S.ajReplie ? '1' : '0'); rendre(); },
      }, titre, replie ? h('span', { class: 'aj-resume', id: 'aj-resume' }, resumeAujourdhui()) : null, icone('bas', 16, 2.2));

    return h('section', { class: 'aujourdhui sans-impression' + (replie ? ' replie' : ''), 'aria-label': 'Aujourd’hui' },
      entete,
      replie ? null : h('div', { class: 'aj-corps', id: 'aj-corps' },
        sectionAgenda(),
        sectionTachesDuJour(),
        sectionUrgents()));
  }

  function titreSection(nom, texte, ...apres) {
    return h('div', { class: 'aj-section-titre' }, icone(nom, 15, 2.2), h('h3', null, texte), ...apres);
  }

  const heureCourte = (d) => (d.getMinutes() ? heure(d) : `${d.getHours()} h`);

  function plageHoraire(ev) {
    if (ev.journee) return 'Journée';
    const debutJour = aujourdhui(), finJour = plusJours(debutJour, 1);
    if (ev.debut < debutJour && ev.fin > finJour) return 'Journée';
    if (ev.debut < debutJour) return `→ ${heureCourte(ev.fin)}`;
    if (ev.fin > finJour) return `${heureCourte(ev.debut)} →`;
    return `${heureCourte(ev.debut)} – ${heureCourte(ev.fin)}`;
  }

  function sectionAgenda() {
    const ag = Agenda.etat();
    const masquer = h('button', { type: 'button', class: 'aj-lien', title: 'Ne plus afficher Google Agenda sur cet appareil', onclick: () => essayer(() => Agenda.desactiver()) }, 'Masquer');
    const sec = (...enfants) => h('div', { class: 'aj-section', id: 'aj-agenda' }, ...enfants);

    if (ag.statut === 'inactif') {
      if (!Sync.googleConfigure()) return sec(titreSection('calendrier', 'Agenda'), h('p', { class: 'aj-vide' }, 'Google Agenda pourra s’afficher ici une fois Google configuré.'));
      return sec(titreSection('calendrier', 'Agenda'),
        h('p', { class: 'aj-vide' }, 'Affiche ici tes rendez-vous du jour, en lecture seule.'),
        h('button', { type: 'button', class: 'bouton bouton-petit', onclick: (e) => occupe(e.currentTarget, 'Connexion…', () => essayer(() => Agenda.activer())) }, icone('calendrier', 14), 'Afficher mon Google Agenda'));
    }
    if (ag.statut === 'autoriser') {
      return sec(titreSection('calendrier', 'Agenda', masquer),
        h('p', { class: 'aj-vide' }, 'L’accès à Google Agenda n’est pas encore autorisé. Dans la fenêtre Google, coche les deux accès à l’agenda.'),
        h('button', { type: 'button', class: 'bouton bouton-petit', onclick: (e) => occupe(e.currentTarget, 'Connexion…', () => essayer(() => Agenda.activer())) }, 'Autoriser l’accès'));
    }
    if (ag.statut === 'reconnexion') {
      return sec(titreSection('calendrier', 'Agenda', masquer),
        h('p', { class: 'aj-vide' }, 'La connexion à Google a expiré.'),
        h('button', { type: 'button', class: 'bouton bouton-petit', onclick: (e) => occupe(e.currentTarget, 'Connexion…', () => reconnecterGoogle()) }, 'Reconnecter Google'));
    }

    let liste;
    if (ag.statut === 'chargement' && !ag.evenements.length) liste = h('p', { class: 'aj-vide' }, 'Chargement…');
    else if (ag.statut === 'erreur') {
      liste = h('div', null, h('p', { class: 'aj-vide' }, ag.message),
        h('button', { type: 'button', class: 'bouton bouton-petit', onclick: () => Agenda.charger({ force: true }) }, 'Réessayer'));
    } else if (!ag.evenements.length) {
      liste = h('p', { class: 'aj-vide' }, ag.statut === 'hors-ligne' ? 'Hors ligne : l’agenda s’affichera au retour d’Internet.' : 'Aucun rendez-vous aujourd’hui.');
    } else {
      const maintenant = new Date();
      liste = h('ul', { class: 'aj-liste aj-evenements' }, ag.evenements.map((ev) => {
        const passe = !ev.journee && ev.fin <= maintenant;
        const enCours = !ev.journee && ev.debut <= maintenant && ev.fin > maintenant;
        const nom = ev.lien
          ? h('a', { href: ev.lien, target: '_blank', rel: 'noopener noreferrer', class: 'aj-ev-titre' }, ev.titre)
          : h('span', { class: 'aj-ev-titre' }, ev.titre);
        // Couleur de l'agenda posée par le CSSOM : la politique de sécurité refuse les attributs style.
        const barre = h('span', { class: 'aj-ev-barre', 'aria-hidden': 'true' });
        if (/^#[0-9a-f]{3,8}$/i.test(ev.couleur || '')) barre.style.background = ev.couleur;
        return h('li', { class: 'aj-ev' + (passe ? ' passe' : '') + (enCours ? ' en-cours' : '') },
          barre,
          h('span', { class: 'aj-ev-heure' }, plageHoraire(ev)),
          h('span', { class: 'aj-ev-texte' }, nom,
            (ev.lieu || ev.agenda) ? h('span', { class: 'aj-ev-detail' }, [ev.lieu, ev.agenda].filter(Boolean).join(' · ')) : null,
            enCours ? h('span', { class: 'visuellement-cache' }, ' (en cours)') : null));
      }));
    }
    return sec(titreSection('calendrier', 'Agenda',
      ag.statut === 'hors-ligne' && ag.evenements.length ? h('span', { class: 'aj-note' }, 'hors ligne') : null, masquer), liste);
  }

  function sectionTachesDuJour() {
    const liste = tachesDuJour();
    const today = iso(new Date());
    return h('div', { class: 'aj-section' },
      titreSection('recurrence', 'À faire'),
      liste.length
        ? h('ul', { class: 'aj-liste' }, liste.map((t) => {
          const p = projetPar(t.projet_id);
          const texte = h('span', { class: 'aj-tache-texte' });
          afficherTexte(texte, t.texte);
          const jour = t.cree_le.slice(0, 10);
          const li = h('li', { class: 'tache aj-tache' },
            h('input', { type: 'checkbox', 'aria-label': `Archiver : ${texteBrut(t.texte)}`, onchange: (e) => finaliser(t, li, e.currentTarget) }),
            h('span', { class: 'aj-tache-corps' }, texte,
              h('button', { type: 'button', class: 'aj-tache-projet', onclick: () => allerAuProjet(p.id) },
                p.titre, jour < today ? ` · depuis le ${fmtCourt.format(lireDate(t.cree_le))}` : '')));
          return li;
        }))
        : h('p', { class: 'aj-vide' }, 'Aucune tâche répétée pour aujourd’hui.'));
  }

  function sectionUrgents() {
    const liste = projetsUrgents();
    return h('div', { class: 'aj-section' },
      titreSection('horloge', 'Urgent'),
      liste.length
        ? h('ul', { class: 'aj-liste' }, liste.map((p) => {
          const n = joursEntre(lireDate(p.couleur_depuis), new Date());
          const nb = S.taches.filter((t) => t.projet_id === p.id).length;
          return h('li', null, h('button', { type: 'button', class: 'aj-urgent', onclick: () => allerAuProjet(p.id) },
            h('span', { class: 'aj-pastille fond-couleur', 'data-couleur': p.couleur, 'aria-hidden': 'true' }),
            h('span', { class: 'aj-urgent-titre' }, p.titre),
            h('span', { class: 'aj-urgent-detail' }, `${nb} tâche${nb > 1 ? 's' : ''} · ${n <= 0 ? 'aujourd’hui' : `depuis ${n} j`}`)));
        }))
        : h('p', { class: 'aj-vide' }, 'Aucun projet urgent.'));
  }

  /** Fait défiler jusqu'au projet (en retirant les filtres qui le cacheraient). */
  function allerAuProjet(id) {
    if (!$(`.tuile[data-id="${CSS.escape(id)}"]`)) { S.filtre = { groupement: null, couleur: 'toutes', du: null, au: null }; rendre(); }
    const el = $(`.tuile[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('surligne'); void el.offsetWidth; el.classList.add('surligne');
    setTimeout(() => el.classList.remove('surligne'), 1600);
  }

  /** Met à jour l'agenda sans redessiner la page (rien n'est perdu en cours d'édition). */
  function majAgenda() {
    if (!S.ouvert || S.vue !== 'encours') return;
    const el = $('#aj-agenda');
    if (el) el.replaceWith(sectionAgenda());
    const r = $('#aj-resume');
    if (r) r.textContent = resumeAujourdhui();
  }

  async function reconnecterGoogle() {
    await essayer(async () => {
      await Sync.connecterGoogle();
      await Promise.all([Sync.synchroniser(), Agenda.charger({ force: true })]);
      if (S.vue === 'compte') await chargerCompte();
    });
  }

  function filtresEnCours() {
    const f = S.filtre;
    const libelle = plage(f.du, f.au);
    const boutonPeriode = h('button', {
      type: 'button', class: 'bouton bouton-periode', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-actif': String(Boolean(f.du)),
      onclick: (e) => ouvrirCalendrier(e.currentTarget, f.du, f.au, (du, au) => { f.du = du; f.au = au; rendre(); }, 'Tâches créées'),
    }, icone('calendrier'), libelle ? `Créées : ${libelle.charAt(0).toLowerCase()}${libelle.slice(1)}` : 'Toutes les dates', icone('bas', 14, 2.2));

    return h('div', { class: 'filtres sans-impression' },
      h('div', { class: 'rangee rangee-periode' },
        boutonPeriode,
        f.du && h('button', { type: 'button', class: 'effacer-periode', 'aria-label': 'Effacer la période', onclick: () => { f.du = null; f.au = null; rendre(); } }, icone('fermer', 14)),
        h('span', { class: 'separateur', 'aria-hidden': 'true' }),
        h('div', { class: 'rangee puces-defile', role: 'group', 'aria-label': 'Groupement' },
        h('button', { type: 'button', class: 'puce', 'aria-pressed': String(!f.groupement), onclick: () => { f.groupement = null; rendre(); } }, 'Tout'),
        S.groupements.map((g) => h('button', {
          type: 'button', class: 'puce', 'aria-pressed': String(f.groupement === g),
          onclick: () => { f.groupement = f.groupement === g ? null : g; rendre(); },
        }, g)))),
      h('div', { class: 'rangee puces-defile', role: 'group', 'aria-label': 'Couleur' },
        FILTRES_COULEUR.map((c) => h('button', {
          type: 'button', class: 'puce puce-petite', 'aria-pressed': String(f.couleur === c.cle),
          title: c.cle !== 'toutes' && f.du ? 'Selon la couleur du projet à la date de création de chaque tâche' : null,
          onclick: () => { f.couleur = c.cle; rendre(); },
        }, c.points && points(c.points), c.libelle))));
  }

  function tuile(p, taches) {
    const el = h('article', { class: 'tuile' + (taches.length ? '' : ' tuile-vide'), 'data-id': p.id });
    const titre = h('h2', { class: 'tuile-titre', title: 'Cliquer pour renommer' }, p.titre);
    titre.addEventListener('click', () => { if (titre.contentEditable !== 'true') editerTitre(p, titre); });

    const info = COULEURS[p.couleur] || COULEURS.blanc;
    let age = null;
    if (info.groupe === 'urgent') {
      const n = joursEntre(lireDate(p.couleur_depuis), new Date());
      age = h('span', { class: 'age', title: `Depuis le ${dateLongue(lireDate(p.couleur_depuis))}` },
        `${info.nom} depuis ${n <= 0 ? 'aujourd’hui' : n + ' j'}`);
    }

    const poignee = h('button', { type: 'button', class: 'poignee', 'aria-label': `Déplacer « ${p.titre} » (flèches haut et bas)`, title: 'Glisser pour déplacer' }, icone('poignee', 18));
    poignee.addEventListener('pointerdown', (e) => demarrerGlisser(e, el, poignee));
    poignee.addEventListener('keydown', (e) => deplacerAuClavier(e, p.id));

    el.append(
      h('div', { class: 'tuile-entete fond-couleur', 'data-couleur': p.couleur },
        poignee,
        titre,
        h('span', { class: 'tuile-meta' },
          h('button', { type: 'button', class: 'etiquette', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: 'Changer le groupement', onclick: (e) => menuGroupement(e.currentTarget, p) }, p.groupement),
          age),
        h('button', { type: 'button', class: 'bouton-couleur', 'aria-label': `Couleur : ${info.nom}. Changer la couleur`, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-couleur': p.couleur, onclick: (e) => menuCouleur(e.currentTarget, p) },
          h('span', { class: 'rond' })),
        h('button', { type: 'button', class: 'bouton-menu', 'aria-label': 'Autres actions', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: (e) => menuProjet(e.currentTarget, p) }, icone('menu', 18))),
      h('ul', { class: 'taches' }, taches.map((t) => ligneTache(t))),
      h('button', { type: 'button', class: 'ajouter', onclick: () => ouvrirAjout(p.id) }, icone('plus', 14), 'Ajouter une tâche'));

    if (S.ajoutEnCours === p.id) apresRenduFile.push(() => ouvrirAjout(p.id));
    if (S.editionTitre === p.id) { S.editionTitre = null; apresRenduFile.push(() => editerTitre(p, titre, true)); }
    return el;
  }

  function ligneTache(t) {
    const cree = lireDate(t.cree_le);
    const texte = h('span', { class: 'tache-texte', title: 'Cliquer pour modifier · Ctrl+B pour le gras' });
    afficherTexte(texte, t.texte);
    texte.addEventListener('click', () => { if (texte.contentEditable !== 'true') editerTache(t, texte); });

    const rec = t.recurrence
      ? h('button', { type: 'button', class: 'rec', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: 'Modifier la récurrence', onclick: (e) => menuRecurrence(e.currentTarget, t) },
        icone('recurrence', 12, 2.2), libelleRecurrence(t.recurrence))
      : h('button', { type: 'button', class: 'rec-bouton', 'aria-label': 'Répéter cette tâche', title: 'Répéter cette tâche', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', onclick: (e) => menuRecurrence(e.currentTarget, t) },
        icone('recurrence', 14, 2.2));

    const li = h('li', { class: 'tache', 'data-id': t.id },
      h('input', { type: 'checkbox', 'aria-label': `Archiver : ${texteBrut(t.texte)}`, onchange: (e) => finaliser(t, li, e.currentTarget) }),
      texte, rec,
      h('span', { class: 'tache-date', title: `Créée le ${dateLongue(cree)}` }, dateCourte(cree)));
    return li;
  }

  function sectionCompletes(liste) {
    const ouvert = S.completesOuverts;
    return h('section', { class: 'completes', 'aria-label': 'Projets complétés' },
      h('button', { type: 'button', class: 'completes-bascule', 'aria-expanded': String(ouvert), onclick: () => { S.completesOuverts = !ouvert; rendre(); } },
        icone('bas', 16, 2.2), `Complétés · ${liste.length}`),
      ouvert && h('div', { class: 'tuiles' }, liste.map(({ projet: p, taches }) => h('article', { class: 'tuile tuile-repliee', 'data-id': p.id },
        h('div', { class: 'tuile-entete fond-couleur', 'data-couleur': 'gris' },
          h('span', { class: 'poignee', 'aria-hidden': 'true' }),
          h('h2', { class: 'tuile-titre' }, p.titre),
          h('span', { class: 'age' }, `complété le ${dateCourte(lireDate(p.complete_le || p.couleur_depuis))}${taches.length ? ` · ${taches.length} tâche${taches.length > 1 ? 's' : ''} ouverte${taches.length > 1 ? 's' : ''}` : ''}`),
          h('button', { type: 'button', class: 'bouton bouton-petit', onclick: () => retablirProjet(p) }, 'Rétablir'),
          h('button', { type: 'button', class: 'bouton bouton-petit bouton-principal', onclick: () => archiverProjet(p) }, 'Archiver'))))));
  }

  /* ---------- Actions sur les projets ---------- */

  async function nouveauProjet() {
    await essayer(async () => {
      const r = await api('projet_creer', { methode: 'POST', donnees: { titre: 'Nouveau projet', groupement: S.filtre.groupement || S.groupements[0] } });
      S.projets.unshift(r.projet);
      S.couleurs.push({ projet_id: r.projet.id, couleur: 'blanc', le: r.projet.cree_le });
      S.filtre.du = null; S.filtre.au = null; S.filtre.couleur = 'toutes';
      S.editionTitre = r.projet.id;
      rendre();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function editerTitre(p, el, nouveau = false) {
    editer(el, {
      valeur: p.titre, gras: false, toutSelectionner: nouveau,
      surValider: async (val, change, viaEntree) => {
        if (change) {
          const r = await essayer(() => api('projet_modifier', { methode: 'POST', donnees: { id: p.id, titre: val } }));
          if (r) Object.assign(p, r.projet);
          el.textContent = p.titre;
        }
        if (viaEntree && !tachesDe(p.id).length) { S.ajoutEnCours = p.id; ouvrirAjout(p.id); }
      },
    });
  }

  async function modifierProjet(p, champs) {
    const r = await essayer(() => api('projet_modifier', { methode: 'POST', donnees: { id: p.id, ...champs } }));
    if (!r) return;
    Object.assign(p, r.projet);
    S.couleurs = S.couleurs.filter((c) => c.projet_id !== p.id).concat(r.couleurs);
    rendre();
  }

  async function retablirProjet(p) {
    const r = await essayer(() => api('projet_retablir', { methode: 'POST', donnees: { id: p.id } }));
    if (!r) return;
    Object.assign(p, r.projet);
    S.couleurs = S.couleurs.filter((c) => c.projet_id !== p.id).concat(r.couleurs);
    rendre();
  }

  async function archiverProjet(p) {
    const n = tachesDe(p.id).length;
    if (n && !(await confirmer('Archiver le projet ?', `« ${p.titre} » et ses ${n} tâche${n > 1 ? 's' : ''} ouverte${n > 1 ? 's' : ''} iront dans les Archives. Rien n'est effacé.`, { ok: 'Archiver' }))) return;
    const r = await essayer(() => api('projet_archiver', { methode: 'POST', donnees: { id: p.id } }));
    if (!r) return;
    await essayer(charger);
    rendre();
    toast(`« ${p.titre} » est archivé.`);
  }

  async function supprimerProjet(p) {
    const n = tachesDe(p.id).length;
    const ok = await confirmer('Supprimer le projet ?',
      `« ${p.titre} »${n ? ` et ses ${n} tâche${n > 1 ? 's' : ''}` : ''} seront supprimés, ainsi que ses tâches archivées. Cette action est définitive. (Pour garder une trace, utilise plutôt « Archiver ».)`,
      { ok: 'Supprimer', danger: true });
    if (!ok) return;
    const r = await essayer(() => api('projet_supprimer', { methode: 'POST', donnees: { id: p.id } }));
    if (!r) return;
    await essayer(charger);
    rendre();
    toast(`« ${p.titre} » est supprimé.`);
  }

  function menuCouleur(ancre, p) {
    const nuance = (c) => h('button', {
      type: 'button', class: 'nuance', 'data-couleur': c, 'aria-label': COULEURS[c].nom + (c === 'gris' ? ', complété' : ''),
      'aria-pressed': String(p.couleur === c), onclick: () => { fermerPopover(); if (c !== p.couleur) modifierProjet(p, { couleur: c }); },
    }, h('span', { class: 'rond fond-couleur' }));
    ouvrirPopover(ancre, [
      h('div', null, h('div', { class: 'groupe-libelle' }, 'Urgent'), h('div', { class: 'nuancier' }, ['vert', 'jaune', 'orange', 'rouge'].map(nuance))),
      h('div', null, h('div', { class: 'groupe-libelle' }, 'À prévoir'), h('div', { class: 'nuancier' }, ['vert-p', 'jaune-p', 'orange-p', 'rouge-p'].map(nuance))),
      h('div', null, h('div', { class: 'groupe-libelle' }, 'Par défaut · Complété'), h('div', { class: 'nuancier' }, ['blanc', 'gris'].map(nuance))),
    ], { titre: 'Couleur du projet' });
  }

  function menuGroupement(ancre, p) {
    ouvrirPopover(ancre, h('div', { class: 'menu-liste', role: 'menu' }, S.groupements.map((g) => h('button', {
      type: 'button', class: 'menu-item', role: 'menuitemradio', 'aria-checked': String(p.groupement === g),
      onclick: () => { fermerPopover(); if (g !== p.groupement) modifierProjet(p, { groupement: g }); },
    }, h('span', { class: 'coche' }, p.groupement === g ? icone('coche', 16, 2.4) : null), g))), { classe: 'popover-menu', titre: 'Groupement' });
  }

  function menuProjet(ancre, p) {
    ouvrirPopover(ancre, h('div', { class: 'menu-liste', role: 'menu' },
      h('button', { type: 'button', class: 'menu-item', role: 'menuitem', onclick: () => { fermerPopover(); modifierProjet(p, { couleur: 'gris' }); } }, icone('coche'), 'Marquer comme complété'),
      h('button', { type: 'button', class: 'menu-item', role: 'menuitem', onclick: () => { fermerPopover(); archiverProjet(p); } }, icone('archive'), 'Archiver le projet'),
      h('button', { type: 'button', class: 'menu-item danger', role: 'menuitem', onclick: () => { fermerPopover(); supprimerProjet(p); } }, icone('corbeille'), 'Supprimer le projet')),
    { titre: 'Actions du projet' });
  }

  /* ---------- Déplacer les tuiles ---------- */

  function enregistrerOrdre(idsVisibles) {
    // Les projets filtrés gardent leur place ; on réordonne seulement les visibles entre eux.
    const tous = [...S.projets].sort((a, b) => a.ordre - b.ordre || a.id - b.id);
    const visibles = new Set(idsVisibles);
    const file = [...idsVisibles];
    const nouvelOrdre = tous.map((p) => (visibles.has(p.id) ? file.shift() : p.id));
    nouvelOrdre.forEach((id, i) => { const p = projetPar(id); if (p) p.ordre = i; });
    S.projets.sort((a, b) => a.ordre - b.ordre);
    essayer(() => api('projets_ordonner', { methode: 'POST', donnees: { ids: nouvelOrdre } }));
  }

  function demarrerGlisser(e, tuileEl, poignee) {
    if (e.button !== 0 || editionActive) return;
    e.preventDefault();
    fermerPopover();
    const liste = tuileEl.parentElement;
    const r = tuileEl.getBoundingClientRect();
    const decalage = e.clientY - r.top;
    const place = h('div', { class: 'tuile-place', 'aria-hidden': 'true' });
    place.style.height = `${r.height}px`;
    liste.insertBefore(place, tuileEl);
    tuileEl.classList.add('en-glisse');
    tuileEl.style.width = `${r.width}px`;
    tuileEl.style.left = `${r.left}px`;
    tuileEl.style.top = `${r.top}px`;
    document.body.classList.add('glisse-en-cours');
    poignee.setPointerCapture(e.pointerId);
    let dernierY = e.clientY, defile = null;

    const deplacer = (ev) => {
      dernierY = ev.clientY;
      tuileEl.style.top = `${ev.clientY - decalage}px`;
      placer(ev.clientY);
      const marge = 70;
      const vitesse = ev.clientY < marge ? -14 : ev.clientY > window.innerHeight - marge ? 14 : 0;
      if (vitesse && !defile) {
        defile = setInterval(() => { window.scrollBy(0, vitesse); placer(dernierY); }, 16);
      } else if (!vitesse && defile) { clearInterval(defile); defile = null; }
    };
    const placer = (y) => {
      const autres = [...liste.querySelectorAll(':scope > .tuile:not(.en-glisse)')];
      let avant = null;
      for (const a of autres) {
        const ra = a.getBoundingClientRect();
        if (y < ra.top + ra.height / 2) { avant = a; break; }
      }
      if (avant) { if (place.nextElementSibling !== avant) liste.insertBefore(place, avant); }
      else if (liste.lastElementChild !== place) liste.append(place);
    };
    const finir = () => {
      clearInterval(defile);
      poignee.removeEventListener('pointermove', deplacer);
      poignee.removeEventListener('pointerup', finir);
      poignee.removeEventListener('pointercancel', finir);
      document.body.classList.remove('glisse-en-cours');
      liste.insertBefore(tuileEl, place);
      place.remove();
      tuileEl.classList.remove('en-glisse');
      tuileEl.style.width = tuileEl.style.left = tuileEl.style.top = '';
      const ids = [...liste.querySelectorAll(':scope > .tuile')].map((x) => x.dataset.id);
      const avant = selection().filter((x) => x.projet.couleur !== 'gris').map((x) => x.projet.id);
      if (ids.join() !== avant.join()) enregistrerOrdre(ids);
    };
    poignee.addEventListener('pointermove', deplacer);
    poignee.addEventListener('pointerup', finir);
    poignee.addEventListener('pointercancel', finir);
  }

  function deplacerAuClavier(e, id) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const ids = selection().filter((x) => x.projet.couleur !== 'gris').map((x) => x.projet.id);
    const i = ids.indexOf(id);
    const j = e.key === 'ArrowUp' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    enregistrerOrdre(ids);
    rendre();
    const p = $(`.tuile[data-id="${id}"] .poignee`);
    if (p) p.focus();
  }

  /* ---------- Actions sur les tâches ---------- */

  function ouvrirAjout(projetId) {
    const tuileEl = $(`.tuile[data-id="${projetId}"]`);
    if (!tuileEl) { S.ajoutEnCours = null; return; }
    const ul = $('.taches', tuileEl);
    const existant = $('.tache.nouvelle', ul);
    if (existant) { $('.tache-texte', existant).focus(); return; }
    const texte = h('span', { class: 'tache-texte', 'data-indice': 'Nouvelle tâche · Entrée pour ajouter' });
    const li = h('li', { class: 'tache nouvelle' }, h('span', { class: 'case-vide', 'aria-hidden': 'true' }), texte);
    ul.append(li);
    S.ajoutEnCours = projetId;
    editer(texte, {
      valeur: '',
      surValider: async (val, _change, viaEntree) => {
        S.ajoutEnCours = viaEntree ? projetId : null;
        const r = await essayer(() => api('tache_creer', { methode: 'POST', donnees: { projet_id: projetId, texte: val } }));
        if (!r) { li.remove(); return; }
        S.taches.push(r.tache);
        // Si une autre édition a commencé entre-temps, on insère la ligne sans tout redessiner.
        if (editionActive || pop) { li.replaceWith(ligneTache(r.tache)); return; }
        rendre();
      },
      surVide: () => { S.ajoutEnCours = null; li.remove(); },
      surEchap: () => { S.ajoutEnCours = null; li.remove(); },
    });
  }

  function editerTache(t, el) {
    editer(el, {
      valeur: t.texte,
      surValider: async (val, change) => {
        if (!change) return;
        const r = await essayer(() => api('tache_modifier', { methode: 'POST', donnees: { id: t.id, texte: val } }));
        if (r) Object.assign(t, r.tache);
        afficherTexte(el, t.texte);
      },
      surVide: async () => {
        const ok = await confirmer('Supprimer la tâche ?', `Le texte est vide. Supprimer « ${texteBrut(t.texte)} » ? (Pour la garder dans les Archives, coche-la plutôt.)`, { ok: 'Supprimer', danger: true });
        if (!ok) { afficherTexte(el, t.texte); return; }
        const r = await essayer(() => api('tache_supprimer', { methode: 'POST', donnees: { id: t.id } }));
        if (r) { S.taches = S.taches.filter((x) => x.id !== t.id); rendre(); }
        else afficherTexte(el, t.texte);
      },
    });
  }

  async function finaliser(t, li, caseACocher) {
    li.classList.add('faite');
    caseACocher.disabled = true;
    const r = await essayer(() => api('tache_finaliser', { methode: 'POST', donnees: { id: t.id } }));
    if (!r) { li.classList.remove('faite'); caseACocher.checked = false; caseACocher.disabled = false; return; }
    S.taches = S.taches.filter((x) => x.id !== t.id);
    S.compteArchives++;
    setTimeout(() => { if (!editionActive && !pop) rendre(); else li.remove(); }, 450);
    const suite = r.prochaine ? ` · revient le ${fmtCourt.format(lireDate(r.prochaine))}` : '';
    toast(`Tâche archivée${suite}`, {
      annuler: async () => {
        const rr = await essayer(() => api('tache_restaurer', { methode: 'POST', donnees: { id: t.id } }));
        if (rr) { await essayer(charger); rendre(); }
      },
    });
  }

  /* ---------- Récurrence ---------- */

  function menuRecurrence(ancre, t) {
    const base = new Date();
    const actuelle = t.recurrence;
    const e = {
      type: actuelle?.type || null,
      intervalle: actuelle?.intervalle || 1,
      jour_semaine: actuelle?.jour_semaine || ((base.getDay() + 6) % 7) + 1,
      jour_mois: actuelle?.jour_mois || base.getDate(),
      mois: actuelle?.mois || base.getMonth() + 1,
      jour: actuelle?.jour || base.getDate(),
      date: actuelle?.date || iso(plusJours(base, 7)),
    };
    const zoneDetails = h('div', { class: 'details-rec' });
    const prochaine = h('p', { class: 'prochaine', 'aria-live': 'polite' });
    const choix = h('div', { class: 'choix-type', role: 'radiogroup', 'aria-label': 'Fréquence' });
    const types = [[null, 'Jamais'], ['jour', 'Chaque jour'], ['semaine', 'Chaque semaine'], ['mois', 'Chaque mois'], ['annee', 'Chaque année'], ['date', 'Date précise']];
    let minuterie = null;

    const objet = () => {
      switch (e.type) {
        case 'jour': return { type: 'jour', intervalle: e.intervalle };
        case 'semaine': return { type: 'semaine', intervalle: e.intervalle, jour_semaine: Number(e.jour_semaine) };
        case 'mois': return { type: 'mois', intervalle: e.intervalle, jour_mois: e.jour_mois === 'dernier' ? 'dernier' : Number(e.jour_mois) };
        case 'annee': return { type: 'annee', intervalle: e.intervalle, mois: Number(e.mois), jour: Number(e.jour) };
        case 'date': return { type: 'date', date: e.date };
      }
      return null;
    };

    const apercu = () => {
      clearTimeout(minuterie);
      const r = objet();
      if (!r) { prochaine.textContent = 'Tâche unique : elle ne reviendra pas.'; return; }
      prochaine.textContent = '…';
      minuterie = setTimeout(async () => {
        try {
          const rep = await api('recurrence_apercu', { methode: 'POST', donnees: { recurrence: r, cree_le: t.cree_le } });
          prochaine.textContent = rep.prochaine
            ? `Si tu la coches aujourd'hui, elle reviendra le ${fmtLong.format(lireDate(rep.prochaine))}.`
            : 'Cette date est passée : choisis une date à venir.';
        } catch (err) { prochaine.textContent = err.message; }
      }, 200);
    };

    const intervalle = (unite) => {
      const input = h('input', { id: 'rec-n', class: 'champ-petit', type: 'number', min: '1', max: '365', value: String(e.intervalle) });
      input.addEventListener('input', () => { e.intervalle = Math.max(1, Math.min(365, parseInt(input.value, 10) || 1)); apercu(); });
      return [h('label', { for: 'rec-n' }, 'Tous les'), input, h('span', null, unite)];
    };
    const liste = (id, valeur, options, surChoix, libelle) => {
      const sel = h('select', { id, class: 'champ-petit', 'aria-label': libelle },
        options.map(([v, l]) => h('option', { value: String(v), selected: String(v) === String(valeur) }, l)));
      sel.addEventListener('change', () => { surChoix(sel.value); apercu(); });
      return sel;
    };
    const jours31 = Array.from({ length: 31 }, (_, i) => [i + 1, String(i + 1)]);

    const details = () => {
      zoneDetails.replaceChildren();
      switch (e.type) {
        case 'jour': ajouter(zoneDetails, [intervalle('jour(s)')]); break;
        case 'semaine': ajouter(zoneDetails, [intervalle('semaine(s), le'), liste('rec-js', e.jour_semaine, JOURS.map((j, i) => [i + 1, j]), (v) => { e.jour_semaine = v; }, 'Jour de la semaine')]); break;
        case 'mois': ajouter(zoneDetails, [intervalle('mois, le'), liste('rec-jm', e.jour_mois, [...jours31, ['dernier', 'dernier jour']], (v) => { e.jour_mois = v; }, 'Jour du mois')]); break;
        case 'annee': ajouter(zoneDetails, [intervalle('an(s), le'), liste('rec-j', e.jour, jours31, (v) => { e.jour = v; }, 'Jour'), liste('rec-m', e.mois, MOIS.map((m, i) => [i + 1, m]), (v) => { e.mois = v; }, 'Mois')]); break;
        case 'date': {
          const input = h('input', { id: 'rec-date', class: 'champ-petit', type: 'date', value: e.date, min: iso(plusJours(new Date(), 1)) });
          input.addEventListener('input', () => { if (input.value) { e.date = input.value; apercu(); } });
          ajouter(zoneDetails, [h('label', { for: 'rec-date' }, 'Elle revient une fois, le'), input]);
          break;
        }
      }
      zoneDetails.hidden = !e.type;
    };
    const boutonsTypes = () => {
      choix.replaceChildren(...types.map(([v, l]) => h('button', {
        type: 'button', role: 'radio', 'aria-checked': String(e.type === v),
        onclick: () => { e.type = v; boutonsTypes(); details(); apercu(); positionner(); },
      }, l)));
    };
    boutonsTypes(); details(); apercu();

    const enregistrer = async () => {
      const r = objet();
      const rep = await essayer(() => api('tache_modifier', { methode: 'POST', donnees: { id: t.id, recurrence: r } }));
      if (!rep) return;
      Object.assign(t, rep.tache);
      fermerPopover();
      rendre();
      toast(r ? `Récurrence : ${libelleRecurrence(t.recurrence)}` : 'Récurrence retirée');
    };

    ouvrirPopover(ancre, [
      h('div', { class: 'popover-titre' }, 'Répéter cette tâche'),
      choix, zoneDetails, prochaine,
      h('div', { class: 'pied-pop' },
        h('button', { type: 'button', class: 'bouton bouton-texte', onclick: () => fermerPopover(true) }, 'Annuler'),
        h('button', { type: 'button', class: 'bouton bouton-principal bouton-petit', onclick: enregistrer }, 'Enregistrer')),
    ], { titre: 'Répéter cette tâche' }).style.width = '340px';
    positionner();
  }

  /* =========================================================
   * Calendrier (choix d'une période)
   * ======================================================= */

  function ouvrirCalendrier(ancre, duInitial, auInitial, surAppliquer, sujet) {
    let du = duInitial ? lireDate(duInitial) : null;
    let au = auInitial ? lireDate(auInitial) : (du ? new Date(du) : null);
    let affiche = new Date((du || new Date()).getFullYear(), (du || new Date()).getMonth(), 1);
    let raccourci = du ? 'perso' : null;

    const zone = h('div', { class: 'cal-principal' });
    const raccourcis = h('div', { class: 'cal-raccourcis' });
    const aujourd = aujourdhui();
    const RACCOURCIS = [
      ['auj', "Aujourd'hui", () => [aujourd, aujourd]],
      ['sem', 'Cette semaine', () => [lundiDe(aujourd), plusJours(lundiDe(aujourd), 6)]],
      ['semp', 'Semaine dernière', () => [plusJours(lundiDe(aujourd), -7), plusJours(lundiDe(aujourd), -1)]],
      ['mois', 'Ce mois-ci', () => [new Date(aujourd.getFullYear(), aujourd.getMonth(), 1), new Date(aujourd.getFullYear(), aujourd.getMonth() + 1, 0)]],
      ['moisp', 'Mois dernier', () => [new Date(aujourd.getFullYear(), aujourd.getMonth() - 1, 1), new Date(aujourd.getFullYear(), aujourd.getMonth(), 0)]],
      ['an', 'Cette année', () => [new Date(aujourd.getFullYear(), 0, 1), new Date(aujourd.getFullYear(), 11, 31)]],
    ];

    const dessiner = () => {
      raccourcis.replaceChildren(...RACCOURCIS.map(([cle, libelle, f]) => h('button', {
        type: 'button', 'aria-pressed': String(raccourci === cle),
        onclick: () => { [du, au] = f(); raccourci = cle; affiche = new Date(du.getFullYear(), du.getMonth(), 1); dessiner(); },
      }, libelle)));
      const premier = new Date(affiche);
      const debutGrille = plusJours(premier, -((premier.getDay() + 6) % 7));
      const jours = [];
      for (let i = 0; i < 42; i++) {
        const d = plusJours(debutGrille, i);
        if (i >= 35 && d.getMonth() !== affiche.getMonth()) break;
        const k = iso(d);
        const bout = du && (k === iso(du) || (au && k === iso(au)));
        const dans = du && au && d > du && d < au;
        jours.push(h('button', {
          type: 'button',
          class: 'cal-jour' + (d.getMonth() !== affiche.getMonth() ? ' hors' : '') + (k === iso(aujourd) ? ' aujourdhui' : '') + (bout ? ' bout' : '') + (dans ? ' dans' : ''),
          'aria-label': fmtLong.format(d), 'aria-pressed': String(Boolean(bout || dans)),
          onclick: () => {
            raccourci = 'perso';
            if (!du || (du && au && iso(du) !== iso(au))) { du = d; au = d; }
            else if (d < du) { au = du; du = d; }
            else { au = d; }
            dessiner();
          },
        }, d.getDate()));
      }
      const nb = du && au ? joursEntre(du, au) + 1 : 0;
      zone.replaceChildren(
        h('div', { class: 'cal-mois' },
          h('button', { type: 'button', class: 'cal-nav', 'aria-label': 'Mois précédent', onclick: () => { affiche = new Date(affiche.getFullYear(), affiche.getMonth() - 1, 1); dessiner(); } }, icone('gauche', 16, 2.2)),
          h('span', null, `${MOIS[affiche.getMonth()].replace(/^./, (c) => c.toUpperCase())} ${affiche.getFullYear()}`),
          h('button', { type: 'button', class: 'cal-nav', 'aria-label': 'Mois suivant', onclick: () => { affiche = new Date(affiche.getFullYear(), affiche.getMonth() + 1, 1); dessiner(); } }, icone('droite', 16, 2.2))),
        h('div', { class: 'cal-grille' }, ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j) => h('span', { class: 'cal-jsem', 'aria-hidden': 'true' }, j)), jours),
        h('div', { class: 'cal-pied' },
          h('span', { class: 'cal-resume' }, du ? `${plage(iso(du), iso(au || du))}${nb > 1 ? ` · ${nb} jours` : ''}` : 'Choisis un jour ou une plage'),
          h('div', { class: 'pied-pop' },
            h('button', { type: 'button', class: 'bouton bouton-texte', onclick: () => { fermerPopover(true); surAppliquer(null, null); } }, 'Effacer'),
            h('button', { type: 'button', class: 'bouton bouton-principal bouton-petit', disabled: !du, onclick: () => { fermerPopover(true); surAppliquer(iso(du), iso(au || du)); } }, 'Appliquer'))));
      positionner();
    };
    const el = ouvrirPopover(ancre, [h('div', { class: 'popover-titre visuellement-cache' }, sujet || 'Période'), raccourcis, zone], { classe: 'calendrier a-gauche-ancre', titre: 'Choisir une période' });
    dessiner();
    return el;
  }

  /* =========================================================
   * Vue « Archives »
   * ======================================================= */

  async function chargerArchives() {
    const a = S.arch;
    a.chargement = true;
    const params = { type: a.type };
    if (a.du) { params.du = a.du; params.au = a.au || a.du; }
    const d = await essayer(() => api('archives', { params }));
    a.chargement = false;
    if (d) a.donnees = d;
    if (S.vue === 'archives') rendre();
  }

  function selectionArchives() {
    const a = S.arch;
    const d = a.donnees;
    if (!d) return [];
    const projets = new Map(d.projets.map((p) => [p.id, p]));
    const groupes = new Map();
    for (const t of d.taches) {
      const p = projets.get(t.projet_id);
      if (!p) continue;
      if (a.groupement && p.groupement !== a.groupement) continue;
      if (a.couleur !== 'toutes') {
        const quand = a.type === 'cree' ? t.cree_le : t.finalise_le;
        if (COULEURS[couleurA(d.couleurs, p, quand)]?.groupe !== a.couleur) continue;
      }
      if (!groupes.has(p.id)) groupes.set(p.id, { projet: p, taches: [] });
      groupes.get(p.id).taches.push(t);
    }
    return [...groupes.values()].sort((x, y) => x.projet.ordre - y.projet.ordre || x.projet.id - y.projet.id);
  }

  function vueArchives() {
    const a = S.arch;
    const groupes = selectionArchives();
    const n = groupes.reduce((s, g) => s + g.taches.length, 0);
    const libelle = plage(a.du, a.au);
    const coul = FILTRES_COULEUR.find((c) => c.cle === a.couleur);

    const filtres = h('section', { class: 'carte filtres sans-impression', 'aria-label': 'Filtres' },
      h('div', { class: 'rangee' },
        h('div', { class: 'segment', role: 'group', 'aria-label': 'Type de date' },
          [['cree', 'Créées'], ['finalise', 'Finalisées']].map(([v, l]) => h('button', {
            type: 'button', 'aria-pressed': String(a.type === v), onclick: () => { if (a.type !== v) { a.type = v; chargerArchives(); } },
          }, l))),
        h('button', {
          type: 'button', class: 'bouton bouton-periode', 'data-actif': String(Boolean(a.du)), 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
          onclick: (e) => ouvrirCalendrier(e.currentTarget, a.du, a.au, (du, au) => { a.du = du; a.au = au; chargerArchives(); }, 'Période'),
        }, icone('calendrier'), libelle || 'Toutes les dates', icone('bas', 14, 2.2)),
        a.du && h('button', { type: 'button', class: 'effacer-periode', 'aria-label': 'Effacer la période', onclick: () => { a.du = null; a.au = null; chargerArchives(); } }, icone('fermer', 14)),
        (() => {
          const s = h('select', { class: 'select', 'aria-label': 'Groupement' },
            h('option', { value: '' }, 'Tous les groupements'),
            S.groupements.map((g) => h('option', { value: g, selected: a.groupement === g }, g)));
          s.addEventListener('change', () => { a.groupement = s.value; rendre(); });
          return s;
        })()),
      h('div', { class: 'rangee', role: 'group', 'aria-label': 'Couleur' },
        FILTRES_COULEUR.map((c) => h('button', {
          type: 'button', class: 'puce puce-petite', 'aria-pressed': String(a.couleur === c.cle),
          title: c.cle !== 'toutes' ? `Selon la couleur du projet à la date de ${a.type === 'cree' ? 'création' : 'finalisation'}` : null,
          onclick: () => { a.couleur = c.cle; rendre(); },
        }, c.points && points(c.points), c.libelle))));

    let resume;
    if (!a.donnees) resume = h('p', { class: 'resume' }, 'Chargement…');
    else {
      const verbe = (a.type === 'cree' ? 'créée' : 'finalisée') + (n > 1 ? 's' : '');
      resume = h('p', { class: 'resume resume-ecran' },
        h('strong', null, `${n} tâche${n > 1 ? 's' : ''}`), ` ${verbe}`,
        libelle ? ` ${libelle.charAt(0).toLowerCase()}${libelle.slice(1)}` : ', toutes dates',
        a.groupement ? ` · ${a.groupement}` : '',
        a.couleur !== 'toutes' ? ` · ${coul.libelle.toLowerCase()}` : '',
        a.donnees.tronque ? ' (les 3000 plus récentes)' : '');
    }

    const liste = groupes.length
      ? h('section', { class: 'tuiles', 'aria-label': 'Résultats' }, groupes.map(({ projet: p, taches }) => h('article', { class: 'tuile arch-groupe' },
        h('div', { class: 'tuile-entete fond-couleur', 'data-couleur': p.couleur },
          h('h2', { class: 'tuile-titre' }, p.titre),
          h('span', { class: 'etiquette' }, p.groupement),
          p.archive_le && h('span', { class: 'age' }, 'projet archivé')),
        h('ul', { class: 'taches' }, taches.map((t) => {
          const texte = h('span', { class: 'tache-texte' });
          afficherTexte(texte, t.texte);
          return h('li', { class: 'arch-tache' },
            texte,
            t.recurrence && h('span', { class: 'rec' }, icone('recurrence', 12, 2.2), libelleRecurrence(t.recurrence)),
            h('span', { class: 'meta', title: `Créée le ${dateLongue(lireDate(t.cree_le))}` }, `créée ${dateCourte(lireDate(t.cree_le))}`),
            h('span', { class: 'meta fort', title: `Finalisée le ${dateLongue(lireDate(t.finalise_le))}` }, `finalisée ${dateCourte(lireDate(t.finalise_le))}`),
            h('button', { type: 'button', class: 'restaurer', 'aria-label': `Remettre en cours : ${texteBrut(t.texte)}`, title: 'Remettre en cours', onclick: () => restaurerTache(t) }, icone('annuler')));
        })))))
      : (a.donnees ? h('div', { class: 'vide' }, h('p', null, 'Aucune tâche archivée ne correspond.')) : null);

    return h('div', { class: 'page' }, entete(), filtres, resume, liste);
  }

  async function restaurerTache(t) {
    const r = await essayer(() => api('tache_restaurer', { methode: 'POST', donnees: { id: t.id } }));
    if (!r) return;
    await essayer(charger);
    await chargerArchives();
    toast('Tâche remise en cours.');
  }

  /* =========================================================
   * Vue « Compte »
   * ======================================================= */

  async function chargerCompte() {
    S.compte.info = await Noyau.api('sauvegarde_info');
    if (S.vue === 'compte' && S.ouvert) rendre();
    const e = Sync.etat();
    if (e.driveActif && Sync.jetonValide()) {
      try { S.compte.copies = await Sync.listerCopies(); S.compte.copiesErreur = null; }
      catch (err) { S.compte.copiesErreur = err.message; }
      if (S.vue === 'compte' && S.ouvert) rendre();
    }
  }

  /** Petite fenêtre à plusieurs choix. Résout avec la valeur du choix, ou null. */
  function choisir(titre, message, choix) {
    return new Promise((resoudre) => {
      const dlg = h('dialog', { class: 'confirmer', 'aria-labelledby': 'dlg-choix' },
        h('h2', { id: 'dlg-choix' }, titre),
        h('p', null, message),
        h('div', { class: 'pile-choix' },
          choix.map((c) => h('button', { type: 'button', class: 'bouton ' + (c.classe || ''), onclick: () => fermer(c.valeur) }, c.libelle)),
          h('button', { type: 'button', class: 'bouton bouton-texte', onclick: () => fermer(null) }, 'Annuler')));
      dlg.addEventListener('cancel', (e) => { e.preventDefault(); fermer(null); });
      document.body.append(dlg);
      dlg.showModal();
      function fermer(v) { dlg.close(); dlg.remove(); resoudre(v); }
    });
  }

  function montrerCle(cle) {
    const dlg = h('dialog', { class: 'confirmer' },
      h('h2', null, 'Ta nouvelle clé de récupération'),
      h('p', null, "L'ancienne ne fonctionne plus. Range celle-ci en lieu sûr."),
      blocCle(cle),
      h('div', { class: 'pied-pop' }, h('button', { type: 'button', class: 'bouton bouton-principal', onclick: () => { dlg.close(); dlg.remove(); } }, "C'est rangé")));
    dlg.addEventListener('cancel', (e) => e.preventDefault());
    document.body.append(dlg);
    dlg.showModal();
  }

  function vueCompte() {
    const info = S.compte.info;
    const retour = h('button', { type: 'button', class: 'retour', onclick: () => allerA('encours') }, icone('gauche', 16, 2.2), 'Mes tâches');
    if (!info) return h('div', { class: 'page page-large' }, retour, h('h1', { class: 'titre-page' }, 'Compte'), h('p', { class: 'chargement' }, 'Chargement…'));
    return h('div', { class: 'page page-large' },
      retour,
      h('header', null, h('h1', { class: 'titre-page' }, 'Compte'), h('p', { class: 'sous-titre' }, `Mes tâches · version ${Noyau.VERSION_APP}`)),
      h('div', { class: 'colonnes' }, carteDrive(), carteSecurite()),
      h('div', { class: 'colonnes' }, carteVeille(), carteCopies()),
      h('h2', { class: 'titre-section' }, 'Sauvegarde en fichier .zip'),
      h('div', { class: 'colonnes' }, carteExport(info), carteImport(info)),
      h('div', { class: 'colonnes' }, carteInstaller(), carteAppareil()),
      carteFormat());
  }

  /* ---------- Google Drive ---------- */

  function carteDrive() {
    const e = Sync.etat();
    const titre = h('h2', { id: 't-drive' }, h('span', { class: 'pastille-icone' }, icone('nuage', 18)), 'Google Drive');
    if (!e.googleConfigure) {
      return h('section', { class: 'carte', 'aria-labelledby': 't-drive' }, titre,
        h('p', { class: 'alerte erreur' }, 'La connexion Google Drive n’est pas encore configurée pour cette app.'),
        h('p', { class: 'aide' }, 'En attendant, tes tâches sont chiffrées et enregistrées sur cet appareil seulement. Exporte un .zip de temps en temps.'));
    }
    if (!e.driveActif) {
      const b = h('button', { type: 'button', class: 'bouton bouton-principal' }, icone('nuage'), 'Brancher Google Drive');
      b.addEventListener('click', () => occupe(b, 'Connexion…', brancherDrive));
      return h('section', { class: 'carte', 'aria-labelledby': 't-drive' }, titre,
        h('p', { class: 'alerte erreur' }, 'Tes tâches sont sur cet appareil seulement.'),
        h('p', { class: 'aide' }, 'Branche Google Drive pour les retrouver sur tes autres appareils, et en cas de perte ou de vol de celui-ci. Seul le coffre chiffré y est envoyé.'),
        b);
    }
    const lignes = [
      ['Compte Google', e.compte || '—'],
      ['Dernier enregistrement', e.dernierEnvoi ? `${dateCourte(new Date(e.dernierEnvoi))} à ${heure(new Date(e.dernierEnvoi))}` : 'pas encore'],
      ['État', (TEXTES_SYNC[e.statut] || TEXTES_SYNC.local)[0] + (e.statut === 'erreur' && e.message ? ` : ${e.message}` : '')],
    ];
    const actions = [];
    if (Sync.jetonValide()) {
      const b = h('button', { type: 'button', class: 'bouton' }, 'Synchroniser maintenant');
      b.addEventListener('click', () => occupe(b, 'Synchronisation…', async () => {
        await essayer(() => Sync.synchroniser());
        await chargerCompte();
      }));
      actions.push(b);
    } else {
      actions.push(h('button', { type: 'button', class: 'bouton bouton-principal', onclick: reconnecterDrive }, 'Reconnecter Google Drive'));
    }
    actions.push(h('button', { type: 'button', class: 'bouton bouton-texte', onclick: debrancherDrive }, 'Débrancher'));
    return h('section', { class: 'carte', 'aria-labelledby': 't-drive' }, titre,
      h('dl', { class: 'infos' }, lignes.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
      h('p', { class: 'aide' }, 'Tes tâches sont dans le dossier « Mes tâches » de ton Drive, chiffrées. L’app ne peut voir aucun autre fichier de ton Drive.'),
      h('div', { class: 'rangee' }, actions));
  }

  async function brancherDrive() {
    try {
      await Sync.connecterGoogle();
      const r = await Sync.activerDrive();
      if (r === 'conflit') {
        const choix = await choisir('Un autre coffre est déjà dans ton Drive',
          "Ton Drive contient déjà un coffre « Mes tâches », différent de celui de cet appareil (créé séparément). Lequel veux-tu garder ?",
          [
            { valeur: 'drive', libelle: 'Utiliser celui du Drive (son mot de passe sera demandé)', classe: 'bouton-principal' },
            { valeur: 'appareil', libelle: 'Garder celui de cet appareil (celui du Drive va à la corbeille)' },
          ]);
        if (choix === 'drive') {
          if (!(await confirmer('Remplacer les tâches de cet appareil ?', "Les tâches de cet appareil seront remplacées par celles du Drive. Exporte d'abord un .zip si tu veux les garder.", { ok: 'Remplacer', danger: true }))) return;
          S.ouvert = false;
          await Sync.prendreCoffreDrive();
          afficherDeverrouillage({ nouvelAppareil: true });
          return;
        }
        if (choix === 'appareil') {
          await Sync.remplacerCoffreDrive();
          toast('Google Drive branché. Le coffre de cet appareil y est enregistré ; l’ancien est dans la corbeille du Drive pendant 30 jours.', { duree: 9000 });
        }
      } else if (r === 'fusionne') {
        await charger();
        toast('Google Drive branché. Tes tâches ont été fusionnées avec celles du Drive.');
      } else {
        toast('Google Drive branché. Tes tâches y sont enregistrées, chiffrées.');
      }
      await chargerCompte();
      rendre();
    } catch (err) {
      toast(err.message, { erreur: true });
    }
  }

  async function debrancherDrive() {
    const ok = await confirmer('Débrancher Google Drive ?',
      'Les tâches restent sur cet appareil et dans ton Drive, mais les prochains changements ne seront plus envoyés. Sans Drive, une perte de cet appareil emporte tes tâches.',
      { ok: 'Débrancher', danger: true });
    if (!ok) return;
    await Sync.deconnecterDrive();
    S.compte.copies = null;
    Agenda.charger({ force: true }).catch(() => {});
    rendre();
  }

  /* ---------- Sécurité ---------- */

  function carteSecurite() {
    const msg = h('p', { class: 'alerte', role: 'status', hidden: true });
    const bouton = h('button', { type: 'submit', class: 'bouton bouton-principal' }, 'Changer le mot de passe');
    const form = h('form', { class: 'carte', 'aria-labelledby': 't-securite', novalidate: true },
      h('h2', { id: 't-securite' }, h('span', { class: 'pastille-icone' }, icone('cadenas', 18)), 'Mot de passe'),
      champMotDePasse('mdp-actuel', 'Mot de passe actuel', 'current-password'),
      champMotDePasse('mdp-nouveau', 'Nouveau mot de passe (12 caractères ou plus)', 'new-password'),
      champMotDePasse('mdp-confirm', 'Confirmer le nouveau mot de passe', 'new-password'),
      msg,
      h('div', { class: 'rangee' },
        bouton,
        h('button', { type: 'button', class: 'bouton', onclick: () => verrouillerMaintenant('manuel') }, icone('cadenas'), 'Verrouiller maintenant')),
      h('details', { class: 'plus' },
        h('summary', null, 'Nouvelle clé de récupération'),
        h('p', { class: 'aide' }, "Si ta clé actuelle a été vue ou perdue. L'ancienne cessera de fonctionner. Il faut ton mot de passe actuel (champ ci-dessus)."),
        h('button', { type: 'button', class: 'bouton', onclick: (e) => nouvelleCle(e.currentTarget) }, 'Générer une nouvelle clé')));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      msg.hidden = false;
      const nouveau = $('#mdp-nouveau', form).value;
      if (nouveau !== $('#mdp-confirm', form).value) { msg.className = 'alerte erreur'; msg.textContent = 'Les deux nouveaux mots de passe ne sont pas identiques.'; return; }
      occupe(bouton, 'Changement…', async () => {
        try {
          await Sync.changerMotDePasse($('#mdp-actuel', form).value, nouveau);
          form.reset();
          msg.className = 'alerte succes';
          msg.textContent = 'Mot de passe changé. Sur tes autres appareils, il sera demandé au prochain déverrouillage.';
        } catch (err) { msg.className = 'alerte erreur'; msg.textContent = err.message; }
      });
    });

    async function nouvelleCle(b) {
      const mdp = $('#mdp-actuel', form).value;
      msg.hidden = false;
      if (!mdp) { msg.className = 'alerte erreur'; msg.textContent = 'Entre ton mot de passe actuel dans le premier champ.'; $('#mdp-actuel', form).focus(); return; }
      await occupe(b, 'Génération…', async () => {
        try {
          const cle = await Sync.nouvelleCleRecuperation(mdp);
          $('#mdp-actuel', form).value = '';
          msg.hidden = true;
          montrerCle(cle);
        } catch (err) { msg.className = 'alerte erreur'; msg.textContent = err.message; }
      });
    }
    return form;
  }

  /* ---------- Mise en veille ---------- */

  function carteVeille() {
    const actuel = Number(Noyau.reglages().veille_minutes) || 0;
    const choix = [[1, '1 minute'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 heure'], [120, '2 heures'], [480, '8 heures'], [0, 'Jamais']];
    if (!choix.some(([v]) => v === actuel)) choix.push([actuel, `${actuel} minutes`]);
    const sel = h('select', { id: 'veille', class: 'select' }, choix.map(([v, l]) => h('option', { value: String(v), selected: v === actuel }, l)));
    sel.addEventListener('change', async () => {
      const v = Number(sel.value);
      Noyau.changerReglages({ veille_minutes: v });
      await Sync.memoriserCle();
      demarrerVeille();
      rendre();
      toast(v ? `Verrouillage après ${sel.selectedOptions[0].textContent} sans activité.` : 'Mise en veille désactivée.');
    });
    return h('section', { class: 'carte', 'aria-labelledby': 't-veille' },
      h('h2', { id: 't-veille' }, h('span', { class: 'pastille-icone' }, icone('horloge', 18)), 'Mise en veille'),
      h('div', { class: 'champ' }, h('label', { for: 'veille' }, 'Verrouiller après'), sel),
      h('p', { class: 'aide' }, "Après ce délai sans activité, l'app se verrouille et redemande ton mot de passe, même si tu la fermes et la rouvres. Le réglage suit tes appareils."),
      actuel === 0 && h('p', { class: 'alerte erreur' }, 'Déconseillé : toute personne qui utilise cet appareil verra tes tâches.'));
  }

  /* ---------- Copies dans le Drive ---------- */

  function nomCopie(c) {
    const d = new Date(c.cree_le);
    const avant = c.nom.match(/avant-(\w+)/);
    return `${fmtCourtAn.format(d)} à ${heure(d)}${avant ? ` · avant ${avant[1] === 'import' ? 'un import' : 'une restauration'}` : ''}`;
  }

  function carteCopies() {
    const e = Sync.etat();
    const titre = h('h2', { id: 't-copies' }, h('span', { class: 'pastille-icone' }, icone('annuler', 18)), 'Revenir en arrière');
    const intro = h('p', { class: 'aide' }, 'Une copie par jour, plus une avant chaque import ou restauration. Les 60 plus récentes sont gardées dans ton Drive, chiffrées.');
    let corps;
    if (!e.driveActif) corps = h('p', { class: 'aide' }, 'Les copies quotidiennes sont gardées dans Google Drive. Branche Drive pour les activer.');
    else if (!Sync.jetonValide()) corps = h('button', { type: 'button', class: 'bouton', onclick: reconnecterDrive }, 'Reconnecter Google Drive pour voir les copies');
    else if (S.compte.copiesErreur) corps = h('p', { class: 'alerte erreur' }, S.compte.copiesErreur);
    else if (!S.compte.copies) corps = h('p', { class: 'aide' }, 'Chargement…');
    else if (!S.compte.copies.length) corps = h('p', { class: 'aide' }, 'La première copie sera faite aujourd’hui.');
    else {
      const tout = S.compte.toutesCopies;
      const liste = tout ? S.compte.copies : S.compte.copies.slice(0, 6);
      corps = h('div', null,
        liste.map((c) => h('div', { class: 'copie' },
          h('span', null, nomCopie(c)),
          h('button', { type: 'button', class: 'bouton bouton-petit', onclick: () => restaurerCopie(c) }, 'Restaurer'))),
        S.compte.copies.length > 6 && h('button', { type: 'button', class: 'lien', onclick: () => { S.compte.toutesCopies = !tout; rendre(); } },
          tout ? 'Voir moins' : `Voir les ${S.compte.copies.length} copies`));
    }
    return h('section', { class: 'carte', 'aria-labelledby': 't-copies' }, titre, intro, corps);
  }

  async function restaurerCopie(c) {
    const ok = await confirmer('Restaurer cette copie ?',
      `Tes tâches reviendront à leur état du ${nomCopie(c)}. Une copie de l'état actuel est faite juste avant, au cas où.`, { ok: 'Restaurer', danger: true });
    if (!ok) return;
    const r = await essayer(async () => { await Sync.restaurerCopie(c.id); return true; });
    if (!r) return;
    await charger();
    await chargerCompte();
    toast('Copie restaurée.');
  }

  /* ---------- Installer l'app ---------- */

  function carteInstaller() {
    const installee = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
    return h('section', { class: 'carte', 'aria-labelledby': 't-installer' },
      h('h2', { id: 't-installer' }, h('span', { class: 'pastille-icone' }, icone('telecharger', 18)), 'Installer l’app'),
      installee
        ? h('p', { class: 'alerte succes' }, 'L’app est installée sur cet appareil.')
        : [
          S.installation && h('button', {
            type: 'button', class: 'bouton bouton-principal',
            onclick: async () => { S.installation.prompt(); await S.installation.userChoice.catch(() => {}); S.installation = null; rendre(); },
          }, 'Installer sur cet appareil'),
          h('ul', { class: 'liste-aide' },
            h('li', null, h('strong', null, 'Ordinateur (Chrome ou Edge) : '), 'icône d’installation au bout de la barre d’adresse, ou menu ⋮ → « Installer Mes tâches ».'),
            h('li', null, h('strong', null, 'iPhone (Safari) : '), 'bouton Partager → « Sur l’écran d’accueil ».'),
            h('li', null, h('strong', null, 'Android (Chrome) : '), 'menu ⋮ → « Installer l’application ».')),
        ],
      h('p', { class: 'aide' }, 'Installée, l’app a sa propre icône et sa propre fenêtre, et fonctionne même sans Internet.'));
  }

  /* ---------- Cet appareil ---------- */

  function carteAppareil() {
    const e = Sync.etat();
    return h('section', { class: 'carte', 'aria-labelledby': 't-appareil' },
      h('h2', { id: 't-appareil' }, h('span', { class: 'pastille-icone' }, icone('appareil', 18)), 'Cet appareil'),
      h('p', { class: 'aide' }, 'Avant de donner, vendre ou faire réparer cet appareil : efface le coffre et la connexion Google qui y sont gardés. ' + (e.driveActif ? 'Tes tâches restent dans ton Drive.' : '')),
      !e.driveActif && h('p', { class: 'alerte erreur' }, 'Google Drive n’est pas branché : effacer cet appareil supprimerait tes tâches pour de bon. Exporte d’abord un .zip.'),
      h('button', { type: 'button', class: 'bouton bouton-danger', onclick: oublierAppareil }, 'Effacer cet appareil'));
  }

  async function oublierAppareil() {
    const e = Sync.etat();
    const ok = await confirmer('Effacer cet appareil ?',
      e.driveActif
        ? "Le coffre et la connexion Google gardés sur cet appareil seront effacés. Tes tâches restent dans ton Drive : tu les retrouveras avec ton mot de passe."
        : "ATTENTION : Google Drive n'est pas branché. Tes tâches seront supprimées définitivement, sauf si tu as un .zip.",
      { ok: 'Effacer', danger: true });
    if (!ok) return;
    if (e.driveActif) { try { await Sync.enregistrerMaintenant(); } catch { /* rien */ } }
    await Sync.oublierAppareil();
    location.reload();
  }

  /* ---------- Export / import .zip ---------- */

  function carteExport(info) {
    const s = S.sauv;
    const annees = info.annees.length ? info.annees : [{ annee: new Date().getFullYear(), taches: 0, projets: 0 }];
    if (s.periode === null) s.periode = String(annees[0].annee);
    const coches = { encours: true, archives: true, couleurs: true };
    const radioAnnee = h('input', { type: 'radio', name: 'periode', checked: s.periode !== 'tout' });
    const radioTout = h('input', { type: 'radio', name: 'periode', checked: s.periode === 'tout' });
    const selAnnee = h('select', { class: 'champ-petit', 'aria-label': 'Année' }, annees.map((a) => h('option', { value: String(a.annee), selected: String(a.annee) === s.periode }, String(a.annee))));
    const resume = h('span', { class: 'aide' });
    const nom = h('span', { class: 'fichier-nom' });

    const maj = () => {
      const p = radioTout.checked ? 'tout' : selAnnee.value;
      s.periode = p;
      nom.textContent = `taches-${p}_${iso(new Date())}.zip`;
      const t = p === 'tout' ? annees.reduce((x, a) => x + a.taches, 0) : (annees.find((a) => String(a.annee) === p)?.taches || 0);
      resume.textContent = p === 'tout' ? `${info.projets} projet${info.projets > 1 ? 's' : ''} · ${t} tâche${t > 1 ? 's' : ''}` : `${t} tâche${t > 1 ? 's' : ''} créée${t > 1 ? 's' : ''} en ${p}, avec leurs projets`;
    };
    radioAnnee.addEventListener('change', maj);
    radioTout.addEventListener('change', maj);
    selAnnee.addEventListener('change', () => { radioAnnee.checked = true; maj(); });
    maj();

    const caseInclure = (cle, libelle) => {
      const c = h('input', { type: 'checkbox', checked: true });
      c.addEventListener('change', () => { coches[cle] = c.checked; });
      return h('label', { class: 'option' }, c, libelle);
    };

    const telecharger = async () => {
      if (!coches.encours && !coches.archives) { toast('Coche au moins « Tâches en cours » ou « Archives ».', { erreur: true }); return; }
      await essayer(async () => {
        const { blob, nom: nomFichier } = await Noyau.exporter({ periode: s.periode, ...coches });
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: nomFichier });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast(`Sauvegarde téléchargée : ${nomFichier}`);
        await chargerCompte();
      });
    };

    let derniere = "Aucune sauvegarde .zip téléchargée pour l'instant.";
    if (info.derniere_sauvegarde) {
      const d = lireDate(info.derniere_sauvegarde);
      const n = joursEntre(d, new Date());
      derniere = `Dernier .zip téléchargé : ${fmtJourMois.format(d)}, ${n <= 0 ? "aujourd'hui" : `il y a ${n} jour${n > 1 ? 's' : ''}`}.`;
    }

    return h('section', { class: 'carte', 'aria-labelledby': 't-export' },
      h('h2', { id: 't-export' }, h('span', { class: 'pastille-icone' }, icone('telecharger', 18)), 'Exporter'),
      h('p', { class: 'aide' }, derniere),
      h('fieldset', null, h('legend', null, 'Période'),
        h('div', { class: 'rangee' }, h('label', { class: 'option' }, radioAnnee, 'Une année'), selAnnee),
        h('label', { class: 'option' }, radioTout, 'Toutes les données'),
        h('p', { class: 'aide' }, "Une tâche appartient à l'année de sa création. Ses projets suivent avec elle.")),
      h('fieldset', null, h('legend', null, 'Inclure'),
        caseInclure('encours', 'Tâches en cours'), caseInclure('archives', 'Archives'), caseInclure('couleurs', 'Historique des couleurs')),
      h('div', { class: 'boite-grise' }, nom, resume),
      h('p', { class: 'aide' }, 'Ce fichier n’est pas chiffré : il est lisible dans Excel. Range-le en lieu sûr.'),
      h('button', { type: 'button', class: 'bouton bouton-principal', onclick: telecharger }, icone('telecharger', 16, 2.2), 'Télécharger le .zip'));
  }

  function carteImport(info) {
    const s = S.sauv;
    const input = h('input', { id: 'fichier-import', type: 'file', accept: '.zip,application/zip', class: 'visuellement-cache' });
    input.addEventListener('change', () => { if (input.files[0]) analyser(input.files[0]); });
    const depot = h('div', { class: 'depot' },
      h('span', null, 'Glisse un fichier .zip ici'),
      h('label', { for: 'fichier-import', class: 'bouton bouton-petit' }, 'Choisir un fichier'), input);
    depot.addEventListener('dragover', (e) => { e.preventDefault(); depot.classList.add('survol'); });
    depot.addEventListener('dragleave', () => depot.classList.remove('survol'));
    depot.addEventListener('drop', (e) => { e.preventDefault(); depot.classList.remove('survol'); const f = e.dataTransfer.files[0]; if (f) analyser(f); });

    const contenu = [h('h2', { id: 't-import' }, h('span', { class: 'pastille-icone' }, icone('televerser', 18)), 'Importer'), depot];
    const avecDrive = Sync.etat().driveActif;

    if (s.erreur) contenu.push(h('p', { class: 'alerte erreur', role: 'alert' }, s.erreur));
    if (s.apercu) {
      const a = s.apercu, t = a.totaux;
      const cree = a.cree_le ? fmtJourMois.format(lireDate(a.cree_le)) : 'date inconnue';
      const periode = a.periode === 'tout' ? 'toutes mes données' : `l'année ${a.periode}`;
      contenu.push(
        h('div', { class: 'alerte succes' },
          h('div', { class: 'rangee' }, icone('coche', 18, 2.4), h('span', { class: 'fichier-nom' }, a.fichier),
            h('button', { type: 'button', class: 'restaurer', 'aria-label': 'Retirer le fichier', onclick: () => { s.apercu = null; s.lu = null; rendre(); } }, icone('fermer'))),
          h('p', { class: 'aide' }, `Fichier valide · format version ${a.version} · créé le ${cree}`),
          h('p', { class: 'aide' }, `${t.projets} projet${t.projets > 1 ? 's' : ''} · ${t.taches} tâche${t.taches > 1 ? 's' : ''} (${t.en_cours} en cours, ${t.archivees} archivée${t.archivees > 1 ? 's' : ''}) · ${t.couleurs} changement${t.couleurs > 1 ? 's' : ''} de couleur`)),
        h('fieldset', null, h('legend', null, 'Que faire avec ce fichier ?'),
          optionMode('fusion', 'Fusionner avec mes données', "Ajoute ce qui manque. Ce qui existe déjà n'est pas touché."),
          optionMode('remplacer', `Remplacer ${periode}`, `Les données de ${periode} dans l'app sont remplacées par celles du fichier.`)),
        h('p', { class: 'aide' }, avecDrive
          ? 'Avant l’import, une copie de l’état actuel est gardée dans ton Drive (section « Revenir en arrière »).'
          : 'Sans Google Drive, aucune copie automatique : exporte d’abord un .zip si tu veux pouvoir revenir en arrière.'),
        h('button', { type: 'button', class: 'bouton bouton-principal', disabled: s.envoi, onclick: importer }, s.envoi ? 'Import en cours…' : `Importer ${t.taches} tâche${t.taches > 1 ? 's' : ''}`));
    }
    return h('section', { class: 'carte', 'aria-labelledby': 't-import' }, contenu);

    function optionMode(v, titre, texte) {
      const r = h('input', { type: 'radio', name: 'mode', value: v, checked: s.mode === v });
      r.addEventListener('change', () => { s.mode = v; });
      return h('label', { class: 'option option-carte' }, r, h('span', null, h('strong', null, titre), h('small', null, texte)));
    }

    async function analyser(f) {
      s.erreur = null; s.apercu = null; s.lu = null;
      if (f.size > info.taille_max_mo * 1024 * 1024) { s.erreur = `Fichier trop volumineux (${info.taille_max_mo} Mo au maximum).`; rendre(); return; }
      try {
        const lu = await Noyau.lireFichierEchange(f);
        s.lu = lu;
        s.apercu = { fichier: f.name, cree_le: lu.manifeste.cree_le || null, version: Number(lu.manifeste.version), periode: lu.periode, totaux: Noyau.totaux(lu.donnees) };
        s.mode = 'fusion';
      } catch (e) { s.erreur = e.message; }
      rendre();
    }

    async function importer() {
      const a = s.apercu;
      if (s.mode === 'remplacer') {
        const periode = a.periode === 'tout' ? 'toutes tes données' : `toutes les tâches de ${a.periode}`;
        if (!(await confirmer('Remplacer les données ?', `${periode.charAt(0).toUpperCase() + periode.slice(1)} seront remplacées par le contenu du fichier.`, { ok: 'Remplacer', danger: true }))) return;
      }
      s.envoi = true; rendre();
      try {
        if (Sync.etat().driveActif) {
          try { await Sync.copieAvant('import'); } catch (e) {
            if (!(await confirmer('Copie de sécurité impossible', `La copie dans le Drive a échoué (${e.message}). Importer quand même ?`, { ok: 'Importer quand même', danger: true }))) { s.envoi = false; rendre(); return; }
          }
        }
        const st = Noyau.ecrireEchange(s.lu.donnees, s.mode, s.lu.periode);
        await Sync.enregistrerMaintenant();
        toast(`Import terminé : ${st.taches_ajoutees} tâche${st.taches_ajoutees > 1 ? 's' : ''} ajoutée${st.taches_ajoutees > 1 ? 's' : ''}, ${st.projets_ajoutes} projet${st.projets_ajoutes > 1 ? 's' : ''} ajouté${st.projets_ajoutes > 1 ? 's' : ''}${st.taches_ignorees ? `, ${st.taches_ignorees} déjà présente${st.taches_ignorees > 1 ? 's' : ''}` : ''}.`, { duree: 8000 });
        s.apercu = null; s.lu = null;
        await charger();
      } catch (e) { s.erreur = e.message; }
      s.envoi = false;
      await chargerCompte();
    }
  }

  function carteFormat() {
    return h('section', { class: 'carte', 'aria-labelledby': 't-format' },
      h('h2', { id: 't-format' }, 'Ce que contient le .zip'),
      h('p', { class: 'aide' }, "Un format ouvert et documenté : du JSON pour l'app, plus un CSV lisible dans Excel ou Google Sheets. Une version future de l'app, ou un autre outil, pourra relire n'importe quelle sauvegarde, y compris celles de la version serveur."),
      h('div', { class: 'arbre' },
        'taches-2026_2026-11-17.zip\n',
        '├─ manifeste.json  ', h('span', { class: 'gris' }, 'format, version, date, totaux'), '\n',
        '├─ projets.json    ', h('span', { class: 'gris' }, 'titre, groupement, couleur'), '\n',
        '├─ taches.json     ', h('span', { class: 'gris' }, 'texte, gras, dates, récurrence'), '\n',
        '├─ couleurs.json   ', h('span', { class: 'gris' }, 'chaque changement de couleur'), '\n',
        '└─ taches.csv      ', h('span', { class: 'gris' }, 'la même chose, en tableau')));
  }

  /* =========================================================
   * Impression
   * ======================================================= */

  function imprimer() {
    const zone = $('#entete-impression');
    let sousTitre, total;
    if (S.vue === 'archives') {
      const a = S.arch;
      const groupes = selectionArchives();
      const n = groupes.reduce((s, g) => s + g.taches.length, 0);
      sousTitre = ['Archives', `${a.type === 'cree' ? 'créées' : 'finalisées'} ${(plage(a.du, a.au) || 'toutes dates').toLowerCase()}`,
        a.groupement || 'tous les groupements', a.couleur === 'toutes' ? null : FILTRES_COULEUR.find((c) => c.cle === a.couleur).libelle.toLowerCase()].filter(Boolean).join(' · ');
      total = `${n} tâche${n > 1 ? 's' : ''}, ${groupes.length} projet${groupes.length > 1 ? 's' : ''}`;
    } else {
      if (S.vue !== 'encours') { S.vue = 'encours'; rendre(); }
      const f = S.filtre;
      const sel = selection().filter((x) => x.projet.couleur !== 'gris');
      const n = sel.reduce((s, g) => s + g.taches.length, 0);
      sousTitre = ['En cours', f.groupement || 'tous les groupements', f.du ? `créées ${plage(f.du, f.au).toLowerCase()}` : 'toutes les dates',
        f.couleur === 'toutes' ? null : FILTRES_COULEUR.find((c) => c.cle === f.couleur).libelle.toLowerCase()].filter(Boolean).join(' · ');
      total = `${n} tâche${n > 1 ? 's' : ''}, ${sel.length} projet${sel.length > 1 ? 's' : ''}`;
    }
    zone.replaceChildren(
      h('div', null, h('h1', null, 'Mes tâches'), h('p', null, sousTitre)),
      h('div', { class: 'droite' }, h('p', null, `Imprimé le ${fmtJourMois.format(new Date())}`), h('p', null, total)));
    window.print();
  }

  /* =========================================================
   * Rafraîchissements et démarrage
   * ======================================================= */

  // Changements d'un autre appareil arrivés pendant une édition : appliqués dès qu'elle se termine.
  setInterval(() => {
    if (S.distantEnAttente && S.ouvert && !editionActive && !pop && !document.querySelector('dialog[open]')) rafraichirDepuisDistant(true);
  }, 3000);
  // Chaque minute : nouveau jour (bloc « Aujourd'hui » à refaire) ou simple mise à jour de l'agenda.
  let jourAffiche = iso(new Date());
  setInterval(async () => {
    if (!S.ouvert) return;
    const jour = iso(new Date());
    if (jour !== jourAffiche) {
      jourAffiche = jour;
      if (S.vue === 'encours' && !editionActive && !pop && !document.querySelector('dialog[open]')) { await essayer(charger); rendre(); }
      Agenda.charger({ force: true }).catch(() => {});
    } else majAgenda();
  }, 60000);
  // Les minuteries sont ralenties en arrière-plan : on vérifie la veille au retour.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifierVeille(); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installation = e; });

  demarrer();
})();
