import type { Firestore } from "firebase-admin/firestore";

export const COLLECTIONS = {
  orders: "orders",
  drivers: "drivers",
  users: "users",
  importLogs: "importLogs",
  auditLogs: "auditLogs",
  counters: "counters",
  trackingLinks: "trackingLinks",
  rateLimits: "rateLimits",
  notificationLogs: "notificationLogs",
} as const;

export const SUBCOLLECTIONS = {
  events: "events",
  proofs: "proofs",
  consumerNotes: "consumerNotes",
} as const;

export function orderDoc(db: Firestore, orderId: string) {
  return db.collection(COLLECTIONS.orders).doc(orderId);
}

export function orderEventsCollection(db: Firestore, orderId: string) {
  return orderDoc(db, orderId).collection(SUBCOLLECTIONS.events);
}

export function orderProofsCollection(db: Firestore, orderId: string) {
  return orderDoc(db, orderId).collection(SUBCOLLECTIONS.proofs);
}

export function orderConsumerNotesCollection(db: Firestore, orderId: string) {
  return orderDoc(db, orderId).collection(SUBCOLLECTIONS.consumerNotes);
}

/** Document ID must be the SHA-256 hex digest of the raw token — never the plaintext token. */
export function trackingLinkDoc(db: Firestore, tokenHash: string) {
  return db.collection(COLLECTIONS.trackingLinks).doc(tokenHash);
}
