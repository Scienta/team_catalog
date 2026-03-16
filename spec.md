# Technical Specification: Konsulent Admin

## Overview

Internal web application for managing consultant placements and contract expiry. Admins manage client assignments and receive email alerts on configurable dates.

---

## System Architecture

```
Browser (React + Vite)
    │
    ├── Firebase Auth (login/session)
    ├── Firestore (read consultant/client data directly)
    └── Ktor API (write operations + Flowcase sync)
            │
            ├── Flowcase API (consultant import)
            ├── Firebase Admin SDK (Firestore writes, token verification)
            └── Resend (email)

AWS EventBridge Scheduler
    └── POST /check-contracts → Ktor (daily at 08:00)
```

---

## Backend: Ktor (Kotlin)

### Tech
- Ktor with `netty` engine
- Firebase Admin SDK (JVM) for Firestore access and ID token verification
- `kotlinx.serialization` for JSON
- Resend Java SDK for email
- Deployed as Docker container on AWS App Runner

### Endpoints

#### `POST /sync`
Triggers a full sync from Flowcase to Firestore.

- Requires valid Firebase ID token in `Authorization: Bearer <token>` header
- Verifies caller exists in `admins` Firestore collection
- Calls `GET https://api.flowcase.com/api/v2/users/search` with `Authorization: Bearer <FLOWCASE_API_KEY>`
- For each user: fetches profile photo URL
- Upserts each consultant into Firestore `consultants/{flowcaseId}`:
  - Sets `name`, `photoUrl`, `flowcaseId`
  - Uses Firestore `set(..., merge: true)` to preserve admin fields
- Returns `{ synced: N }` with count of upserted records

#### `POST /check-contracts`
Called by AWS EventBridge Scheduler daily at 08:00. Not authenticated via Firebase token — secured via a shared secret in the `X-Scheduler-Secret` header.

- Queries Firestore for all consultants where `warningDate == today`
- For each match:
  - If `notifyAll == true`: fetch all emails from `admins` collection
  - If `notifyAll == false`: fetch emails for UIDs in `notifyList`
  - Send email via Resend with consultant name, client name, and contract end date
- Returns `{ notified: N }`

#### `GET /health`
Returns `200 OK`. Used by App Runner health checks.

### Firebase token verification
All non-scheduler endpoints verify the `Authorization: Bearer` token using Firebase Admin SDK `FirebaseAuth.verifyIdToken()`. Requests with invalid or missing tokens return `401`.

---

## Frontend: React + Vite + TypeScript

### Tech
- React 19 + React Router v7
- Tailwind CSS v4
- Firebase JS SDK (Auth + Firestore)

### Pages & Components

#### Login (`/login`)
- Email/password form using Firebase Auth `signInWithEmailAndPassword`
- Redirects to `/` on success
- No public access to any other route — `ProtectedRoute` wrapper checks auth state and `admins` collection membership

#### Consultant List (`/`)
- Fetches all documents from `consultants` Firestore collection (real-time listener)
- Displays: photo, name, client name, contract end date, days until expiry
- Color indicator: green (>30 days), yellow (≤30 days), red (≤7 days or expired)
- "Synkroniser" button: calls `POST /sync` with user's Firebase ID token, shows loading state
- Click row → navigate to `/consultant/:id`

#### Consultant Detail / Edit (`/consultant/:id`)
- Fetches consultant document from Firestore
- Displays Flowcase fields (read-only): name, photo
- Editable fields:
  - **Client**: dropdown populated from `clients` Firestore collection + "Legg til ny kunde" option
  - **Contract start**: date picker
  - **Contract end**: date picker
  - **Warning date**: date picker (the specific date to send email)
  - **Notify**: toggle "Varsle alle" or select specific admins from `admins` collection (multi-select)
- Save: writes directly to Firestore `consultants/{id}` via client SDK
- No delete functionality for consultants (managed via Flowcase)

#### Add/Edit Client (modal or inline)
- Triggered from consultant edit view when "Legg til ny kunde" is selected
- Fields: name, contactPerson (optional), notes (optional)
- Writes to `clients` Firestore collection

---

## Firebase

### Firestore Schema

```
consultants/{flowcaseId}
  name: string
  photoUrl: string
  flowcaseId: string
  clientId: string | null
  contractStart: timestamp | null
  contractEnd: timestamp | null
  warningDate: timestamp | null
  notifyAll: boolean
  notifyList: string[]   // array of admin UIDs

clients/{clientId}
  name: string
  contactPerson: string | null
  notes: string | null

admins/{uid}
  name: string
  email: string
```

### Security Rules
- `consultants` and `clients`: read/write only if `request.auth != null && exists(/databases/$(database)/documents/admins/$(request.auth.uid))`
- `admins`: read only if authenticated, write disallowed from client (managed manually or via Firebase console)

### Auth
- Provider: Email/Password
- Admin accounts created manually via Firebase Console or a one-time setup script

---

## Email (Resend)

Email sent when `warningDate == today` for a consultant.

**Subject:** `Kontraktsvarsel: [Consultant Name]`

**Body:**
```
Hei,

Dette er en påminnelse om at kontrakten til [Consultant Name] hos [Client Name] utløper [contractEnd].

Logg inn for å se detaljer.
```

Sender address configured in Resend dashboard.

---

## Infrastructure

### AWS App Runner
- Docker image built from Ktor fat JAR
- Environment variables injected via AWS Secrets Manager
- Health check: `GET /health`
- Auto-scaling: min 1 instance (always warm)

### AWS EventBridge Scheduler
- Schedule: `cron(0 8 * * ? *)` (08:00 UTC daily)
- Target: `POST https://<app-runner-url>/check-contracts`
- Header: `X-Scheduler-Secret: <shared-secret>`

### Firebase Hosting
- Hosts the React frontend (static build output from `npm run build`)
- All routes → `index.html` (SPA routing)

---

## Flowcase API

Base URL: `https://api.flowcase.com`
Auth: `Authorization: Bearer <FLOWCASE_API_KEY>`
Rate limit: 5 req/s, max 150 req/min

Endpoints used:
- `GET /api/v2/users/search` — fetch all users (name, id, email)
- Profile photo endpoint per user — fetch photo URL

During sync, Ktor batches photo requests to respect rate limits.

---

## Environment Variables

### Frontend (`.env`)
| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_API_BASE_URL` | Ktor backend base URL |

### Backend (Ktor / AWS Secrets Manager)
| Variable | Description |
|---|---|
| `FLOWCASE_API_KEY` | Flowcase bearer token |
| `RESEND_API_KEY` | Resend API key |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase service account JSON (stringified) |
| `SCHEDULER_SECRET` | Shared secret for EventBridge → Ktor auth |
