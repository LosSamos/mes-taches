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
- **Rechercher / choisir un projet :** zone de recherche (nom des projets et texte des tâches, sans tenir compte des accents ni des majuscules ; Échap pour effacer) et menu « Tous les projets » pour n'en afficher qu'un.
- **Couleur d'une tâche :** pastille devant le texte (clic pour choisir : urgent, à prévoir ou aucune). Le projet garde sa propre couleur. Les filtres de couleur prennent la couleur de la tâche, ou celle de son projet si la tâche n'en a pas.
- **Aujourd'hui :** à gauche sur grand écran, sous la date sur téléphone (repliable). Rendez-vous du jour (Google Agenda), tâches répétées revenues aujourd'hui (cochables), projets urgents (un clic mène au projet).
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
```
