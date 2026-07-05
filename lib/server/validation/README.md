# API validation (Zod)

Request/query schemas for Route Handlers. Infer TypeScript types from schemas.

📖 **Schema list:** [docs/BACKEND.md](../../docs/BACKEND.md#validation-zod)

```typescript
import { CreateOrderSchema } from "@/lib/server/validation/orders";

const body = CreateOrderSchema.parse(await request.json());
```
