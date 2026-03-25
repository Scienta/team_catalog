import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

let app: FirebaseApp
let auth: Auth
let db: Firestore

export async function initFirebase() {
  const res = await fetch('/config')
  const config = await res.json()
  app = initializeApp(config)
  auth = getAuth(app)
  db = getFirestore(app)
}

export { auth, db }
