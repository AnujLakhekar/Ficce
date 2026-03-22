import { getApps, initializeApp, cert, type App } from "firebase-admin/app"
import { getFirestore, type Firestore } from "firebase-admin/firestore"

let cachedApp: App | null = null

function getPrivateKey(): string | undefined {
  const value = process.env.FIREBASE_PRIVATE_KEY
  return value ? value.replace(/\\n/g, "\n") : undefined
}

export function getFirebaseAdminApp(): App {
  if (cachedApp) {
    return cachedApp
  }

  if (getApps().length > 0) {
    cachedApp = getApps()[0]!
    return cachedApp
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = getPrivateKey()

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    )
  }

  cachedApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })

  return cachedApp
}

export function getFirebaseAdminDb(): Firestore {
  return getFirestore(getFirebaseAdminApp())
}
