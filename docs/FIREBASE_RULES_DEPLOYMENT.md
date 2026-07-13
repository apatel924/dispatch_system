# Firebase rules and indexes deployment

Quick Run Express stores all operational data in Cloud Firestore and delivery proof files in Firebase Storage. **Client SDK access to both is denied**; the Next.js API uses the Firebase Admin SDK, which bypasses security rules.

## Select the correct Firebase project

1. Install the Firebase CLI (dev dependency is included): `npm install`
2. Log in: `firebase login`
3. List projects: `firebase projects:list`
4. Select the production project (must match `FIREBASE_PROJECT_ID` / `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `.env.local`):

```bash
firebase use YOUR_FIREBASE_PROJECT_ID
```

5. **Verify** before deploying:

```bash
firebase use
firebase projects:list | grep "$(firebase use | awk '{print $3}')"
echo "$FIREBASE_PROJECT_ID"   # from .env.local — must match firebase use output
```

`.firebaserc` is gitignored. Each developer/machine runs `firebase use <project-id>` locally.

## Local emulator dry run

Start emulators (Firestore + Storage + Emulator UI):

```bash
npm run firebase:emulators
```

Emulator UI: http://localhost:4000  
Firestore: `127.0.0.1:8080` · Storage: `127.0.0.1:9199`

**Java 21+** is required for the Firebase Emulator Suite. `scripts/firebase-cli.sh` auto-selects a Homebrew OpenJDK 21+ when `JAVA_HOME` is unset.

Run security rule tests against the emulators (starts emulators, runs tests, then exits):

```bash
npm run firebase:rules-test
```

## Deploy rules and indexes only

Deploy **only** Firestore rules, Storage rules, and composite indexes — not Hosting, Functions, or other resources:

```bash
npm run firebase:deploy:rules
```

Equivalent manual command:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Index builds can take several minutes. Monitor in [Firebase Console](https://console.firebase.google.com) → Firestore → Indexes.

## Inspect deployed rules

**Console**

- Firestore → Rules
- Storage → Rules
- Firestore → Indexes

**CLI**

```bash
firebase firestore:rules:get
firebase storage:rules:get
```

## Rollback

1. Restore the previous `firestore.rules`, `storage.rules`, or `firestore.indexes.json` from git.
2. Re-run `npm run firebase:deploy:rules`.
3. For indexes, removing a composite index from `firestore.indexes.json` and redeploying does **not** delete the index in console — delete obsolete indexes manually if needed.

## Storage access model (production)

| Operation | Path | Mechanism |
|-----------|------|-----------|
| Proof upload | `orders/{orderId}/proofs/{type}-{ts}.{ext}` | `POST /api/orders/[id]/proofs` → Admin SDK `bucket.file().save()` |
| Proof read (staff/driver) | Same path | Admin API → short-lived signed URL (default 15 min, `PROOF_SIGNED_URL_TTL_MS`) |
| Consumer tracking | — | No proof URLs in `ConsumerTrackingView` |
| Client SDK Storage | All paths | **Denied** (`storage.rules` deny-all) |

Signed URLs are generated on demand, scoped to one `storagePath`, never written to Firestore, and not logged.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `FIREBASE_PROJECT_ID` | Admin SDK project (must match `firebase use`) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket for Admin SDK |
| `PROOF_SIGNED_URL_TTL_MS` | Optional signed URL lifetime (default `900000` = 15 min) |

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run firebase:emulators` | Start Firestore + Storage emulators |
| `npm run firebase:rules-test` | Run `firebase.rules.test.ts` via emulators |
| `npm run firebase:deploy:rules` | Deploy rules + indexes only |
