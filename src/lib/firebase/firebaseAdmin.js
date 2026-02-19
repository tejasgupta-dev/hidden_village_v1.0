import admin from "firebase-admin";

if (!admin.apps.length) {
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    throw new Error("Missing Firebase Admin environment variables");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    databaseURL: process.env.NEXT_PUBLIC_DATABASE_URL,
    // storageBucket is optional as of now
    ...(process.env.FIREBASE_STORAGE_BUCKET
      ? { storageBucket: process.env.FIREBASE_STORAGE_BUCKET }
      : {}),
  });
}

const auth = admin.auth();
const db = admin.database();

const storage = process.env.FIREBASE_STORAGE_BUCKET
  ? admin.storage().bucket(process.env.FIREBASE_STORAGE_BUCKET)
  : null;

export { auth, db, storage };

export async function verifySession(sessionCookie) {
  return auth.verifySessionCookie(sessionCookie, true);
}
