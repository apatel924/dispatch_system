'use client'

import { useState } from "react";
import { Building2, Bell, Truck, Users, Shield, CircleCheck, HardDrive, Activity, Edit3, MapPin, Mail, Phone, FileText, ChevronRight, ChevronDown, MessageCircle, Save, X, Download, Plug } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { Logo } from "@/components/dash/brand/logo";
import { useAdminImportLogs } from "@/lib/dash/hooks/use-admin-import";
import { useExternalOrderProvider } from "@/lib/dash/hooks/use-external-order-provider";
import { isApiEnabled } from "@/lib/dash/api/config";
import type { MockImportSource } from "@/lib/import/mock-fixtures";

const IMPORT_PROVIDERS: { id: MockImportSource; label: string }[] = [
  { id: "mock-uber", label: "Mock Uber" },
  { id: "mock-doordash", label: "Mock DoorDash" },
  { id: "mock-amazon", label: "Mock Amazon" },
];

const IMPORT_STATUS_STYLES: Record<string, string> = {
  success: "bg-success-soft text-success",
  partial: "bg-warning-soft text-warning-foreground",
  failed: "bg-primary/10 text-primary",
};

export function SettingsPage() {
  const { logs, loading, error, runMockImport } = useAdminImportLogs();
  const {
    health: providerHealth,
    liveHealth,
    orders: syncedExternalOrders,
    previewOrders,
    loading: externalOrdersLoading,
    syncing,
    liveChecking,
    liveDiscovering,
    livePreviewing,
    liveSyncing,
    error: providerError,
    syncMessage,
    liveMessage,
    isMockMode,
    liveReadsEnabled,
    liveSyncEnabled,
    ordersConfigured,
    discoveredLocations,
    discoveredLocationsMeta,
    runMockSync,
    checkLiveConfig,
    discoverLiveLocations,
    previewLiveOrders,
    runLiveSync,
    formatTotal,
  } = useExternalOrderProvider();
  const [selectedSource, setSelectedSource] = useState<MockImportSource>("mock-uber");
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const handleRunImport = async () => {
    setImportMessage(null);
    const result = await runMockImport(selectedSource);
    setImportMessage(result.message);
  };

  const handleRunMockSync = async () => {
    const result = await runMockSync();
    if (!result.ok) {
      // syncMessage/error handled in hook
    }
  };

  const handleCheckLiveConfig = async () => {
    await checkLiveConfig(false);
  };

  const handleDiscoverLiveLocations = async () => {
    await discoverLiveLocations();
  };

  const handlePreviewLiveOrders = async () => {
    await previewLiveOrders();
  };

  const handleRunLiveSync = async () => {
    await runLiveSync();
  };
  return (
    <DashboardLayout title="Settings" actions={
      <>
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"><X className="h-4 w-4" /> Discard</button>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Save className="h-4 w-4" /> Save Changes</button>
      </>
    }>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Business Settings" icon={<Building2 className="h-4 w-4" />} description="Manage your business and contact information.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Operating Name *" value="Quick-Run Express" />
                <Field label="Pickup Address *" value="123 Industrial Way, Dallas, TX 75201" trailing={<MapPin className="h-4 w-4 text-muted-foreground" />} />
                <Field label="Support Email *" value="support@quickrunexpress.com" />
                <div>
                  <div className="mb-1 flex items-center justify-between"><label className="text-xs font-medium">Business Hours</label><Edit3 className="h-3.5 w-3.5 text-muted-foreground" /></div>
                  <div className="rounded-lg border border-input p-3 text-xs">
                    <Row l="Mon - Fri" r="8:00 AM - 7:00 PM" />
                    <Row l="Saturday" r="9:00 AM - 5:00 PM" />
                    <Row l="Sunday" r="Closed" />
                  </div>
                </div>
                <Field label="Support Phone *" value="(555) 123-4567" />
              </div>
            </SectionCard>

            <SectionCard title="Notification Settings" icon={<Bell className="h-4 w-4" />} description="Manage notifications and message templates.">
              <div className="space-y-2">
                {[
                  "Customer - Order Received",
                  "Customer - Driver Assigned",
                  "Customer - Out for Delivery",
                  "Customer - Delivered",
                  "Customer - Failed Delivery",
                  "Driver - New Assignment",
                ].map((n) => (
                  <div key={n} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                    <span className="text-sm">{n}</span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">On</span>
                      <Toggle on />
                      <button className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-xs"><Edit3 className="h-3 w-3" /> Edit</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5"><MessageCircle className="h-4 w-4" /> Manage All Templates</button>
            </SectionCard>

            <SectionCard title="Delivery Rules" icon={<Truck className="h-4 w-4" />} description="Configure default delivery requirements and policies.">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2.5">
                  {[
                    ["Require Signature on Delivery", true],
                    ["Require ID Verification Record", false],
                    ["Require Drop-off Photo", true],
                    ["Require Exterior / Address Photo", true],
                  ].map(([l, on]) => (
                    <div key={l as string} className="flex items-center justify-between text-sm"><span>{l as string}</span><Toggle on={Boolean(on)} /></div>
                  ))}
                </div>
                <div className="space-y-3">
                  <Select label="Tracking Link Expiration *" value="7 Days" />
                  <Select label="Default Delivery Window *" value="9:00 AM - 12:00 PM" />
                  <Select label="Auto-complete Delivery After *" value="24 Hours" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" /> These rules apply to new orders by default. They can be overridden during order creation.</div>
            </SectionCard>

            <SectionCard title="User & Access" icon={<Users className="h-4 w-4" />} description="Manage users, roles, and access controls.">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 text-sm">
                  {[["Admin Users","3"],["Dispatcher Users","6"],["Driver Users","152"],["Roles & Permissions","→"],["Activity Sessions","12 Active"]].map(([l, v]) => (
                    <div key={l as string} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2"><span>{l as string}</span><span className={`text-xs ${v === "→" ? "text-muted-foreground" : "font-semibold"}`}>{v as string}</span></div>
                  ))}
                </div>
                <div className="space-y-3">
                  <Select label="Password Reset Policy" value="Require reset every 90 days" />
                  <div className="rounded-lg border border-border/60 p-3">
                    <div className="text-sm font-semibold">Two-Factor Authentication</div>
                    <div className="mt-1 text-xs text-muted-foreground">Require 2FA for all admin and dispatcher users.</div>
                    <div className="mt-2 flex items-center gap-2"><Toggle on /><span className="text-xs text-success">Enabled</span></div>
                  </div>
                  <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-input py-2 text-sm font-medium hover:bg-secondary"><Users className="h-4 w-4" /> Manage Users</button>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="External Order Provider"
            icon={<Activity className="h-4 w-4" />}
            description={
              isMockMode
                ? "Mock mode is active — no live external APIs are called."
                : "Live read-only mode — GET /locations and GET /orders only. No create, delete, or payment calls."
            }
          >
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-md border border-border bg-secondary/40 px-2.5 py-1 font-medium">
                Mode: {providerHealth?.mode ?? "—"}
              </span>
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  providerHealth?.ok
                    ? "bg-success-soft text-success"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {providerHealth?.ok ? "Health OK" : "Health unavailable"}
              </span>
              {providerHealth && (
                <span className="text-xs text-muted-foreground">
                  Configured: {providerHealth.configured ? "Yes" : "No"}
                </span>
              )}
              {!isMockMode && (
                <span className="text-xs text-muted-foreground">
                  Orders configured: {ordersConfigured ? "Yes" : "No"}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                Live reads: {liveReadsEnabled ? "enabled" : "disabled"}
              </span>
              <span className="text-xs text-muted-foreground">
                Live sync: {liveSyncEnabled ? "enabled" : "disabled"}
              </span>
            </div>

            {isMockMode && (
              <p className="mt-3 text-xs text-muted-foreground">
                Mock mode is the default. Set <code className="text-[11px]">EXTERNAL_ORDER_PROVIDER_MODE=live</code> and enable live flags in <code className="text-[11px]">.env.local</code> to use the read-only Barnet adapter.
              </p>
            )}

            {!isMockMode && providerHealth?.readsDisabled && (
              <p className="mt-3 text-xs text-warning-foreground">
                Live mode is configured but reads are disabled. Set <code className="text-[11px]">EXTERNAL_ORDER_LIVE_READS_ENABLED=true</code> to allow GET requests.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                disabled={syncing || providerHealth?.mode !== "mock"}
                onClick={handleRunMockSync}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {syncing ? "Syncing…" : "Run Mock Sync"}
              </button>
              {syncMessage && (
                <span className="text-sm text-muted-foreground">{syncMessage}</span>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-border/60 bg-secondary/20 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Live provider (read-only)
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  disabled={liveChecking || !isApiEnabled()}
                  onClick={handleCheckLiveConfig}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                >
                  <Activity className="h-4 w-4" />
                  {liveChecking ? "Checking…" : "Check Live Config"}
                </button>
                <button
                  disabled={
                    liveDiscovering ||
                    isMockMode ||
                    !liveReadsEnabled ||
                    !isApiEnabled()
                  }
                  onClick={handleDiscoverLiveLocations}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                >
                  <MapPin className="h-4 w-4" />
                  {liveDiscovering ? "Discovering…" : "Discover Live Locations"}
                </button>
                <button
                  disabled={
                    livePreviewing ||
                    isMockMode ||
                    !liveReadsEnabled ||
                    !ordersConfigured
                  }
                  onClick={handlePreviewLiveOrders}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {livePreviewing ? "Previewing…" : "Preview Live Orders"}
                </button>
                {liveSyncEnabled && (
                  <button
                    disabled={
                      liveSyncing ||
                      isMockMode ||
                      !liveReadsEnabled ||
                      !ordersConfigured
                    }
                    onClick={handleRunLiveSync}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    {liveSyncing ? "Syncing…" : "Run Live Sync"}
                  </button>
                )}
              </div>
              {liveHealth && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Path prefix: {liveHealth.apiPathPrefix}</span>
                  {liveHealth.locationId && (
                    <span>Location: {liveHealth.locationId}</span>
                  )}
                  {liveHealth.hasOtp && <span>OTP: configured</span>}
                </div>
              )}
              {liveMessage && (
                <p className="mt-2 text-sm text-muted-foreground">{liveMessage}</p>
              )}
              {discoveredLocationsMeta && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Response shape:{" "}
                  <code className="text-[11px]">{discoveredLocationsMeta.rawShape}</code>
                </p>
              )}
              {!isMockMode && liveReadsEnabled && !ordersConfigured && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Copy the correct location ID into{" "}
                  <code className="text-[11px]">EXTERNAL_ORDER_LOCATION_ID</code> in{" "}
                  <code className="text-[11px]">.env.local</code>, then restart the dev
                  server.
                </p>
              )}
            </div>

            {discoveredLocations.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-dashed border-border">
                <div className="border-b border-border bg-secondary/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Discovered live locations
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-secondary/20 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">ID</th>
                      <th className="px-3 py-2 font-medium">Store</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">City</th>
                      <th className="px-3 py-2 font-medium">State</th>
                      <th className="px-3 py-2 font-medium">Test</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {discoveredLocations.map((location, index) => (
                      <tr key={`location-${location.id ?? index}`}>
                        <td className="px-3 py-2 font-medium">{location.id ?? "—"}</td>
                        <td className="px-3 py-2">{location.store_id ?? "—"}</td>
                        <td className="px-3 py-2">{location.name ?? "—"}</td>
                        <td className="px-3 py-2">{location.city ?? "—"}</td>
                        <td className="px-3 py-2">{location.state ?? "—"}</td>
                        <td className="px-3 py-2">
                          {location.is_test_store === true ? "Yes" : location.is_test_store === false ? "No" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                  Copy the correct location ID into{" "}
                  <code className="text-[11px]">EXTERNAL_ORDER_LOCATION_ID</code> in{" "}
                  <code className="text-[11px]">.env.local</code>, then restart the dev
                  server.
                </p>
              </div>
            )}

            {providerError && !syncMessage && !liveMessage && (
              <p className="mt-3 text-sm text-primary">{providerError}</p>
            )}

            {previewOrders.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-dashed border-border">
                <div className="border-b border-border bg-secondary/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Live preview (not saved to Firestore)
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-secondary/20 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Order #</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Delivery</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {previewOrders.map((order) => (
                      <tr key={`preview-${order.externalOrderId}`}>
                        <td className="px-3 py-2 font-medium">
                          {order.externalOrderNumber ?? order.externalOrderId}
                        </td>
                        <td className="px-3 py-2 capitalize">{order.status}</td>
                        <td className="px-3 py-2 capitalize">
                          {order.deliveryStatus ?? "—"}
                        </td>
                        <td className="px-3 py-2">{formatTotal(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Order #</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Delivery</th>
                    <th className="px-3 py-2 font-medium">Total</th>
                    <th className="px-3 py-2 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {externalOrdersLoading && syncedExternalOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        Loading synced orders…
                      </td>
                    </tr>
                  ) : syncedExternalOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                        No synced external orders yet — run mock sync to populate
                      </td>
                    </tr>
                  ) : (
                    syncedExternalOrders.map((order) => (
                      <tr key={order.externalOrderId}>
                        <td className="px-3 py-2 font-medium">
                          {order.externalOrderNumber ?? order.externalOrderId}
                        </td>
                        <td className="px-3 py-2">{order.customerName ?? "—"}</td>
                        <td className="px-3 py-2 capitalize">{order.status}</td>
                        <td className="px-3 py-2 capitalize">
                          {order.deliveryStatus ?? "—"}
                        </td>
                        <td className="px-3 py-2">{formatTotal(order.total)}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {order.updatedAt}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Order Integrations (Mock)"
            icon={<Plug className="h-4 w-4" />}
            description="Test order import with mock provider payloads. No live external APIs are connected."
          >
            <div className="flex flex-wrap gap-2">
              {IMPORT_PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedSource(p.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedSource === p.id ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-secondary"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                disabled={loading}
                onClick={handleRunImport}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {loading ? "Importing…" : `Run ${IMPORT_PROVIDERS.find((p) => p.id === selectedSource)?.label} Import`}
              </button>
              {importMessage && (
                <span className="text-sm text-muted-foreground">{importMessage}</span>
              )}
              {error && !importMessage && (
                <span className="text-sm text-primary">{error}</span>
              )}
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Imported</th>
                    <th className="px-3 py-2 font-medium">Failed</th>
                    <th className="px-3 py-2 font-medium">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                        No import runs yet
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-3 py-2 font-medium">{log.source}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ${IMPORT_STATUS_STYLES[log.status] ?? "bg-secondary"}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-3 py-2">{log.ordersImported}</td>
                        <td className="px-3 py-2">{log.ordersFailed}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{log.createdAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Security & Privacy" icon={<Shield className="h-4 w-4" />} description="Security, data protection, and compliance settings.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                {[
                  ["Encrypted File Storage", "All evidence photos and documents are encrypted at rest.", "Enabled"],
                  ["Data Retention Period *", "Determines how long delivery records are retained.", "18 Months"],
                  ["Private Evidence Storage", "Evidence files are stored in a private, access-controlled environment.", "Enabled"],
                ].map(([t, d, v]) => (
                  <div key={t} className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
                    <div><div className="text-sm font-semibold">{t}</div><div className="text-xs text-muted-foreground">{d}</div></div>
                    <span className="shrink-0 rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">{v}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  ["Audit Logging", "Log all user actions and data changes.", "Enabled"],
                  ["Login Attempt Monitoring", "Monitor and alert on suspicious login activity.", "Enabled"],
                  ["IP Allowlist (Optional)", "Restrict admin access to trusted IP addresses.", null],
                ].map(([t, d, v]) => (
                  <div key={t as string} className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
                    <div><div className="text-sm font-semibold">{t}</div><div className="text-xs text-muted-foreground">{d}</div></div>
                    {v ? <span className="shrink-0 rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">{v}</span> : <button className="shrink-0 rounded-md border border-input bg-card px-2 py-0.5 text-xs font-medium">Configure</button>}
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-6">
          <SectionCard title="Business Profile">
            <div className="text-center">
              <div className="mx-auto flex justify-center"><Logo /></div>
              <div className="mt-2 text-lg font-bold">Quick-Run Express</div>
              <div className="text-xs text-muted-foreground">Fast. Reliable. Every Time.</div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" />support@quickrunexpress.com</div>
              <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" />(555) 123-4567</div>
              <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />123 Industrial Way, Dallas, TX 75201</div>
              <div className="flex items-center gap-2 text-muted-foreground"><FileText className="h-4 w-4" />Tax ID: 81-2345678</div>
            </div>
            <button className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-input py-2 text-sm font-medium hover:bg-secondary"><Edit3 className="h-4 w-4" /> Edit Profile</button>
          </SectionCard>

          <SectionCard title="System Summary" icon={<Activity className="h-4 w-4" />}>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-border/60 p-3"><div className="text-muted-foreground">Active Drivers</div><div className="mt-1 text-xl font-bold">12</div><div className="text-[10px] text-success">Online</div></div>
              <div className="rounded-lg border border-border/60 p-3"><div className="text-muted-foreground">SMS Provider</div><div className="mt-1 text-sm font-bold">TWILIO</div><div className="text-[10px] text-success">Connected</div></div>
              <div className="rounded-lg border border-border/60 p-3"><div className="text-muted-foreground">System Time</div><div className="mt-1 text-sm font-bold">May 16, 2025</div><div className="text-[10px] text-muted-foreground">11:45 AM</div></div>
            </div>
          </SectionCard>

          <SectionCard title="Storage Usage" icon={<HardDrive className="h-4 w-4" />}>
            <div className="flex items-center justify-between text-sm"><span>42.6 GB of 100 GB used</span><span className="font-semibold">42.6%</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: "42.6%" }} /></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg border border-border/60 p-2"><div className="text-muted-foreground">Photos</div><div className="mt-1 font-semibold">28.3 GB</div></div>
              <div className="rounded-lg border border-border/60 p-2"><div className="text-muted-foreground">Documents</div><div className="mt-1 font-semibold">8.7 GB</div></div>
              <div className="rounded-lg border border-border/60 p-2"><div className="text-muted-foreground">Logs & Other</div><div className="mt-1 font-semibold">5.6 GB</div></div>
            </div>
            <button className="mt-4 flex w-full items-center justify-center rounded-lg border border-input py-2 text-sm font-medium hover:bg-secondary">Manage Storage</button>
          </SectionCard>

          <SectionCard title="System Status" icon={<CircleCheck className="h-4 w-4" />}>
            <div className="space-y-2 text-sm">
              {[["All Systems Operational","Last checked: 1 min ago", null],["Database","Healthy",null],["API Services","Healthy",null],["Background Jobs","Healthy",null]].map(([t, sub, _], i) => (
                <div key={i} className="flex items-center gap-2">
                  <CircleCheck className="h-4 w-4 text-success" />
                  <div className="flex-1"><div className="font-medium">{t as string}</div></div>
                  <div className="text-xs text-muted-foreground">{sub as string}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </aside>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, value, trailing }: { label: string; value: string; trailing?: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input defaultValue={value} className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10" />
        {trailing}
      </div>
    </div>
  );
}
function Select({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      <button className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-card px-3 text-sm"><span>{value}</span><ChevronDown className="h-4 w-4 text-muted-foreground" /></button>
    </div>
  );
}
function Row({ l, r }: { l: React.ReactNode; r: React.ReactNode }) {
  return <div className="flex items-center justify-between py-1"><span className="text-muted-foreground">{l}</span><span className="font-medium">{r}</span></div>;
}
function Toggle({ on }: { on: boolean }) {
  return (
    <button aria-pressed={on} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-secondary"}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}