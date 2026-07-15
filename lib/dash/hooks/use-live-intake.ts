"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  assignExternalOrderDriverApi,
  fetchExternalOrderIntakeDetail,
  fetchExternalOrderIntakeList,
  fetchLiveLocations,
  fetchLiveOrderProviderHealth,
  fetchOrderProviderHealthWithSync,
  previewLiveExternalOrdersApi,
  probeLiveOrderDetailApi,
  promoteExternalOrderApi,
  runLiveOrderProviderSync,
  scanLiveDeliveryOrdersApi,
  type ExternalOrderIntakeDetail,
  type ExternalOrderIntakeRow,
  type ExternalOrderIntakeSummary,
  type ExternalOrderProviderSyncState,
  type LiveOrderDetailDiagnostics,
  type OrderProviderHealthWithSync,
  type OrderProviderSyncResponse,
  type SafeBarnetLocationRow,
} from "@/lib/dash/api/client";
import { intakeKeys } from "@/lib/dash/query/query-keys";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function useLiveIntake() {
  const queryClient = useQueryClient();
  const [health, setHealth] = useState<OrderProviderHealthWithSync | null>(null);
  const [orders, setOrders] = useState<ExternalOrderIntakeRow[]>([]);
  const [previewRows, setPreviewRows] = useState<ExternalOrderIntakeRow[]>([]);
  const [summary, setSummary] = useState<ExternalOrderIntakeSummary>({
    ordersScanned: 0,
    deliveryOrdersFound: 0,
    readyToDispatch: 0,
    needsReview: 0,
    alreadyImported: 0,
    assigned: 0,
  });
  const [syncState, setSyncState] = useState<ExternalOrderProviderSyncState | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<OrderProviderSyncResponse | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ExternalOrderIntakeDetail | null>(null);
  const [discoveredLocations, setDiscoveredLocations] = useState<SafeBarnetLocationRow[]>([]);
  const [scanStats, setScanStats] = useState<{
    pagesScanned: number;
    totalOrdersSeen: number;
    deliveryOrdersFound: number;
    pickupOrdersIgnored: number;
    unknownOrdersIgnored: number;
  } | null>(null);
  const [orderDetailDiagnostics, setOrderDetailDiagnostics] =
    useState<LiveOrderDetailDiagnostics | null>(null);

  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [liveChecking, setLiveChecking] = useState(false);
  const [liveDiscovering, setLiveDiscovering] = useState(false);
  const [livePreviewing, setLivePreviewing] = useState(false);
  const [liveScanning, setLiveScanning] = useState(false);
  const [liveSyncing, setLiveSyncing] = useState(false);
  const [liveProbing, setLiveProbing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isMockMode = health?.mode !== "live";
  const liveReadsEnabled = health?.liveReadsEnabled ?? false;
  const liveSyncEnabled = health?.liveSyncEnabled ?? false;
  const ordersConfigured = health?.ordersConfigured ?? false;

  const importedIdSet = useMemo(
    () => new Set(orders.map((o) => o.externalOrderId)),
    [orders],
  );

  const tableRows = useMemo(() => {
    if (previewRows.length > 0) {
      return previewRows.map((row) => ({
        ...row,
        alreadyImported: importedIdSet.has(row.externalOrderId),
      }));
    }
    return orders;
  }, [orders, previewRows, importedIdSet]);

  const loadIntake = useCallback(async () => {
    if (!isApiEnabled()) return;

    setLoading(true);
    setError(null);
    try {
      const [healthResult, intakeResult] = await Promise.all([
        fetchOrderProviderHealthWithSync(),
        fetchExternalOrderIntakeList({ limit: 100 }),
      ]);
      setHealth(healthResult);
      setOrders(intakeResult.orders);
      setSummary(intakeResult.summary);
      setSyncState(intakeResult.syncState);
      queryClient.setQueryData(intakeKeys.imported(100), intakeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live intake");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  useEffect(() => {
    void loadIntake().catch(() => {
      /* initial load errors are stored on state */
    });
  }, [loadIntake]);

  // Lightweight sync-status refresh while Live Intake is open (does not trigger Barnet scans).
  useEffect(() => {
    if (!isApiEnabled()) return;

    const refreshSyncMeta = async () => {
      try {
        const syncHealth = await fetchOrderProviderHealthWithSync();
        setHealth(syncHealth);
        setSyncState(syncHealth.syncState ?? null);
      } catch {
        /* ignore transient poll errors */
      }
    };

    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refreshSyncMeta();
    }, 45_000);

    const onFocus = () => {
      if (document.hidden) return;
      void refreshSyncMeta();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const loadDetail = useCallback(async (docId: string) => {
    if (!isApiEnabled()) return;

    setDetailLoading(true);
    setError(null);
    try {
      const { order } = await fetchExternalOrderIntakeDetail(docId);
      setSelectedDetail(order);
      setSelectedOrderId(docId);
    } catch (err) {
      setSelectedDetail(null);
      setError(err instanceof Error ? err.message : "Failed to load order detail");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    if (!isApiEnabled()) {
      setMessage("Enable NEXT_PUBLIC_USE_API=true to check connection");
      return { ok: false as const };
    }

    setLiveChecking(true);
    setMessage(null);
    setError(null);
    try {
      const result = await fetchLiveOrderProviderHealth({ probe: true });
      setHealth((prev) => ({ ...(prev ?? {}), ...result } as OrderProviderHealthWithSync));
      const syncHealth = await fetchOrderProviderHealthWithSync();
      setHealth(syncHealth);
      setSyncState(syncHealth.syncState ?? null);
      const msg = result.probe?.ok
        ? `Connection OK — ${result.probe.locationCount ?? 0} location(s) reachable`
        : "Live config loaded";
      setMessage(msg);
      return { ok: true as const, message: msg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection check failed";
      setError(msg);
      return { ok: false as const, message: msg };
    } finally {
      setLiveChecking(false);
    }
  }, []);

  const discoverLocations = useCallback(async () => {
    if (!isApiEnabled()) return { ok: false as const };

    setLiveDiscovering(true);
    setMessage(null);
    setError(null);
    try {
      const result = await fetchLiveLocations();
      setDiscoveredLocations(result.locations);
      setMessage(`Discovered ${result.meta.count} location(s)`);
      return { ok: true as const };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Location discovery failed");
      return { ok: false as const };
    } finally {
      setLiveDiscovering(false);
    }
  }, []);

  const previewOrders = useCallback(async () => {
    if (!isApiEnabled()) return { ok: false as const };

    setLivePreviewing(true);
    setMessage(null);
    setError(null);
    try {
      const result = await previewLiveExternalOrdersApi();
      const rows = result.intakeOrders.map((row) => ({
        ...row,
        alreadyImported: importedIdSet.has(row.externalOrderId),
      }));
      setPreviewRows(rows);
      setLastSyncResult(null);
      setScanStats({
        pagesScanned: result.pagesScanned,
        totalOrdersSeen: result.totalOrdersSeen,
        deliveryOrdersFound: result.deliveryOrdersFound,
        pickupOrdersIgnored: result.pickupOrdersIgnored,
        unknownOrdersIgnored: result.unknownOrdersIgnored,
      });
      setSummary((prev) => ({
        ...prev,
        ordersScanned: result.pagesScanned,
        deliveryOrdersFound: result.deliveryOrdersFound,
        readyToDispatch: rows.filter((r) => r.dispatchReady && !r.alreadyImported).length,
        needsReview: rows.filter((r) => !r.dispatchReady && !r.alreadyImported).length,
      }));
      setMessage(
        `Previewed ${result.deliveryOrdersFound} delivery order(s) — not saved to Firestore`,
      );
      try {
        const syncHealth = await fetchOrderProviderHealthWithSync();
        setHealth(syncHealth);
        setSyncState(syncHealth.syncState ?? null);
      } catch {
        /* preview itself succeeded */
      }
      return { ok: true as const };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
      return { ok: false as const };
    } finally {
      setLivePreviewing(false);
    }
  }, [importedIdSet]);

  const scanDeliveryOrders = useCallback(async () => {
    if (!isApiEnabled()) return { ok: false as const };

    setLiveScanning(true);
    setMessage(null);
    setError(null);
    try {
      const result = await scanLiveDeliveryOrdersApi();
      const rows = result.intakeOrders.map((row) => ({
        ...row,
        alreadyImported: importedIdSet.has(row.externalOrderId),
      }));
      setPreviewRows(rows);
      setScanStats({
        pagesScanned: result.pagesScanned,
        totalOrdersSeen: result.totalOrdersSeen,
        deliveryOrdersFound: result.deliveryOrdersFound,
        pickupOrdersIgnored: result.pickupOrdersIgnored,
        unknownOrdersIgnored: result.unknownOrdersIgnored,
      });
      setMessage(
        `Scanned ${result.pagesScanned} page(s): ${result.deliveryOrdersFound} delivery order(s) found`,
      );
      return { ok: true as const };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
      return { ok: false as const };
    } finally {
      setLiveScanning(false);
    }
  }, [importedIdSet]);

  const syncDeliveryOrders = useCallback(async () => {
    if (!isApiEnabled()) return { ok: false as const };

    setLiveSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const result = await runLiveOrderProviderSync();
      if (result.skipped) {
        setMessage(result.message ?? "Synchronization skipped.");
        return { ok: true as const, result };
      }

      try {
        await queryClient.invalidateQueries({ queryKey: intakeKeys.all });
        await loadIntake();
        // Switch to imported view only after refresh succeeds.
        setPreviewRows([]);
        setScanStats({
          pagesScanned: result.pagesScanned,
          totalOrdersSeen: result.totalOrdersSeen,
          deliveryOrdersFound: result.deliveryOrdersFound,
          pickupOrdersIgnored: result.pickupOrdersIgnored,
          unknownOrdersIgnored: result.unknownOrdersIgnored,
        });
        setLastSyncResult(result);
        const skipped =
          (result.pickupOrdersIgnored ?? 0) +
          (result.unknownOrdersIgnored ?? 0) +
          (result.invalidOrders ?? 0);
        setMessage(
          [
            `Delivery found: ${result.deliveryOrdersFound}`,
            `Imported: ${result.inserted}`,
            `Updated: ${result.updated}`,
            `Unchanged: ${result.unchangedOrders ?? 0}`,
            `Ready to dispatch: ${result.readyToDispatch ?? 0}`,
            `Needs review: ${result.needsReview ?? 0}`,
            `Skipped: ${skipped}`,
          ].join(" · "),
        );
        try {
          const syncHealth = await fetchOrderProviderHealthWithSync();
          setHealth(syncHealth);
          setSyncState(syncHealth.syncState ?? null);
        } catch {
          /* sync itself succeeded */
        }
        return { ok: true as const, result };
      } catch (refreshErr) {
        setError(
          refreshErr instanceof Error
            ? `Sync completed but failed to refresh imported orders: ${refreshErr.message}`
            : "Sync completed but failed to refresh imported orders",
        );
        // Keep preview rows so the order does not vanish unexplained.
        setLastSyncResult(result);
        return { ok: false as const, result };
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      return { ok: false as const };
    } finally {
      setLiveSyncing(false);
    }
  }, [loadIntake, queryClient]);

  const probeOrderDetail = useCallback(async (params?: { id?: string; number?: string }) => {
    if (!isApiEnabled()) return { ok: false as const };

    setLiveProbing(true);
    setMessage(null);
    setError(null);
    try {
      const result = await probeLiveOrderDetailApi({
        id: params?.id ?? "751883",
        number: params?.number,
      });
      setOrderDetailDiagnostics(result.diagnostics);
      setMessage(
        `Probed order ${result.diagnostics.externalOrderNumber ?? result.diagnostics.externalOrderId}`,
      );
      return { ok: true as const };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Probe failed");
      return { ok: false as const };
    } finally {
      setLiveProbing(false);
    }
  }, []);

  const assignDriver = useCallback(
    async (docId: string, driverId: string, overrideMissingFields = false) => {
      if (!isApiEnabled()) return { ok: false as const };

      setAssigning(true);
      setError(null);
      try {
        const { order } = await assignExternalOrderDriverApi(docId, {
          driverId,
          overrideMissingFields,
        });
        setSelectedDetail(order);
        await loadIntake();
        setMessage(
          `Assigned to ${order.assignedDriverName ?? "driver"}${
            order.promotedOrderId ? ` · dispatch order ${order.promotedOrderId}` : ""
          }`,
        );
        return { ok: true as const, order };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Assignment failed";
        setError(msg);
        return { ok: false as const, message: msg };
      } finally {
        setAssigning(false);
      }
    },
    [loadIntake],
  );

  const promoteToDispatch = useCallback(
    async (docId: string, overrideMissingFields = false) => {
      if (!isApiEnabled()) return { ok: false as const };

      setPromoting(true);
      setError(null);
      try {
        const result = await promoteExternalOrderApi(docId, { overrideMissingFields });
        setSelectedDetail(result.externalOrder);
        await loadIntake();
        const msg = result.alreadyPromoted
          ? `Order already in dispatch queue (${result.order.id})`
          : `Sent to dispatch as ${result.order.id}`;
        setMessage(msg);
        return { ok: true as const, ...result };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Promotion failed";
        setError(msg);
        return { ok: false as const, message: msg };
      } finally {
        setPromoting(false);
      }
    },
    [loadIntake],
  );

  const clearPreview = useCallback(() => {
    setPreviewRows([]);
    setScanStats(null);
  }, []);

  return {
    health,
    orders,
    tableRows,
    previewRows,
    summary,
    syncState,
    lastSyncResult,
    selectedOrderId,
    selectedDetail,
    discoveredLocations,
    scanStats,
    orderDetailDiagnostics,
    loading,
    detailLoading,
    liveChecking,
    liveDiscovering,
    livePreviewing,
    liveScanning,
    liveSyncing,
    liveProbing,
    assigning,
    promoting,
    error,
    message,
    isMockMode,
    liveReadsEnabled,
    liveSyncEnabled,
    ordersConfigured,
    loadIntake,
    loadDetail,
    checkConnection,
    discoverLocations,
    previewOrders,
    scanDeliveryOrders,
    syncDeliveryOrders,
    probeOrderDetail,
    assignDriver,
    promoteToDispatch,
    clearPreview,
    setSelectedOrderId,
    setSelectedDetail,
    formatTotal: formatCents,
  };
}
