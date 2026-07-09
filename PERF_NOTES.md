# Performance notes — Quick-Run Express dashboard

## Benchmark in production mode

Dev mode (`npm run dev`) compiles routes on demand and enables React Strict Mode, so page loads and API timings often look much slower than real usage.

To measure realistic performance:

```bash
npm run build
npm start
```

Then open `http://localhost:3000` and test **Dashboard**, **Orders**, and **Drivers**.

Compare against dev mode using the same flows. Expect:

- First navigation to a route: faster (no on-demand compilation)
- Repeat navigation: often 5–20× faster for HTML
- API routes: similar application time; dev overhead on `next.js:` timing drops sharply

## Why dev mode feels slow

1. **On-demand compilation** — Next.js compiles each route the first time you visit it. Server logs may show `next.js: 900ms+` on cold routes.
2. **React Strict Mode** — In development, effects run twice, so hooks can issue duplicate fetches (e.g. two `/api/orders` calls on dashboard mount).
3. **Fast Refresh** — File saves can trigger full reloads and invalidate in-memory caches.
4. **No production optimizations** — Minification, static optimization, and tighter bundling apply only after `npm run build`.

## Recent performance improvements

- **Drivers list** — Metrics are computed from one batched orders query instead of one query per driver (N+1 fix).
- **Client cache** — TanStack Query shares orders/drivers data across dashboard, orders, and drivers pages (~30s stale time).
- **Stale-while-revalidate** — Cached rows stay visible during background refresh; full loading state only on first load.
- **Polling** — List pages poll every 20s when the tab is visible and the route is active (not on every admin page).

## What to watch in logs

When testing production mode, focus on **application-code** timing in API logs:

- `/api/orders?limit=50` — target ~100–200ms (Firestore)
- `/api/drivers?limit=50` — should be much lower after the N+1 fix (~50–150ms vs 200–600ms before)

If application-code times stay high in production, check Firestore region vs hosting region and order collection size.
