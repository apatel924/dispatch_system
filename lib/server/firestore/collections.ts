import type { Firestore } from "firebase-admin/firestore";

export const COLLECTIONS = {
  orders: "orders",
  drivers: "drivers",
  users: "users",
  importLogs: "importLogs",
  auditLogs: "auditLogs",
  counters: "counters",
} as const;

export const SUBCOLLECTIONS = {
  events: "events",
  proofs: "proofs",
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
