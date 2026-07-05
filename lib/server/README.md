# Server utilities (`lib/server`)

Server-only code for Next.js Route Handlers. **Do not import from client components.**

📖 **Full backend reference:** [docs/BACKEND.md](../../docs/BACKEND.md)

## Quick links

| Path | Purpose |
|------|---------|
| `auth.ts` | `verifyIdToken`, `requireAuth`, `requireRole` |
| `firebase-admin.ts` | Admin SDK singleton |
| `services/` | Firestore business logic |
| `validation/` | Zod request schemas |
| `handle-service-error.ts` | Map ServiceError → NextResponse |
| `route-utils.ts` | Request parsing, Firebase config guard |
| `driver-context.ts` | Driver ID from token claim or Firestore |
