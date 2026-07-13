/** Firestore count aggregation — avoids loading documents when only totals are needed. */
export async function countQuery(query: FirebaseFirestore.Query): Promise<number> {
  const snap = await query.count().get();
  return snap.data().count;
}
