# Implementasjonsplan: Scienta Team Catalog

## Oversikt

Planen er delt inn i 6 faser. Hver fase må være ferdig før neste starter. Infrastruktur settes opp parallelt med koding der det er mulig.

---

## Fase 1: Prosjektoppsett

### 1.1 Mappestruktur
Opprett følgende struktur i `Scienta_team_catalog/`:
```
Scienta_team_catalog/
  frontend/          # React + Vite app
  backend/           # Ktor prosjekt
  .gitignore
  CLAUDE.md
  spec.md
  plan.md
```

### 1.2 Git
- [ ] Initialiser git i rot (`git init`)
- [ ] Lag `.gitignore` (node_modules, .env, build/, .gradle/, *.jar)
- [ ] Første commit med docs
- [ ] Push til Scienta GitHub org når invitasjon er mottatt

### 1.3 Firebase prosjekt
- [ ] Opprett nytt Firebase-prosjekt på console.firebase.google.com
- [ ] Aktiver **Firestore** (production mode)
- [ ] Aktiver **Authentication** → Email/Password provider
- [ ] Last ned **service account JSON** (til Ktor)
- [ ] Legg til en admin-bruker manuelt: Firebase Console → Authentication → Add user
- [ ] Opprett tilhørende dokument i `admins/{uid}` i Firestore

### 1.4 Resend
- [ ] Opprett konto på resend.com
- [ ] Verifiser avsenderdomene (eller bruk `onboarding@resend.dev` for testing)
- [ ] Generer API-nøkkel

---

## Fase 2: Backend — Ktor

### 2.1 Prosjektoppsett
- [ ] Opprett Ktor-prosjekt via [start.ktor.io](https://start.ktor.io) med følgende plugins:
  - Routing
  - Content Negotiation (kotlinx.serialization)
  - Status Pages
- [ ] Legg til avhengigheter i `build.gradle.kts`:
  - `firebase-admin` (Firebase Admin SDK)
  - `resend-kotlin` eller Resend Java SDK
  - `ktor-server-netty`
  - `kotlinx-serialization-json`
  - Ktor HTTP-klient (for Flowcase-kall)
- [ ] Konfigurer `shadowJar` / `fatJar` for Docker-bygg
- [ ] Lag `Dockerfile`
- [ ] Lag `.env.example` med alle nødvendige variabler

### 2.2 Konfigurasjon og oppstart
- [ ] Les miljøvariabler ved oppstart (`FLOWCASE_API_KEY`, `RESEND_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `SCHEDULER_SECRET`)
- [ ] Initialiser Firebase Admin SDK med service account JSON
- [ ] Initialiser Resend-klient
- [ ] Konfigurer Ktor med JSON-serialisering og CORS (tillat frontend-domenet)

### 2.3 Auth-middleware
- [ ] Lag `authenticateFirebase()` funksjon som:
  - Leser `Authorization: Bearer <token>` header
  - Verifiserer token med `FirebaseAuth.getInstance().verifyIdToken(token)`
  - Sjekker at UID finnes i Firestore `admins` collection
  - Returnerer `401` hvis ugyldig

### 2.4 `GET /health`
- [ ] Returner `200 OK` med `{ "status": "ok" }`

### 2.5 `POST /sync`
- [ ] Beskytt med `authenticateFirebase()`
- [ ] Kall Flowcase `GET /api/v2/users/search` med Bearer token
- [ ] Parse respons: hent `id`, `name` per bruker
- [ ] Kall foto-endepunktet per bruker (respekter rate limit: maks 5 req/s)
- [ ] Upsert til Firestore `consultants/{flowcaseId}` med `merge: true`
  - Sett kun: `flowcaseId`, `name`, `photoUrl`
- [ ] Returner `{ "synced": N }`

### 2.6 `POST /check-contracts`
- [ ] Valider `X-Scheduler-Secret` header mot `SCHEDULER_SECRET` env var → `401` hvis feil
- [ ] Hent alle dokumenter fra Firestore `consultants` hvor `warningDate == today` (midnatt UTC)
- [ ] For hvert treff:
  - Hent `clientId` → slå opp klientnavn fra `clients/{clientId}`
  - Hvis `notifyAll == true`: hent alle e-poster fra `admins` collection
  - Hvis `notifyAll == false`: hent e-poster for UIDs i `notifyList`
  - Send e-post via Resend
- [ ] Returner `{ "notified": N }`

### 2.7 Lokal testing
- [ ] Test `/health` lokalt med `curl`
- [ ] Test `/sync` med en test-Firebase-token
- [ ] Test `/check-contracts` med riktig `SCHEDULER_SECRET`

---

## Fase 3: Frontend — React + Vite

### 3.1 Prosjektoppsett
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install firebase react-router-dom
npm install -D tailwindcss @tailwindcss/vite
```
- [ ] Konfigurer Tailwind i `vite.config.ts`
- [ ] Lag `.env` med Firebase-konfig og `VITE_API_BASE_URL`
- [ ] Opprett `src/firebase.ts` — initialiser Firebase app, auth, og Firestore

### 3.2 Auth-lag
- [ ] `src/hooks/useAuth.ts` — lytter på `onAuthStateChanged`, sjekker `admins/{uid}` i Firestore
- [ ] `src/components/ProtectedRoute.tsx` — redirecter til `/login` hvis ikke autentisert admin
- [ ] Sett opp React Router med routes: `/login`, `/`, `/consultant/:id`

### 3.3 Login-side (`/login`)
- [ ] E-post og passord-felt
- [ ] Kall `signInWithEmailAndPassword`
- [ ] Vis feilmelding ved feil innlogging
- [ ] Redirect til `/` ved suksess

### 3.4 Konsulentliste (`/`)
- [ ] Real-time Firestore listener på `consultants` collection
- [ ] Vis tabell med: foto (rundt bilde), navn, klientnavn, kontraktslutt, dager igjen
- [ ] Fargeindikator per rad:
  - Grønn: > 30 dager igjen
  - Gul: ≤ 30 dager igjen
  - Rød: ≤ 7 dager eller utløpt
- [ ] Konsulenter uten kontrakt vises nederst uten fargeindikator
- [ ] "Synkroniser"-knapp øverst til høyre:
  - Henter Firebase ID-token med `getIdToken()`
  - Kaller `POST /sync` på Ktor
  - Viser loading-spinner under synk
  - Viser suksess/feil-melding

### 3.5 Konsulentdetalj / edit (`/consultant/:id`)
- [ ] Hent konsulentdokument fra Firestore
- [ ] Vis (read-only): foto og navn (fra Flowcase)
- [ ] Redigerbare felt:
  - **Kunde**: dropdown fra `clients` collection + "Legg til ny kunde"-valg
  - **Kontraktstart**: date picker
  - **Kontraktslutt**: date picker
  - **Varslingsdato**: date picker
  - **Varsle**: toggle mellom "Varsle alle" og velg spesifikke admins (multi-select fra `admins` collection)
- [ ] "Lagre"-knapp: skriv til Firestore `consultants/{id}` med kun admin-feltene
- [ ] "Tilbake"-lenke til listen

### 3.6 Legg til ny kunde (modal)
- [ ] Åpnes når admin velger "Legg til ny kunde" i dropdown
- [ ] Felt: navn (påkrevd), kontaktperson (valgfritt), notater (valgfritt)
- [ ] Lagrer til `clients` collection, velger automatisk den nye kunden i dropdownen

---

## Fase 4: Firestore sikkerhet

### 4.1 Security rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null &&
             exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    match /consultants/{id} {
      allow read, write: if isAdmin();
    }
    match /clients/{id} {
      allow read, write: if isAdmin();
    }
    match /admins/{id} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```
- [ ] Deploy regler via Firebase Console eller `firebase deploy --only firestore:rules`

### 4.2 Firestore indekser
- [ ] Composite index på `consultants`: `warningDate` (ASC) — brukes av `/check-contracts`

---

## Fase 5: Infrastruktur og deploy

### 5.1 Docker og AWS App Runner
- [ ] Bygg fat JAR: `./gradlew buildFatJar`
- [ ] Bygg Docker-image og test lokalt
- [ ] Push image til AWS ECR (Elastic Container Registry)
- [ ] Opprett App Runner service pekt på ECR-imaget
- [ ] Sett miljøvariabler i App Runner (eller via AWS Secrets Manager)
- [ ] Verifiser `/health` endepunktet svarer

### 5.2 AWS EventBridge Scheduler
- [ ] Opprett ny schedule: `cron(0 8 * * ? *)` (08:00 UTC)
- [ ] Target: HTTPS endpoint → `POST https://<app-runner-url>/check-contracts`
- [ ] Legg til header: `X-Scheduler-Secret: <verdi>`

### 5.3 Firebase Hosting
- [ ] Installer Firebase CLI: `npm install -g firebase-tools`
- [ ] `firebase init hosting` i `frontend/`
  - Public dir: `dist`
  - SPA: ja (rewrites alle routes til `index.html`)
- [ ] `npm run build && firebase deploy --only hosting`
- [ ] Verifiser at appen er tilgjengelig på Firebase Hosting URL

---

## Fase 6: Testing og ferdigstillelse

### 6.1 End-to-end test
- [ ] Logg inn med admin-bruker
- [ ] Trykk "Synkroniser" — verifiser at konsulenter dukker opp
- [ ] Gå inn på en konsulent, sett klient, kontraktsdatoer, varslingsdato til i dag
- [ ] Kjør `POST /check-contracts` manuelt med curl — verifiser at e-post mottas
- [ ] Sjekk fargeindikatorene i listen

### 6.2 Produksjonssjekk
- [ ] Bytt Resend avsenderadresse til produksjonsdomene
- [ ] Verifiser EventBridge trigger med logg i CloudWatch
- [ ] Legg til alle admin-brukere i Firebase Auth + `admins` collection

---

## Avhengigheter som må være på plass før start

| Hva | Hvor |
|---|---|
| Firebase prosjekt opprettet | console.firebase.google.com |
| Flowcase API-nøkkel | Flowcase admin |
| Resend konto + API-nøkkel | resend.com |
| AWS konto med App Runner + ECR tilgang | aws.amazon.com |
| Scienta GitHub org-tilgang | Invitasjon avventes |
