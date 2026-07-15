/**
 * Lightweight development-only query fetch diagnostics.
 * No analytics dependency — attach in QueryProvider when NODE_ENV=development.
 */

import type { QueryClient, QueryCacheNotifyEvent } from "@tanstack/react-query";

type Counters = {
  fetchCount: number;
  keys: Map<string, number>;
};

const counters: Counters = {
  fetchCount: 0,
  keys: new Map(),
};

function keyToString(queryKey: readonly unknown[]): string {
  try {
    return JSON.stringify(queryKey);
  } catch {
    return String(queryKey);
  }
}

/** Reset counters (useful between page navigations in tests). */
export function resetQueryFetchDiagnostics(): void {
  counters.fetchCount = 0;
  counters.keys.clear();
}

export function getQueryFetchDiagnostics(): {
  fetchCount: number;
  duplicateKeyCount: number;
  topKeys: Array<{ key: string; count: number }>;
} {
  let duplicateKeyCount = 0;
  const topKeys: Array<{ key: string; count: number }> = [];
  for (const [key, count] of counters.keys) {
    if (count > 1) duplicateKeyCount += count - 1;
    topKeys.push({ key, count });
  }
  topKeys.sort((a, b) => b.count - a.count);
  return {
    fetchCount: counters.fetchCount,
    duplicateKeyCount,
    topKeys: topKeys.slice(0, 10),
  };
}

/**
 * Subscribe to QueryCache updates and count successful fetch starts.
 * Only attach in development.
 */
export function attachQueryFetchDiagnostics(queryClient: QueryClient): () => void {
  if (process.env.NODE_ENV === "production") {
    return () => undefined;
  }

  const cache = queryClient.getQueryCache();
  const unsubscribe = cache.subscribe((event: QueryCacheNotifyEvent) => {
    if (event.type !== "updated") return;
    const action = event.action;
    if (!action || action.type !== "fetch") return;
    counters.fetchCount += 1;
    const key = keyToString(event.query.queryKey);
    counters.keys.set(key, (counters.keys.get(key) ?? 0) + 1);
  });

  if (typeof window !== "undefined") {
    (
      window as Window & {
        __qreQueryDiagnostics?: typeof getQueryFetchDiagnostics;
      }
    ).__qreQueryDiagnostics = getQueryFetchDiagnostics;
  }

  return unsubscribe;
}
