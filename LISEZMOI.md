# Mes tâches · version 2

Liste de tâches par projets, sans serveur. Les tâches sont chiffrées dans le navigateur avec ton mot de passe, gardées sur l'appareil, puis synchronisées dans ton Google Drive. L'app s'installe sur l'ordinateur et le téléphone, et fonctionne sans Internet.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css`, `app.js` | interface |
| `noyau.js` | projets, tâches, récurrence, archives, fusion entre appareils, .zip |
| `coffre.js` | chiffrement (AES-256-GCM, PBKDF2-SHA-256 600 000 itérations, clé de récupération) |
| `stockage.js` | stockage sur l'appareil (IndexedDB) et synchronisation Google Drive |
| `agenda.js` | Google Agenda en lecture seule, pour le bloc « Aujourd'hui » |
| `config.js` | **le seul fichier à remplir** : l'identifiant client Google |
| `sw.js`, `manifest.webmanifest`, `icone-*` | installation et fonctionnement hors ligne |

Aucune dépendance, aucune étape de compilation : on dépose les fichiers tels quels.

## 1. Mise en ligne sur GitHub Pages

1. Sur github.com, ouvrir le dépôt public `mes-taches`.
2. Y déposer tous les fichiers de ce dossier, à la racine (bouton **Add file → Upload files**).
3. **Settings → Pages** : *Source* = « Deploy from a branch », branche `main`, dossier `/ (root)`, **Save**.
4. Après une minute, l'app est en ligne à `https://NOM-UTILISATEUR.github.io/mes-taches/`.

Sans configuration Google, l'app fonctionne déjà, avec les données sur l'appareil seulement.

## 2. Configuration Google (une seule fois, environ 15 minutes)

Dans la [Google Cloud Console](https://console.cloud.google.com/), avec le compte Gmail qui contiendra les tâches :

1. **Créer un projet** nommé « Mes taches ».
2. **API et services → Bibliothèque** : activer **Google Drive API**.
3. **Google Auth Platform** (anciennement « Écran de consentement OAuth ») → *Commencer* :
   - Nom de l'app : `Mes tâches`, adresse de support : ton Gmail.
   - Audience : **Externe**.
4. **Audience → Utilisateurs test** : ajouter ton adresse Gmail. On laisse l'app en mode « Test » : seules les adresses de cette liste peuvent se connecter.
5. **Accès aux données → Ajouter des champs d'application** : cocher `.../auth/drive.file` (« voir, modifier, créer et supprimer uniquement les fichiers Google Drive que vous utilisez avec cette app »).
6. **Clients → Créer un client** : type **Application Web**.
   - *Origines JavaScript autorisées* : `https://NOM-UTILISATEUR.github.io` (sans `/mes-taches`, sans barre finale).
   - Aucune URI de redirection n'est nécessaire.
7. Copier l'**ID client** (`…apps.googleusercontent.com`) dans `config.js`, puis redéposer ce fichier.

Ces réglages peuvent prendre de 5 minutes à quelques heures avant d'être actifs.

À la première connexion, Google affiche « Google n'a pas validé cette application » : c'est normal pour une app personnelle en mode Test. Cliquer sur **Continuer**, puis cocher l'accès à Google Drive.

L'ID client n'est pas un secret : il dit seulement à Google quelle app demande l'accès. Il n'y a aucun « secret client » dans cette app.

### Google Agenda (facultatif, pour le bloc « Aujourd'hui »)

1. **API et services → Bibliothèque** : activer **Google Calendar API**.
2. **Google Auth Platform → Accès aux données → Ajouter ou supprimer des niveaux d'accès** : cocher
   `.../auth/calendar.calendarlist.readonly` et `.../auth/calendar.events.readonly`, puis **Mettre à jour** et **Save**.
3. Dans l'app, bloc « Aujourd'hui » → **Afficher mon Google Agenda**, puis cocher les deux accès à l'agenda dans la fenêtre Google.

L'agenda est lu seulement, jamais modifié. Les rendez-vous restent en mémoire : ils ne sont écrits ni sur l'appareil ni dans le Drive, et sont oubliés au verrouillage. Le réglage vaut pour l'appareil (« Masquer » le retire).

## 3. Utilisation

- **Premier appareil :** « Continuer avec Google Drive », choisir un mot de passe (12 caractères ou plus), puis ranger la **clé de récupération** affichée.
- **Autre appareil, ou PC remplacé :** ouvrir l'adresse, « Continuer avec Google Drive », entrer le mot de passe. Tout revient.
- **Installer :** dans Chrome ou Edge, icône d'installation dans la barre d'adresse. Sur iPhone : Partager → « Sur l'écran d'accueil ». Sur Android : menu ⋮ → « Installer l'application ».
- **Paiements à venir :** sous « Aujourd'hui ». Échéances de taxes qui reviennent aux mois choisis (DAS, TPS/TVQ, CNESST, Registre… ou les tiennes), à cocher quand c'est payé. Liste modifiable dans Compte → Paiements de taxes, avec un lien facultatif vers ton état de comptes. Gardées chiffrées dans le coffre.
- **Prochaine paye :** sous les paiements. Date de la prochaine paye et période payée, calculées à partir d'une date de paye et d'une fréquence (Compte → Paye).
- **Tri des projets :** ordre des tuiles (glisser-déposer), ordre alphabétique, ou dernière modification (projet ou une de ses tâches). Le glisser-déposer n'est actif qu'en « ordre des tuiles ». Le choix suit les appareils.
- **Groupements :** liste modifiable dans Compte → Groupements (ou « Gérer les groupements… » au bas des menus) : ajouter, renommer, réordonner, retirer (ses projets sont déplacés vers le groupement choisi). La liste suit les appareils.
- **Lien d'un projet :** menu ⋯ → « Ajouter un lien… » (dossier Google Drive, site web…). Une icône 🔗 s'affiche après le nom du projet ; l'adresse complète n'apparaît pas (infobulle : « Dossier Google Drive », « anfitek.com »…).
- **Modifier / supprimer une tâche :** jamais sur un simple clic. Double-clic sur le texte pour le modifier (Ctrl+B pour le gras), ou menu ⋯ au bout de la tâche : Modifier le texte, Lien, Répéter, Couleur, Supprimer (10 s pour annuler). Au doigt, le menu ⋯ regroupe ces actions.
- **Ordre des tâches :** glisser la poignée ⠿ qui apparaît à gauche d'une tâche au survol (ou la sélectionner au clavier et utiliser ↑ ↓). Menu ⋯ du projet → « Trier les tâches… » : urgentes d'abord, alphabétique, plus anciennes ou plus récentes d'abord (tri ponctuel, avec Annuler).
- **Images d'une tâche :** icône 🖼 au survol de la tâche (ou menu ⋯ → « Ajouter une image… ») : choisir des fichiers, les glisser, ou coller une capture (Ctrl+V). Réduites à 2400 px, chiffrées sur l'appareil puis envoyées dans le Drive (même hors ligne : envoi au retour d'Internet). Visionneuse plein écran (← →, télécharger, supprimer avec Annuler). Onglet « Images » : galerie de toutes les images, par mois, filtrable par projet. **Conservation :** une image est retirée automatiquement après 31 jours (compte à rebours sur la vignette, en rouge les 7 derniers jours), sauf si elle est marquée « conserver » (signet en haut à gauche). Galerie : « Sélectionner » pour conserver, rendre temporaires ou supprimer plusieurs images d'un coup.
- **Lien d'une tâche :** au survol de la tâche, icône 🔗 « Ajouter un lien ». Une fois ajouté, l'icône reste au bout de la ligne (le petit chevron à côté permet de modifier ou retirer). Suit la tâche quand elle se répète.
- **Bloc-notes temporaire :** icône crayon (ou touche « N »). Fenêtre flottante, déplaçable et redimensionnable, pour noter ou coller du texte. Rien n'est gardé : le contenu disparaît à la fermeture (8 s pour annuler) et au verrouillage. « + Tâche » (ou Ctrl+Entrée) enregistre le texte, ou la sélection, en tâche dans le projet choisi (ou « À classer »), au besoin une tâche par ligne.
- **Filtres (une seule rangée) :** recherche (touche « / »), puis menus Groupement, Couleur, Dates, Projet et Tri. Chaque choix affiche son nombre de tâches ; un filtre actif devient noir avec un × pour le retirer, et une ligne « N tâches dans N projets · Tout effacer » apparaît.
- **Couleur d'une tâche = priorité :** pastille devant le texte (clic pour choisir : urgent, à prévoir ou aucune). Le filtre Couleur, le tri « Urgentes d'abord » et la section Urgent du bloc Aujourd'hui se basent seulement sur la pastille.
- **Couleur d'un projet = repère (2.16) :** pastille ronde de l'en-tête → nuancier de 60 petites cases, une colonne par famille (rouge, orange, jaune, vert, turquoise, bleu, violet, rose, brun, ardoise), de pâle (haut) à foncé (bas) ; le nom s'affiche au survol. Flèches du clavier pour se déplacer. « Aucune » et « Complété » sous la grille. Sur les nuances foncées, le texte de l'en-tête passe en blanc. Les anciennes couleurs de priorité restent affichées jusqu'à ce qu'on en choisisse une autre.
- **Aujourd'hui :** à gauche sur grand écran, sous la date sur téléphone (repliable). Rendez-vous du jour (Google Agenda), tâches répétées revenues aujourd'hui (cochables), projets urgents (un clic mène au projet).
- **Impression (dans Compte) :** couleurs, économie d'encre (fonds blancs, trait de couleur) ou noir et blanc (couleur écrite en toutes lettres) ; 1 ou 2 colonnes ; taille du texte ; lignes pour notes ; cases, dates et récurrences à afficher ou non. Les choix suivent les appareils.
- **Compte :** mot de passe, nouvelle clé de récupération, mise en veille, Google Drive, copies, export et import .zip, effacement de l'appareil.

## 4. Publier une nouvelle version

1. Dans `sw.js`, changer `VERSION` (ex. `2.0.1`). Dans `noyau.js`, changer `VERSION_APP` pareillement.
2. Déposer les fichiers modifiés sur GitHub.
3. Les appareils affichent « Une nouvelle version de l'app est prête » → **Mettre à jour**. Rien n'est perdu : les changements en cours sont enregistrés avant.

**Revenir à une version précédente :** dans GitHub, onglet *Commits*, ouvrir la version voulue et la redéposer, ou faire un « revert ». Les données ne dépendent pas de la version : elles restent dans le Drive.

## Sécurité

- Chiffrement de bout en bout : Google ne stocke qu'un fichier illisible.
- Une clé de données aléatoire chiffre les tâches. Elle est enveloppée par le mot de passe et par la clé de récupération. Changer le mot de passe ne réécrit que l'enveloppe.
- Aucun mot de passe n'est stocké, nulle part.
- Accès Google limité à `drive.file` : l'app ne voit que les fichiers qu'elle a créés. Google Agenda, si activé : lecture seule.
- Mise en veille : la clé est effacée de la mémoire après le délai choisi (15 minutes par défaut).
- Politique de sécurité du contenu (CSP) stricte : seuls les fichiers de l'app et les services Google nécessaires sont autorisés.
- Points d'attention : protéger le compte GitHub et le compte Google par la double authentification ; choisir une phrase de passe longue. **Sans le mot de passe ni la clé de récupération, les tâches sont irrécupérables.**

## Sauvegardes

- **Continue :** le coffre chiffré dans le dossier « Mes tâches » du Drive. Drive garde aussi son propre historique de versions.
- **Copies :** une par jour, plus une avant chaque import ou restauration (les 60 plus récentes), restaurables depuis Compte.
- **.zip :** export non chiffré (JSON + CSV), dans le même format que la version serveur. Compatible dans les deux sens.

## Fichiers dans le Drive

```
Mes tâches/
  mes-taches.coffre                 le coffre (chiffré)
  copie-2026-11-17.coffre           copies quotidiennes (chiffrées)
  copie-2026-11-17-14h05-avant-import.coffre
  <id>.image, <id>.mini             images jointes et miniatures (chiffrées)
```

Une image supprimée va dans la corbeille du Drive (gardée 30 jours par Google). L'export .zip peut inclure les images (en clair, dans `images/`), et l'import les reprend.
