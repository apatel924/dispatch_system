"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  getFirebaseClientConfig,
  isFirebaseClientConfigured,
} from "@/lib/auth/config";

let firebaseApp: FirebaseApp | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseClientConfigured()) {
    throw new Error(
      "Firebase client is not configured. Set NEXT_PUBLIC_FIREBASE_* variables in .env.local.",
    );
  }

  if (firebaseApp) return firebaseApp;

  const existing = getApps()[0];
  if (existing) {
    firebaseApp = existing;
    return firebaseApp;
  }

  firebaseApp = initializeApp(getFirebaseClientConfig());
  return firebaseApp;
}

export function getClientAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<User> {
  const result = await signInWithEmailAndPassword(getClientAuth(), email, password);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(getClientAuth());
}

export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  const user = getClientAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export interface DriverAuthClaims {
  role?: string;
  driverId?: string;
}

export async function getDriverAuthClaims(): Promise<DriverAuthClaims | null> {
  const user = getClientAuth().currentUser;
  if (!user) return null;
  const result = await user.getIdTokenResult();
  const claims = result.claims;
  return {
    role: typeof claims.role === "string" ? claims.role : undefined,
    driverId: typeof claims.driverId === "string" ? claims.driverId : undefined,
  };
}

export function subscribeToAuthState(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(getClientAuth(), callback);
}

export function isAuthConfigured(): boolean {
  return isFirebaseClientConfigured();
}
