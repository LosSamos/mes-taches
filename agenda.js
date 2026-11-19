/* Mes tâches · Google Agenda (lecture seule) pour le bloc « Aujourd'hui »
 *
 * - Utilise le même jeton Google que la synchronisation Drive (un seul clic renouvelle les deux).
 * - Lit les agendas cochés dans Google Agenda et leurs événements du jour.
 * - Les événements restent en mémoire seulement : rien n'est écrit sur l'appareil ni dans le Drive.
 */
(() => {
  'use strict';

  const RAFRAICHIR_MS = 10 * 60 * 1000;
  const A = { statut: 'inactif', evenements: [], jour: null, chargeLe: 0, message: '' };
  let agendas = null;          // [{ id, nom, couleur }] gardé jusqu'au verrouillage
  let enCours = null;
  let ouvert = false;          // vrai seulement quand l'app est déverrouillée
  const ecouteurs = new Set();

  const pad = (n) => String(n).padStart(2, '0');
  const jourLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  function etat() { return { ...A, evenements: A.evenements.slice() }; }
  function annoncer() { for (const f of ecouteurs) { try { f(etat()); } catch { /* rien */ } } }
  function statut(s, message = '') { A.statut = s; A.message = message; annoncer(); }

  async function listerAgendas() {
    try {
      const r = await Sync.requeteGoogle('/calendar/v3/users/me/calendarList', { maxResults: '250', fields: 'items(id,summary,summaryOverride,backgroundColor,selected,hidden,primary)' });
      const liste = (r.items || []).filter((c) => (c.selected || c.primary) && !c.hidden)
        .map((c) => ({ id: c.id, nom: c.summaryOverride || c.summary || '', couleur: c.backgroundColor || null, principal: Boolean(c.primary) }));
      return liste.length ? liste : [{ id: 'primary', nom: '', couleur: null, principal: true }];
    } catch (e) {
      if (e.code === 'jeton' || e.code === 'reseau' || diagnostic(e)[0] === 'erreur' && e.statut === 403 && /pas activée/.test(diagnostic(e)[1])) throw e;
      return [{ id: 'primary', nom: '', couleur: null, principal: true }];
    }
  }

  function lireEvenement(ev, agenda) {
    if (!ev || ev.status === 'cancelled') return null;
    if (ev.eventType === 'workingLocation') return null;
    if ((ev.attendees || []).some((a) => a.self && a.responseStatus === 'declined')) return null;
    const journee = Boolean(ev.start?.date && !ev.start?.dateTime);
    const debut = journee ? null : new Date(ev.start?.dateTime);
    const fin = journee ? null : new Date(ev.end?.dateTime);
    if (!journee && (Number.isNaN(debut?.getTime()) || Number.isNaN(fin?.getTime()))) return null;
    return {
      id: `${agenda.id}/${ev.id}`,
      cle: `${ev.iCalUID || ev.id}|${ev.start?.dateTime || ev.start?.date}`,
      titre: (ev.summary || '').trim() || 'Occupé',
      journee, debut, fin,
      lieu: ev.location || '',
      lien: /^https:\/\/(www\.)?google\.com\/calendar\//.test(ev.htmlLink || '') ? ev.htmlLink : null,
      couleur: agenda.couleur,
      agenda: agenda.principal ? '' : agenda.nom,
    };
  }

  async function lireJour(jour) {
    const [a, m, d] = jour.split('-').map(Number);
    const debut = new Date(a, m - 1, d), fin = new Date(a, m - 1, d + 1);
    if (!agendas) agendas = await listerAgendas();
    const resultats = await Promise.all(agendas.map(async (ag) => {
      try {
        const r = await Sync.requeteGoogle(`/calendar/v3/calendars/${encodeURIComponent(ag.id)}/events`, {
          timeMin: debut.toISOString(), timeMax: fin.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '100',
          fields: 'items(id,iCalUID,summary,location,htmlLink,status,eventType,start,end,attendees(self,responseStatus))',
        });
        return (r.items || []).map((ev) => lireEvenement(ev, ag)).filter(Boolean);
      } catch (e) {
        // Un agenda partagé devenu inaccessible ne doit pas cacher les autres.
        if (e.code === 'jeton' || e.code === 'reseau' || (e.statut === 403 && (ag.principal || agendas.length === 1))) throw e;
        return [];
      }
    }));
    const vus = new Set();
    const tous = [];
    for (const ev of resultats.flat()) { if (!vus.has(ev.cle)) { vus.add(ev.cle); tous.push(ev); } }
    tous.sort((x, y) => (x.journee !== y.journee ? (x.journee ? -1 : 1) : x.journee ? x.titre.localeCompare(y.titre, 'fr') : x.debut - y.debut || x.fin - y.fin));
    return tous;
  }

  /** Traduit un refus de Google en statut clair. */
  function diagnostic(e) {
    const texte = `${e.raisons || ''} ${e.detail || ''}`;
    if (/SERVICE_DISABLED|accessNotConfigured|has not been used|is disabled|n'a pas été utilisée|est désactivée/i.test(texte)) {
      return ['erreur', 'L’API Google Calendar n’est pas activée dans le projet Google Cloud « Mes taches » (ou elle vient de l’être : Google peut prendre quelques minutes).'];
    }
    if (e.statut === 401 || /SCOPE_INSUFFICIENT|insufficientPermissions|insufficient authentication scopes/i.test(texte)) return ['autoriser'];
    if (e.statut === 403) return ['erreur', `Google Agenda refuse l’accès${e.detail ? ` : « ${e.detail} »` : '.'}`];
    return ['erreur', 'Google Agenda n’a pas répondu correctement. Réessaie dans un moment.'];
  }

  /** Recharge les événements du jour (sans fenêtre Google : si une autorisation manque, le statut le dit). */
  async function charger({ force = false } = {}) {
    if (!ouvert) return;
    if (!Sync.agenda) { if (A.statut !== 'inactif' || A.evenements.length) { A.evenements = []; statut('inactif'); } return; }
    const jour = jourLocal();
    if (A.jour !== jour) { A.evenements = []; A.jour = null; }
    if (!force && A.statut === 'ok' && A.jour === jour && Date.now() - A.chargeLe < RAFRAICHIR_MS) return;
    if (!Sync.jetonValide()) { statut('reconnexion'); return; }
    if (!Sync.agendaAutorise()) { statut('autoriser'); return; }
    if (navigator.onLine === false) { statut('hors-ligne'); return; }
    if (enCours) return enCours;
    if (!A.jour) statut('chargement');
    enCours = (async () => {
      try {
        const evenements = await lireJour(jour);
        if (!ouvert) return;
        A.evenements = evenements;
        A.jour = jour; A.chargeLe = Date.now();
        statut('ok');
      } catch (e) {
        if (e.code === 'jeton') statut('reconnexion');
        else if (e.code === 'reseau') statut('hors-ligne');
        else statut(...diagnostic(e));
      } finally { enCours = null; }
    })();
    return enCours;
  }

  /** Branche l'agenda : à appeler depuis un clic (fenêtre Google). */
  async function activer() {
    await Sync.reglerAgenda(true);
    try {
      await Sync.connecterGoogle({ agenda: true });
    } finally {
      agendas = null;
      await charger({ force: true });
    }
  }

  async function desactiver() {
    await Sync.reglerAgenda(false);
    agendas = null; A.evenements = []; A.jour = null;
    statut('inactif');
  }

  /** Au verrouillage : on oublie tout ce qui a été lu. */
  function demarrer() { ouvert = true; return charger(); }

  function vider() {
    ouvert = false;
    agendas = null; A.evenements = []; A.jour = null; A.chargeLe = 0;
    A.statut = 'inactif'; A.message = '';
  }

  window.addEventListener('online', () => charger().catch(() => {}));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') charger().catch(() => {}); });
  setInterval(() => { if (document.visibilityState === 'visible') charger().catch(() => {}); }, 60000);

  window.Agenda = {
    etat, demarrer, charger, activer, desactiver, vider,
    surChangement(f) { ecouteurs.add(f); return () => ecouteurs.delete(f); },
  };
})();
