# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Konsulent Admin

An internal admin tool for managing consultants. Fetches consultant profiles from Flowcase, lets admins track client placements and contract expiry, and sends targeted email alerts on configurable warning dates.

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS v4
- **Backend**: Ktor (Kotlin) on AWS App Runner (containerized via Docker)
- **Database + Auth**: Firebase Firestore + Firebase Auth
- **Email**: Resend (via Ktor)
- **Flowcase**: Ktor calls Flowcase REST API server-side (keeps API key out of browser)

## Commands

Frontend:
```bash
npm run dev       # Start Vite dev server
npm run build     # TypeScript check + Vite build
npm run lint      # ESLint
```

Backend (Ktor):
```bash
./gradlew run           # Run locally
./gradlew buildFatJar   # Build JAR for Docker
docker build -t konsulent-admin-api .
docker run -p 8080:8080 konsulent-admin-api
```

## Architecture

### Data flow
- Ktor exposes a `POST /sync` endpoint. Admin triggers this via a "Synkroniser" button in the UI. Ktor fetches all users from Flowcase (`GET /api/v2/users/search` + photo endpoint) and upserts into Firestore `consultants` collection without overwriting admin-set fields.
- Admins assign consultants to clients by selecting from the `clients` collection, then set contract dates and a specific `warningDate`.
- A daily scheduled job (AWS EventBridge Scheduler → Ktor `POST /check-contracts`) checks if any `warningDate == today` and sends emails via Resend to the configured recipients.

### Firestore collections
- `consultants/{flowcaseId}` — Flowcase data (name, photoUrl) + admin fields (clientId, contractStart, contractEnd, warningDate, notifyAll, notifyList)
- `clients/{clientId}` — client/customer records (name, contactPerson, notes)
- `admins/{uid}` — admin users (name, email)

### Auth
- Firebase Auth (email/password). All routes require authentication. Admin access is verified against the `admins` Firestore collection. No public pages.
- Firestore security rules enforce that only authenticated admins can read/write.
- Ktor verifies Firebase ID tokens on all API endpoints.

### Frontend structure
- React Router with two main views: consultant list and consultant detail/edit.
- Client management (add/edit clients) accessible from the consultant edit view.

### Email notifications
- Ktor reads consultants where `warningDate == today`, resolves recipients (all admins if `notifyAll`, else users in `notifyList`), and sends via Resend.
- AWS EventBridge Scheduler triggers daily at 08:00.

## Environment variables

Frontend `.env`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=       # Ktor backend URL
```

Ktor (env vars or AWS Secrets Manager):
```
FLOWCASE_API_KEY=
RESEND_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=
```
