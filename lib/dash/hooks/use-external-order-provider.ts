"use client";

import { useCallback, useEffect, useState } from "react";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  fetchLiveLocations,
  fetchLiveOrderProviderHealth,
  fetchOrderProviderHealth,
  fetchSyncedExternalOrders,
  previewLiveExternalOrdersApi,
  runLiveOrderProviderSync,
  runOrderProviderMockSync,
  type ExternalOrderRow,
  type LiveOrderProviderHealthResponse,
  type OrderProviderHealthResponse,
  type BarnetLocationsMeta,
  type SafeBarnetLocationRow,
} from "@/lib/dash/api/client";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function useExternalOrderProvider() {
  const [health, setHealth] = useState<OrderProviderHealthResponse | null>(null);
  const [liveHealth, setLiveHealth] = useState<LiveOrderProviderHealthResponse | null>(null);
  const [orders, setOrders] = useState<ExternalOrderRow[]>([]);
  const [previewOrders, setPreviewOrders] = useState<ExternalOrderRow[]>([]);
  const [discoveredLocations, setDiscoveredLocations] = useState<SafeBarnetLocationRow[]>([]);
  const [discoveredLocationsMeta, setDiscoveredLocationsMeta] =
    useState<BarnetLocationsMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [liveChecking, setLiveChecking] = useState(false);
  const [liveDiscovering, setLiveDiscovering] = useState(false);
  const [livePreviewing, setLivePreviewing] = useState(false);
  const [liveSyncing, setLiveSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);

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

  const checkLiveConfig = useCallback(async (probe = false) => {
    if (!isApiEnabled()) {
      const message = "Enable NEXT_PUBLIC_USE_API=true to check live config";
      setLiveMessage(message);
      return { ok: false as const, message };
    }

    setLiveChecking(true);
    setLiveMessage(null);
    setError(null);
    try {
      const result = await fetchLiveOrderProviderHealth({ probe });
      setLiveHealth(result);
      let message = probe
        ? result.probe?.ok
          ? `Live probe OK (${result.probe.locationCount ?? 0} location(s))`
          : `Live config OK${result.probe?.error ? ` — probe: ${result.probe.error}` : ""}`
        : "Live config loaded";
      if (result.readsDisabled) {
        message = "Live mode configured but reads are disabled";
      }
      setLiveMessage(message);
      return { ok: true as const, message, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Live config check failed";
      setLiveHealth(null);
      setError(message);
      return { ok: false as const, message };
    } finally {
      setLiveChecking(false);
    }
  }, []);

  const discoverLiveLocations = useCallback(async () => {
    if (!isApiEnabled()) {
      const message = "Enable NEXT_PUBLIC_USE_API=true to discover live locations";
      setLiveMessage(message);
      return { ok: false as const, message };
    }

    setLiveDiscovering(true);
    setLiveMessage(null);
    setError(null);
    try {
      const result = await fetchLiveLocations();
      setDiscoveredLocations(result.locations);
      setDiscoveredLocationsMeta(result.meta);
      const message = `Discovered ${result.meta.count} live location(s)`;
      setLiveMessage(message);
      return { ok: true as const, message, result };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Discover live locations failed";
      setDiscoveredLocations([]);
      setDiscoveredLocationsMeta(null);
      setError(message);
      return { ok: false as const, message };
    } finally {
      setLiveDiscovering(false);
    }
  }, []);

  const previewLiveOrders = useCallback(async () => {
    if (!isApiEnabled()) {
      const message = "Enable NEXT_PUBLIC_USE_API=true to preview live orders";
      setLiveMessage(message);
      return { ok: false as const, message };
    }

    setLivePreviewing(true);
    setLiveMessage(null);
    setError(null);
    try {
      const result = await previewLiveExternalOrdersApi();
      setPreviewOrders(result.orders);
      const message = `Previewed ${result.total} live order(s) (read-only, not saved)`;
      setLiveMessage(message);
      return { ok: true as const, message, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Live preview failed";
      setPreviewOrders([]);
      setError(message);
      return { ok: false as const, message };
    } finally {
      setLivePreviewing(false);
    }
  }, []);

  const runLiveSync = useCallback(async () => {
    if (!isApiEnabled()) {
      const message = "Enable NEXT_PUBLIC_USE_API=true to run live sync";
      setLiveMessage(message);
      return { ok: false as const, message };
    }

    setLiveSyncing(true);
    setLiveMessage(null);
    setError(null);
    try {
      const result = await runLiveOrderProviderSync();
      await loadOrders();
      const message = `Live sync: ${result.total} order(s) — ${result.inserted} inserted, ${result.updated} updated`;
      setLiveMessage(message);
      return { ok: true as const, message, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Live sync failed";
      setError(message);
      return { ok: false as const, message };
    } finally {
      setLiveSyncing(false);
    }
  }, [loadOrders]);

  const isMockMode = health?.mode !== "live";
  const liveReadsEnabled = health?.liveReadsEnabled ?? false;
  const liveSyncEnabled = health?.liveSyncEnabled ?? false;
  const ordersConfigured = health?.ordersConfigured ?? false;

  return {
    health,
    liveHealth,
    orders,
    previewOrders,
    discoveredLocations,
    discoveredLocationsMeta,
    loading,
    syncing,
    liveChecking,
    liveDiscovering,
    livePreviewing,
    liveSyncing,
    error,
    syncMessage,
    liveMessage,
    isMockMode,
    liveReadsEnabled,
    liveSyncEnabled,
    ordersConfigured,
    refresh,
    runMockSync,
    checkLiveConfig,
    discoverLiveLocations,
    previewLiveOrders,
    runLiveSync,
    formatTotal: formatCents,
  };
}
