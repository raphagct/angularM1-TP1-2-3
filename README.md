# 🎸 Guitar Practice Cloud — Rendu TP1 · TP2 · TP3

Front **Angular 22** connecté à une API **Express 5 / Mongoose 9 / MongoDB Atlas** :
comptes utilisateurs, profil, bibliothèque audio paginée, upload avec progression,
lecture authentifiée et suppression de pistes.

> **Auteurs :** Raphaël Guichet et Badr Otarid — M1, module Web / Angular

| | |
|---|---|
| 📄 Compte rendu détaillé et rapport IA | [RAPPORT_IA_MODELE.md](RAPPORT_IA_MODELE.md) |
| 🖼️ Captures d'écran et logs | [captures/](captures/) |
| 🔌 Contrat de l'API | [API_CONTRACT.md](API_CONTRACT.md) |
| 📝 Sujets | [TP1](SUJET_ETUDIANT_TP1.md) · [TP2](SUJET_ETUDIANT_TP2.md) · [TP3](SUJET_ETUDIANT_TP3.md) |

---

## Sommaire

1. [Ce qui a été réalisé](#1-ce-qui-a-été-réalisé)
2. [Utilisation de l'IA](#2-utilisation-de-lia)
3. [Lancer le projet](#3-lancer-le-projet)
4. [Tests et build](#4-tests-et-build)
5. [Structure du dépôt](#5-structure-du-dépôt)

---

## 1. Ce qui a été réalisé

### TP1 — Authentification et profil

- ✅ Formulaires réactifs d'**inscription** et de **connexion**, avec validations et messages d'erreur
- ✅ JWT stocké dans `localStorage`, état exposé par les Signals `token` et `currentUser`
- ✅ Redirection après connexion / inscription, **déconnexion** avec nettoyage de l'état
- ✅ Page **profil** : `GET /api/users/me` puis modification du nom via `PUT /api/users/me`
- ✅ Gestion du **`401`** dans l'intercepteur : déconnexion et retour vers `/login`
- ✅ Menu cohérent après un rechargement (F5)

### TP2 — Bibliothèque, upload et lecture audio

- ✅ **Pagination serveur** : chaque changement de page relance `GET /api/tracks?page=…&limit=…`
- ✅ _(Avancé)_ Paginator **Angular Material**, libellés traduits en français
- ✅ État de la page en Signals : `tracks`, `page`, `pages`, `loading`, `error`
- ✅ **Validation frontend** du fichier avant envoi (types MIME du backend, 25 Mo max)
- ✅ Upload multipart (`audio` + `title`), bouton désactivé, messages de succès / d'erreur serveur
- ✅ **Lecture authentifiée** : `Blob` → `URL.createObjectURL` → `<audio>`, révocation de l'ancienne URL et à la destruction du composant
- ✅ Cards responsives : titre, nom original, format, taille, date, lecture
- ✅ Réponses aux questions mémoire / buffering / streaming → [rapport](RAPPORT_IA_MODELE.md#mémoire-et-streaming)

### TP3 — Fiabilisation et enrichissement

- ✅ **Suppression** d'une piste : confirmation, anti double-clic, **SnackBar** Material, rechargement de la liste
- ✅ Cas limites : piste déjà supprimée ou appartenant à un autre utilisateur (`404`), page devenue vide, piste en cours de lecture
- ✅ **Progression de l'upload** (`reportProgress` + `observe: 'events'`) : repos, en cours (%), réussite, échec
- ✅ Succès annoncé uniquement à la réception de la réponse finale, pas à 100 %
- ✅ **21 tests frontend** automatisés, sans backend ni MongoDB
- ✅ Logs console et backend propres, sans mot de passe ni JWT

---

## 2. Utilisation de l'IA

| | Agent | Modèle pour le code | Modèle pour les questions |
|---|---|---|---|
| Raphaël | Claude Code | Claude Opus 5.5 | Claude Haiku 5.5 |
| Badr | Codex | GPT Sol | Luna |

Pour chaque mission, nous demandions d'abord à l'agent un plan d'implémentation (une spécification), et nous le validions avant qu'il écrive le code.

### TP1

- **Objectif** : inscription, connexion, déconnexion et profil.
- **Prompt principal** : « Voici le sujet du TP1 et le contrat de l'API. Fais-moi d'abord un plan pour l'inscription et la connexion avec des formulaires réactifs et des Signals, sans toucher au backend. »
- **Plan proposé** : formulaires réactifs, `AuthService` qui enregistre le token, menu qui change selon l'utilisateur connecté, puis la page profil.
- **Vérifications** : tests dans le navigateur, onglet Network, `npm test`.
- **Erreurs rejetées** : un mot de passe de 6 caractères minimum au lieu de 8 (la règle du backend), et la perte de l'utilisateur affiché après F5.
- **Fichiers modifiés** : `app/*`, `login-page/*`, `register-page/*`, `profile-page/*`, `styles.css`.
- **Preuve** : captures et tableau Network dans le [rapport](RAPPORT_IA_MODELE.md).
- **Ce qu'on sait expliquer** : le trajet d'une connexion, la différence entre Signal et `localStorage`, et le rôle de l'intercepteur et du guard.

### TP2

- **Objectif** : pagination côté serveur, upload, lecture audio et cards.
- **Prompt principal** : « Fais un plan pour la pagination côté serveur avec des Signals. Je veux que chaque changement de page refasse une requête au backend. Explique-moi aussi pourquoi on passe par un Blob pour lire l'audio. »
- **Plan proposé** : envoi des paramètres dans `list()`, ajout de Signals et du paginator, validation du fichier, lecture avec `Blob` et `ObjectURL`.
- **Vérifications** : requêtes `page=1` puis `page=2` dans Network, upload puis lecture d'une piste, envoi d'un fichier non audio.
- **Erreurs rejetées** : une pagination qui découpait la liste côté Angular, et l'idée de mettre le token dans l'URL de l'audio.
- **Fichiers modifiés** : `tracks-page.*`, `track.service.ts`, `styles.css`.
- **Preuve** : captures et tableau Network dans le [rapport](RAPPORT_IA_MODELE.md).
- **Ce qu'on sait expliquer** : le passage `Blob` → `ObjectURL`, pourquoi `src` n'envoie pas le JWT, et pourquoi on valide le fichier côté front et côté back.

### TP3

- **Objectif** : suppression d'une piste, progression de l'upload et tests.
- **Prompt principal** : « Pour la mission 5, propose un plan pour supprimer une piste avec une confirmation et un message de succès ou d'erreur. Explique aussi comment le backend empêche de supprimer la piste de quelqu'un d'autre. »
- **Plan proposé** : `TrackService.delete()`, un état `deleting`, un SnackBar, la progression avec `withXhr()`, puis les tests avec `HttpTestingController`.
- **Vérifications** : `npm test`, `npm run build`, suppression et upload dans le navigateur.
- **Erreurs rejetées** : un succès affiché dès 100 % au lieu d'attendre la réponse, une progression bloquée à 0 sans `withXhr()`, et des tests qui plantaient à cause de `localStorage`.
- **Fichiers modifiés** : `tracks-page.*`, `track.service.ts`, `*.spec.ts`, `main.ts`, `package.json`.
- **Preuve** : captures et tableau des tests dans le [rapport](RAPPORT_IA_MODELE.md).
- **Ce qu'on sait expliquer** : les réponses de la restitution orale.

---

## 3. Lancer le projet

**Prérequis :** Node.js 22+, un cluster MongoDB Atlas (voir [ATLAS_SETUP.md](ATLAS_SETUP.md)).

### Backend — `http://localhost:3000`

```bash
cd backend
# créer backend/.env avec : MONGODB_URI=…, JWT_SECRET=…, PORT=3000 (optionnel)
npm install
npm start
```

Vérification : `GET http://localhost:3000/api/health`.
Les traces du serveur (`[http]`, `[auth]`, `[tracks]`, `[multer]`) s'affichent dans ce terminal.

### Frontend — `http://localhost:4200`

```bash
cd frontend-starter
npm install
npm start              # ng serve avec proxy.conf.json → localhost:3000
```

Compte de démonstration : **`demo@example.com` / `Demo1234!`**
Fichiers audio de test : [`frontend-starter/fichiers-audio-de-test/`](frontend-starter/fichiers-audio-de-test/).

---

## 4. Tests et build

```bash
cd frontend-starter
npm test          # Vitest + HttpTestingController
npm run build
```

Résultat : **5 fichiers, 21 tests, tous verts.**

| Fichier de test | Ce qui est vérifié |
|---|---|
| [auth.service.spec.ts](frontend-starter/src/app/shared/services/auth.service.spec.ts) | `POST /api/auth/login` avec le bon corps, token enregistré |
| [track.service.spec.ts](frontend-starter/src/app/shared/services/track.service.spec.ts) | paramètres `page` / `limit`, upload multipart et événements de progression |
| [auth.interceptor.spec.ts](frontend-starter/src/app/shared/interceptors/auth.interceptor.spec.ts) | header `Authorization: Bearer …` quand un token existe |
| [auth.guard.spec.ts](frontend-starter/src/app/shared/guards/auth.guard.spec.ts) | redirection vers `/login` sans token, accès avec token |
| [tracks-page.spec.ts](frontend-starter/src/app/components/tracks-page/tracks-page.spec.ts) | suppression (confirmation, annulation, double appel, rechargement, page vide), progression et échec d'upload, refus d'un type MIME, erreur `400`, lecture en `Blob`, révocation de l'`ObjectURL` |

Les contrôles de contrat de l'API (`401` sans JWT, JWT invalide, upload sans fichier, etc.) sont
consignés dans [captures/api-checks.json](captures/api-checks.json).

---

## 5. Structure du dépôt

```text
.
├── backend/                 API Express + Mongoose (src/app.js, src/models/, test/)
├── frontend-starter/        Application Angular
│   └── src/app/
│       ├── components/      app, login, register, profile, tracks
│       └── shared/          services, intercepteur, guard, modèles, composants UI
├── captures/                Captures d'écran et journaux (console, Network, backend)
├── RAPPORT_IA_MODELE.md     Compte rendu par mission + usage de l'IA
├── API_CONTRACT.md          Contrat de l'API
├── ATLAS_SETUP.md           Configuration de MongoDB Atlas
└── SUJET_ETUDIANT_TP*.md    Sujets des trois TP
```
