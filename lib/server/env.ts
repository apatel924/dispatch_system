/**
 * Server-side environment helpers. Never expose admin credentials to the client.
 */

export function getFirebaseAdminPrivateKey(): string | undefined {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return undefined;
  return raw.replace(/\\n/g, "\n");
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      getFirebaseAdminPrivateKey(),
  );
}

export function isFirebaseClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET &&
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  );
}
