# Firestore services

Business logic layer — called by `app/api/*` Route Handlers.

📖 **API + service map:** [docs/BACKEND.md](../../docs/BACKEND.md)

```typescript
import { listOrders, createOrder } from "@/lib/server/services";
// or
import { getDriverById } from "@/lib/server/services/drivers";
```
