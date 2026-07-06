"use client";

import { useCallback, useEffect, useState } from "react";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  fetchOrderProviderHealth,
  fetchSyncedExternalOrders,
  runOrderProviderMockSync,
  type ExternalOrderRow,
  type OrderProviderHealthResponse,
} from "@/lib/dash/api/client";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function useExternalOrderProvider() {
  const [health, setHealth] = useState<OrderProviderHealthResponse | null>(null);
  const [orders, setOrders] = useState<ExternalOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      const result = await fetchOrderProviderHealth();
      setHealth(result);
      return result;
    } catch (err) {
      setHealth(null);
      setError(err instanceof Error ? err.message : "Health check failed");
      return null;
    }
  }, []);

  const loadOrders = useCallback(async () => {
    if (!isApiEnabled()) return;

    setLoading(true);
    setError(null);
    try {
      const { orders: apiOrders } = await fetchSyncedExternalOrders({ limit: 50 });
      setOrders(apiOrders);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : "Failed to load synced orders");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadHealth();
    await loadOrders();
  }, [loadHealth, loadOrders]);

  useEffect(() => {
    void loadHealth();
    void loadOrders();
  }, [loadHealth, loadOrders]);

  const runMockSync = useCallback(async () => {
    if (!isApiEnabled()) {
      return {
        ok: false as const,
        message: "Enable NEXT_PUBLIC_USE_API=true to run mock sync against the API",
      };
    }

    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await runOrderProviderMockSync();
      await loadOrders();
      const message = `Synced ${result.total} order(s): ${result.inserted} inserted, ${result.updated} updated`;
      setSyncMessage(message);
      return { ok: true as const, message, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mock sync failed";
      setError(message);
      return { ok: false as const, message };
    } finally {
      setSyncing(false);
    }
  }, [loadOrders]);

  return {
    health,
    orders,
    loading,
    syncing,
    error,
    syncMessage,
    refresh,
    runMockSync,
    formatTotal: formatCents,
  };
}
