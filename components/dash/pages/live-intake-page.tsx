"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  MapPin,
  Radio,
  RefreshCw,
  Send,
  Truck,
  UserCheck,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { StatCard } from "@/components/dash/ui/stat-card";
import { isDriverAssignable } from "@/lib/driver-status";
import { useAdminDrivers } from "@/lib/dash/hooks/use-admin-drivers";
import { useLiveIntake } from "@/lib/dash/hooks/use-live-intake";
import { isApiEnabled } from "@/lib/dash/api/config";
import type { ExternalOrderIntakeRow } from "@/lib/dash/api/client";
import {
  aggregateIntakeStatusPills,
  summarizeRowPillLists,
  type IntakeStatusPill,
} from "@/lib/dash/intake-status-pills";
import {
  describeBarnetSyncResult,
  formatEdmontonExact,
  formatEdmontonRelative,
} from "@/lib/dash/barnet-sync-status-copy";
import type {
  BarnetSyncHealthView,
  ExternalOrderProviderSyncState,
} from "@/lib/dash/api/client";

const isDev = process.env.NODE_ENV === "development";

function BarnetSyncStatusBanner({
  syncState,
  syncHealth,
  liveSyncing,
}: {
  syncState: ExternalOrderProviderSyncState | null;
  syncHealth: BarnetSyncHealthView | null;
  liveSyncing: boolean;
}) {
  const lastScanAt =
    syncHealth?.lastScanAt ??
    syncState?.lastScanAt ??
    syncHealth?.lastAttemptedSyncAt ??
    syncState?.lastAttemptedSyncAt ??
    null;
  const lastSuccessfulAt =
    syncHealth?.lastSuccessfulSyncAt ?? syncState?.lastSuccessfulSyncAt ?? null;
  const lastResult =
    syncHealth?.lastResult ??
    syncState?.lastResult ??
    null;
  const inserted = syncHealth?.counts?.inserted ?? syncState?.lastSyncSummary?.inserted ?? 0;
  const summary = describeBarnetSyncResult({
    lastResult,
    lastRunStatus: syncHealth?.lastRunStatus,
    isRunning: liveSyncing || syncHealth?.isRunning === true,
    inserted,
  });

  return (
    <div
      className="mt-3 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground"
      title={`Last scan: ${formatEdmontonExact(lastScanAt)}\nLast successful sync: ${formatEdmontonExact(lastSuccessfulAt)}`}
    >
      <p>
        <span className="font-semibold text-foreground">Last scan: </span>
        {formatEdmontonRelative(lastScanAt)}
        <span className="mx-2 text-border">·</span>
        <span className="font-semibold text-foreground">Last successful sync: </span>
        {formatEdmontonRelative(lastSuccessfulAt)}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground/90">
        {formatEdmontonExact(lastScanAt)}
      </p>
      {summary && <p className="mt-1 font-medium text-foreground">{summary}</p>}
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "muted" | "info" | "primary";
}) {
  const tones = {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning-foreground",
    muted: "bg-secondary text-muted-foreground",
    info: "bg-info-soft text-info",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
}

export function rowPills(row: ExternalOrderIntakeRow): IntakeStatusPill[] {
  const pills: IntakeStatusPill[] = [];
  if (row.promoted) pills.push({ label: "Already in Orders", tone: "success" });
  if (row.dispatchReady) pills.push({ label: "Ready to Dispatch", tone: "success" });
  if (row.needsReview || !row.dispatchReady) {
    pills.push({ label: "Needs Review", tone: "warning" });
  }
  const missingAddress =
    row.reviewReasons?.includes("missing_address") ||
    row.missingFields.some(
      (f) => f.includes("address") || f === "city" || f === "state" || f === "zip",
    );
  if (missingAddress) pills.push({ label: "Missing Address", tone: "warning" });
  if (
    row.missingFields.includes("customer_phone") ||
    row.reviewReasons?.includes("missing_customer_phone")
  ) {
    pills.push({ label: "Missing Phone", tone: "warning" });
  }
  if (row.missingFields.includes("items") || row.reviewReasons?.includes("missing_items")) {
    pills.push({ label: "Missing Items", tone: "warning" });
  }
  if (row.assignmentStatus === "assigned") pills.push({ label: "Already Assigned", tone: "info" });
  if (row.isPreview && row.alreadyImported) {
    pills.push({ label: "Duplicate/Existing", tone: "muted" });
  }
  return pills;
}

/** Summary pills across visible rows — deduped with counts. */
export function summarizeIntakeRowPills(
  rows: ReadonlyArray<ExternalOrderIntakeRow>,
): ReturnType<typeof aggregateIntakeStatusPills> {
  return summarizeRowPillLists(rows.map((row) => rowPills(row)));
}

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveIntakePage() {
  const router = useRouter();
  const intake = useLiveIntake();
  const { drivers } = useAdminDrivers();
  const activeDrivers = drivers.filter((d) => isDriverAssignable(d.status));

  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [overrideMissing, setOverrideMissing] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");

  const selectedDriver = activeDrivers.find((d) => d.id === selectedDriverId);
  const detail = intake.selectedDetail;
  const canPromote =
    detail &&
    !detail.promoted &&
    (detail.dispatchReady || overrideMissing);
  const canAssign =
    detail &&
    detail.assignmentStatus !== "assigned" &&
    (detail.dispatchReady || overrideMissing);

  const handlePromoteConfirm = async () => {
    if (!detail) return;
    const result = await intake.promoteToDispatch(detail.id, overrideMissing);
    if (result.ok) {
      setPromoteModalOpen(false);
      setOverrideMissing(false);
    }
  };

  const handleRowClick = (row: ExternalOrderIntakeRow) => {
    if (row.isPreview) return;
    void intake.loadDetail(row.id);
  };

  const handleAssignConfirm = async () => {
    if (!detail || !selectedDriverId) return;
    const result = await intake.assignDriver(detail.id, selectedDriverId, overrideMissing);
    if (result.ok) {
      setAssignModalOpen(false);
      setOverrideMissing(false);
    }
  };

  return (
    <DashboardLayout title="Live Intake">
      <ConfirmModal
        open={syncModalOpen}
        title="Sync delivery orders?"
        message="This will import new delivery orders from Barnet into Firestore. Existing Barnet order IDs will be skipped. Customer information will be stored for dispatch use. Continue?"
        confirmLabel="Sync Delivery Orders"
        loading={intake.liveSyncing}
        onCancel={() => setSyncModalOpen(false)}
        onConfirm={async () => {
          const result = await intake.syncDeliveryOrders();
          if (result.ok) setSyncModalOpen(false);
        }}
      />

      <ConfirmModal
        open={promoteModalOpen}
        title="Send to dispatch?"
        message="This will create a dispatch order in the main Orders queue from this Barnet intake record. Continue?"
        confirmLabel="Send to Dispatch"
        loading={intake.promoting}
        onCancel={() => setPromoteModalOpen(false)}
        onConfirm={handlePromoteConfirm}
      />

      <ConfirmModal
        open={assignModalOpen}
        title="Assign driver?"
        message={
          selectedDriver
            ? `Assign this order to ${selectedDriver.name}? This will send the order to dispatch if needed, then assign the driver.`
            : "Select a driver to assign."
        }
        confirmLabel="Assign Driver"
        loading={intake.assigning}
        onCancel={() => {
          setAssignModalOpen(false);
          setOverrideMissing(false);
        }}
        onConfirm={handleAssignConfirm}
      />

      <div className="space-y-6">
        <SectionCard
          title="Live Orders Intake"
          icon={<Radio className="h-4 w-4" />}
          description="Review Barnet delivery orders before dispatching."
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={intake.liveChecking || !isApiEnabled()}
              onClick={() => void intake.checkConnection()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              <Activity className="h-4 w-4" />
              {intake.liveChecking ? "Checking…" : "Check Connection"}
            </button>
            <button
              disabled={
                intake.livePreviewing ||
                intake.isMockMode ||
                !intake.liveReadsEnabled ||
                !intake.ordersConfigured
              }
              onClick={() => void intake.previewOrders()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {intake.livePreviewing ? "Previewing…" : "Preview Live Orders"}
            </button>
            <button
              disabled={
                intake.liveSyncing ||
                intake.isMockMode ||
                !intake.liveReadsEnabled ||
                !intake.ordersConfigured ||
                !intake.liveSyncEnabled
              }
              onClick={() => setSyncModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              {intake.liveSyncing ? "Syncing…" : "Sync Delivery Orders"}
            </button>
            {intake.previewRows.length > 0 && (
              <button
                onClick={intake.clearPreview}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-secondary"
              >
                Show Imported Orders
              </button>
            )}
          </div>

          {intake.isMockMode && (
            <p className="mt-3 text-xs text-muted-foreground">
              Live intake requires <code className="text-[11px]">EXTERNAL_ORDER_PROVIDER_MODE=live</code> with live reads enabled.
            </p>
          )}

          {!intake.isMockMode && intake.liveReadsEnabled && !intake.ordersConfigured && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                disabled={intake.liveDiscovering || !isApiEnabled()}
                onClick={() => void intake.discoverLocations()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                <MapPin className="h-4 w-4" />
                {intake.liveDiscovering ? "Discovering…" : "Discover Locations"}
              </button>
              <p className="text-xs text-muted-foreground">
                Set <code className="text-[11px]">EXTERNAL_ORDER_LOCATION_ID</code> in{" "}
                <code className="text-[11px]">.env.local</code>, then restart the dev server.
              </p>
            </div>
          )}

          {intake.message && <p className="mt-3 text-sm text-muted-foreground">{intake.message}</p>}
          {intake.error && <p className="mt-3 text-sm text-primary">{intake.error}</p>}

          <BarnetSyncStatusBanner
            syncState={intake.syncState}
            syncHealth={intake.health?.syncHealth ?? null}
            liveSyncing={intake.liveSyncing}
          />

          {intake.lastSyncResult && !intake.lastSyncResult.skipped && (
            <div className="mt-3 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Last sync · </span>
              Delivery found: {intake.lastSyncResult.deliveryOrdersFound}
              {" · "}Imported: {intake.lastSyncResult.inserted}
              {" · "}Updated: {intake.lastSyncResult.updated}
              {" · "}Unchanged: {intake.lastSyncResult.unchangedOrders ?? 0}
              {" · "}Ready: {intake.lastSyncResult.readyToDispatch ?? 0}
              {" · "}Needs review: {intake.lastSyncResult.needsReview ?? 0}
              {" · "}Skipped:{" "}
              {(intake.lastSyncResult.pickupOrdersIgnored ?? 0) +
                (intake.lastSyncResult.unknownOrdersIgnored ?? 0) +
                (intake.lastSyncResult.invalidOrders ?? 0)}
            </div>
          )}

          {intake.discoveredLocations.length > 0 && (
            <div className="mt-4 rounded-lg border border-dashed border-border">
              <div className="border-b border-border bg-secondary/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Discovered locations
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-secondary/20 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">City</th>
                    <th className="px-3 py-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {intake.discoveredLocations.map((loc, i) => (
                    <tr key={`loc-${loc.id ?? i}`}>
                      <td className="px-3 py-2 font-medium">{loc.id ?? "—"}</td>
                      <td className="px-3 py-2">{loc.name ?? "—"}</td>
                      <td className="px-3 py-2">{loc.city ?? "—"}</td>
                      <td className="px-3 py-2">{loc.state ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {intake.scanStats && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Pages scanned: {intake.scanStats.pagesScanned}</span>
              <span>Total seen: {intake.scanStats.totalOrdersSeen}</span>
              <span>Delivery: {intake.scanStats.deliveryOrdersFound}</span>
              <span>Pickup ignored: {intake.scanStats.pickupOrdersIgnored}</span>
            </div>
          )}

          {isDev && (
            <div className="mt-4 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setDevToolsOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold"
              >
                Developer Tools
                {devToolsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {devToolsOpen && (
                <div className="border-t border-border/60 px-4 pb-4">
                  <div className="flex flex-wrap gap-3 pt-3">
                    <button
                      disabled={intake.liveScanning || !intake.liveReadsEnabled || !intake.ordersConfigured}
                      onClick={() => void intake.scanDeliveryOrders()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                    >
                      {intake.liveScanning ? "Scanning…" : "Scan Pages for Delivery Orders"}
                    </button>
                    <button
                      disabled={intake.liveProbing || !intake.liveReadsEnabled || !intake.ordersConfigured}
                      onClick={() => void intake.probeOrderDetail()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"
                    >
                      {intake.liveProbing ? "Probing…" : "Probe Customer Link (sample order)"}
                    </button>
                  </div>
                  {intake.orderDetailDiagnostics && (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-secondary/30 p-3 text-xs">
                      {JSON.stringify(intake.orderDetailDiagnostics, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Orders scanned" value={intake.summary.ordersScanned} icon={Activity} tone="info" />
          <StatCard label="Delivery orders found" value={intake.summary.deliveryOrdersFound} icon={Truck} tone="purple" />
          <StatCard label="Ready to dispatch" value={intake.summary.readyToDispatch} icon={UserCheck} tone="success" />
          <StatCard label="Needs review" value={intake.summary.needsReview} icon={Activity} tone="warning" />
          <StatCard label="Already imported" value={intake.summary.alreadyImported} icon={Download} tone="orange" />
          <StatCard label="Assigned" value={intake.summary.assigned} icon={UserCheck} tone="primary" />
        </div>

        <div className="space-y-6">
          <SectionCard
            title={intake.previewRows.length > 0 ? "Preview results (not saved)" : "Imported delivery orders"}
            icon={<Truck className="h-4 w-4" />}
          >
            <div className="rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Order #</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Address</th>
                    <th className="px-3 py-2 font-medium">Items</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Source Status</th>
                    <th className="px-3 py-2 font-medium">Dispatch Ready</th>
                    <th className="px-3 py-2 font-medium">Assigned Driver</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {intake.loading && intake.tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                        Loading orders…
                      </td>
                    </tr>
                  ) : intake.tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                        No delivery orders yet — preview live orders or sync from Barnet
                      </td>
                    </tr>
                  ) : (
                    intake.tableRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => handleRowClick(row)}
                        className={`${row.isPreview ? "opacity-80" : "cursor-pointer hover:bg-secondary/30"} ${intake.selectedOrderId === row.id ? "bg-primary/5" : ""}`}
                      >
                        <td className="px-3 py-2 font-medium">
                          {row.externalOrderNumber ?? row.externalOrderId}
                        </td>
                        <td className="px-3 py-2">{row.customerName ?? "—"}</td>
                        <td className="px-3 py-2">{row.customerPhone ?? "—"}</td>
                        <td className="max-w-[180px] truncate px-3 py-2" title={row.deliveryAddress ?? undefined}>
                          {row.deliveryAddress ?? "—"}
                        </td>
                        <td className="px-3 py-2">{row.itemsCount}</td>
                        <td className="px-3 py-2">{intake.formatTotal(row.total)}</td>
                        <td className="px-3 py-2 capitalize">{row.sourceStatus}</td>
                        <td className="px-3 py-2">{row.dispatchReady ? "Yes" : "No"}</td>
                        <td className="px-3 py-2">{row.assignedDriverName ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{row.updatedAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {intake.tableRows.length > 0 && (() => {
              const summaryPills = summarizeIntakeRowPills(intake.tableRows);
              if (summaryPills.length === 0) return null;
              return (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Intake status summary">
                  {summaryPills.map((pill) => (
                    <StatusPill
                      key={pill.label}
                      label={pill.displayLabel}
                      tone={pill.tone}
                    />
                  ))}
                </div>
              );
            })()}
          </SectionCard>

          {detail ? (
            <SectionCard
              title={`Order detail — ${detail.externalOrderNumber ?? detail.externalOrderId}`}
              icon={<Truck className="h-4 w-4" />}
              action={
                <button
                  type="button"
                  onClick={() => {
                    intake.setSelectedDetail(null);
                    intake.setSelectedOrderId(null);
                  }}
                  className="rounded-md p-1 hover:bg-secondary"
                  aria-label="Close detail"
                >
                  <X className="h-4 w-4" />
                </button>
              }
            >
              <div className="grid min-w-0 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                <DetailSection title="Customer">
                  <DetailRow label="Name" value={detail.customer.name} />
                  <DetailRow label="Phone" value={detail.customer.phone} />
                  <DetailRow label="Email" value={detail.customer.email} />
                  <DetailRow label="Barnet customer ID" value={detail.customer.externalCustomerId} />
                </DetailSection>

                <DetailSection title="Delivery">
                  <DetailRow label="Address" value={detail.delivery.formattedAddress} />
                  <DetailRow label="Unit / suite" value={detail.delivery.address2} />
                  <DetailRow label="City" value={detail.delivery.city} />
                  <DetailRow label="Postal code" value={detail.delivery.postalCode} />
                  <DetailRow label="Delivery notes" value={detail.delivery.notes} />
                </DetailSection>

                <DetailSection title="Order">
                  <DetailRow label="Barnet order ID" value={detail.externalOrderId} />
                  <DetailRow label="Location ID" value={detail.sourceLocationId} />
                  <DetailRow label="Provider" value={detail.provider} />
                  <DetailRow label="Order status" value={detail.sourceStatus} />
                  <DetailRow label="Payment status" value={detail.paymentStatus} />
                  <DetailRow label="Created at" value={detail.createdAt} />
                  <DetailRow label="Updated at" value={detail.updatedAt} />
                  <DetailRow label="Total" value={intake.formatTotal(detail.totals.total)} />
                </DetailSection>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <DetailSection title="Items">
                  {detail.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No items</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.items.map((item, i) => (
                        <div key={`item-${i}`} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                          <div className="font-medium">{item.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Qty {item.quantity}
                            {item.unitPrice != null ? ` · ${intake.formatTotal(item.unitPrice)}` : ""}
                            {item.category ? ` · ${item.category}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </DetailSection>

                <div className="space-y-6">
                  <DetailSection title="Dispatch">
                    {detail.promoted && detail.promotedOrderId ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
                          Already in Orders as {detail.promotedOrderId}
                          {detail.promotedAt ? ` · promoted ${detail.promotedAt}` : ""}
                        </div>
                        <button
                          type="button"
                          onClick={() => router.push(`/orders/${detail.promotedOrderId}`)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Dispatch Order
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {!detail.dispatchReady && (
                          <label className="flex items-start gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={overrideMissing}
                              onChange={(e) => setOverrideMissing(e.target.checked)}
                              className="mt-0.5"
                            />
                            Override missing dispatch fields and send to dispatch anyway
                          </label>
                        )}
                        <button
                          type="button"
                          disabled={!canPromote || intake.promoting}
                          onClick={() => setPromoteModalOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          <Send className="h-4 w-4" />
                          {intake.promoting ? "Sending…" : "Send to Dispatch"}
                        </button>
                      </div>
                    )}
                  </DetailSection>

                  <DetailSection title="Dispatch checks">
                    <ChecklistItem ok={detail.dispatchChecks.deliveryOrderConfirmed} label="Delivery order confirmed" />
                    <ChecklistItem ok={detail.dispatchChecks.customerNamePresent} label="Customer name present" />
                    <ChecklistItem ok={detail.dispatchChecks.customerPhonePresent} label="Customer phone present" />
                    <ChecklistItem ok={detail.dispatchChecks.deliveryAddressPresent} label="Delivery address present" />
                    <ChecklistItem ok={detail.dispatchChecks.itemsPresent} label="Items present" />
                    <ChecklistItem ok={detail.dispatchChecks.notAlreadyAssigned} label="Not already assigned" />
                    {detail.missingFields.length > 0 && (
                      <p className="mt-2 text-xs text-warning-foreground">
                        Missing: {detail.missingFields.join(", ")}
                      </p>
                    )}
                  </DetailSection>

                  {detail.assignmentStatus !== "assigned" ? (
                    <DetailSection title="Assignment">
                      <label className="mb-1 block text-xs font-medium">Active driver</label>
                      <select
                        value={selectedDriverId}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="h-9 w-full max-w-md rounded-lg border border-input bg-card px-3 text-sm"
                      >
                        <option value="">Select a driver…</option>
                        {activeDrivers.map((driver) => (
                          <option key={driver.id} value={driver.id}>
                            {driver.name} ({driver.status})
                          </option>
                        ))}
                      </select>
                      {!detail.dispatchReady && !overrideMissing && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Enable the override checkbox above to assign when dispatch checks fail.
                        </p>
                      )}
                      <button
                        type="button"
                        disabled={!canAssign || !selectedDriverId || intake.assigning}
                        onClick={() => setAssignModalOpen(true)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        <UserCheck className="h-4 w-4" />
                        {intake.assigning ? "Assigning…" : "Assign Driver"}
                      </button>
                    </DetailSection>
                  ) : (
                    <div className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">
                      Assigned to {detail.assignedDriverName ?? "driver"}
                      {detail.assignedAt ? ` · ${detail.assignedAt}` : ""}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          ) : (
            !intake.detailLoading && (
              <p className="text-sm text-muted-foreground">
                Select an imported order row to open the full dispatch detail view.
              </p>
            )
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 py-3 last:border-b-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-primary"}`} />
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
