import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { getAdminFirestore } from "@/lib/server/firebase-admin";

async function nextCounter(name: string, start: number): Promise<number> {
  const db = getAdminFirestore();
  const counterRef = db.collection(COLLECTIONS.counters).doc(name);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const last = snap.exists ? Number(snap.data()?.last ?? start) : start;
    const next = last + 1;
    tx.set(counterRef, { last: next }, { merge: true });
    return next;
  });
}

export async function generateOrderId(): Promise<string> {
  const n = await nextCounter("orders", 10000);
  return `QRX-${n}`;
}

export async function generateDriverId(): Promise<string> {
  const n = await nextCounter("drivers", 10000);
  return `DRV-${n}`;
}
