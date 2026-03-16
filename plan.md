# Implementasjonsplan: Scienta Team Catalog

## Oversikt

Planen er delt inn i 6 faser. Infrastruktur settes opp parallelt med koding der det er mulig.

---

## Fase 1: Prosjektoppsett ✅

- [x] Mappestruktur opprettet
- [x] Git init, .gitignore, push til Scienta GitHub
- [x] Firebase: Firestore, Authentication (Google), service account
- [x] Admin-bruker opprettet i Firestore `admins/{uid}`
- [x] Resend API-nøkkel
- [ ] Verifiser avsenderdomene i Resend (gjøres ved produksjonssetting)

---

## Fase 2: Backend — Ktor ✅

- [x] Ktor prosjekt med avhengigheter, fatJar, Dockerfile
- [x] Miljøvariabler, Firebase Admin SDK, Resend-klient
- [x] `authenticateFirebase()` middleware
- [x] `GET /health`
- [x] `POST /sync` — henter fra Flowcase (`?limit=100`), upsert + sletter deaktiverte
- [x] `POST /check-contracts` — validerer scheduler secret, sender e-post via Resend
- [x] `POST /admin/lookup-user` — slår opp Firebase-bruker via e-post

---

## Fase 3: Frontend — React + Vite ✅

- [x] Vite + React + TypeScript + Tailwind CSS v4
- [x] Google sign-in, `useAuth`, `ProtectedRoute`, React Router
- [x] Scienta logo, dark mode, DM Sans font, delt Layout

### Sider
- [x] `/login` — Google-innlogging
- [x] `/` — Dashboard med kakediagram, nøkkeltall, kommende utløp, uten-prosjekt-liste
- [x] `/consultants` — Konsulentliste med filter-sidebar (kunder/prosjekter), fargekoding
- [x] `/consultant/:id` — Kontraktsdatoer, varsling
- [x] `/clients` — Kundeliste
- [x] `/clients/:id` — Kundedetaljer, prosjekter, legg til/fjern konsulenter med søk
- [x] `/admins` — Admin-administrasjon

### Data-modell (endret fra original plan)
- Konsulenter tilknyttes prosjekter fra prosjektsiden (ikke omvendt)
- `consultantIds[]` lagres på prosjekt-dokumentet
- En konsulent kan være på flere prosjekter/kunder

---

## Fase 4: Firestore sikkerhet

- [x] Firestore security rules deployet
- [x] Firebase Storage aktivert og regler opprettet
- [ ] **Composite index**: `consultants` → `warningDate` ASC (trengs av `/check-contracts`)

---

## Fase 5: Deploy 🔜 NESTE

### 5.1 AWS App Runner (backend)
- [ ] Bygg fat JAR: `./gradlew buildFatJar`
- [ ] Bygg og test Docker-image lokalt
- [ ] Push til AWS ECR
- [ ] Opprett App Runner service pekt på ECR
- [ ] Sett miljøvariabler i App Runner
- [ ] Verifiser `GET /health` svarer

### 5.2 AWS EventBridge Scheduler
- [ ] Schedule: `cron(0 8 * * ? *)` — 08:00 UTC daglig
- [ ] Target: `POST <app-runner-url>/check-contracts`
- [ ] Header: `X-Scheduler-Secret: <verdi>`

### 5.3 Firebase Hosting (frontend)
- [ ] Kjør `npm run build` i `frontend/`
- [ ] `firebase init hosting` (public dir: `dist`, SPA: ja)
- [ ] Oppdater `VITE_API_BASE_URL` i `.env` til App Runner URL
- [ ] `firebase deploy --only hosting`

---

## Fase 6: Testing og ferdigstillelse

- [ ] Logg inn med Google i produksjon
- [ ] Sync konsulenter fra Flowcase
- [ ] Opprett kunde + prosjekt, legg til konsulenter
- [ ] Sett varslingsdato til i dag, kjør `/check-contracts` manuelt med curl
- [ ] Verifiser at e-post mottas
- [ ] Verifiser EventBridge trigger i CloudWatch
- [ ] Legg til alle admin-brukere
