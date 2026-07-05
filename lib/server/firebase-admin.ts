import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";
import {
  getFirebaseAdminPrivateKey,
  isFirebaseAdminConfigured,
} from "@/lib/server/env";

export { isFirebaseAdminConfigured };

let adminApp: App | undefined;

export function getFirebaseAdminApp(): App {
  if (!isFirebaseAdminConfigured()) {
    throw new Error(
      "Firebase Admin is not configured. Copy .env.example to .env.local and set FIREBASE_* variables.",
    );
  }

  if (adminApp) return adminApp;

  const existing = getApps()[0];
  if (existing) {
    adminApp = existing;
    return adminApp;
  }

  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: getFirebaseAdminPrivateKey()!,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });

  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getFirebaseAdminApp());
}
