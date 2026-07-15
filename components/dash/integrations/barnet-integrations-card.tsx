"use client";

import { Activity, Download, Plug, RefreshCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { SectionCard } from "@/components/dash/ui/section-card";
import { isApiEnabled } from "@/lib/dash/api/config";
import type {
  BarnetSyncHealthView,
  ExternalOrderProviderSyncState,
  OrderProviderEnvDiagnosticsResponse,
  OrderProviderHealthWithSync,
} from "@/lib/dash/api/client";

const isDev = process.env.NODE_ENV === "development";

interface BarnetIntegrationsCardProps {
  health: OrderProviderHealthWithSync | null;
  syncState: ExternalOrderProviderSyncState | null;
  syncHealth?: BarnetSyncHealthView | null;
  liveChecking: boolean;
  livePreviewing: boolean;
  liveSyncing?: boolean;
  envDiagnostics: OrderProviderEnvDiagnosticsResponse | null;
  envDiagnosticsLoading: boolean;
  envDiagnosticsError: string | null;
  showEnvDiagnostics: boolean;
  liveMessage: string | null;
  error: string | null;
  onCheckConnection: () => void;
  onPreviewOrders: () => void;
  onRunEnvDiagnostic: () => void;
  onManualSync?: () => void;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("en-CA", {
    timeZone: "America/Edmonton",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function healthTone(
  state: BarnetSyncHealthView["state"] | undefined,
): "ok" | "warn" | "error" | "info" | "neutral" {
  switch (state) {
    case "healthy":
      return "ok";
    case "outside_hours":
    case "never_run":
    case "disabled":
    case "not_configured":
      return "info";
    case "stale":
    case "degraded":
    case "locked":
    case "running":
      return "warn";
    case "failed":
      return "error";
    default:
      return "neutral";
  }
}

function healthLabel(state: BarnetSyncHealthView["state"] | undefined): string {
  switch (state) {
    case "healthy":
      return "Healthy";
    case "running":
      return "Running";
    case "outside_hours":
      return "Outside hours";
    case "stale":
      return "Stale";
    case "degraded":
      return "Degraded";
    case "failed":
      return "Failed";
    case "locked":
      return "Locked";
    case "disabled":
      return "Disabled";
    case "not_configured":
      return "Not configured";
    case "never_run":
      return "Never run";
    default:
      return "Unknown";
  }
}

export function BarnetIntegrationsCard({
  health,
  syncState,
  syncHealth,
  liveChecking,
  livePreviewing,
  liveSyncing = false,
  envDiagnostics,
  envDiagnosticsLoading,
  envDiagnosticsError,
  showEnvDiagnostics,
  liveMessage,
  error,
  onCheckConnection,
  onPreviewOrders,
  onRunEnvDiagnostic,
  onManualSync,
}: BarnetIntegrationsCardProps) {
  const isMockMode = health?.mode !== "live";
  const liveReadsEnabled = health?.liveReadsEnabled ?? false;
  const liveSyncEnabled = health?.liveSyncEnabled ?? false;
  const ordersConfigured = health?.ordersConfigured ?? false;
  const counts = syncHealth?.counts ?? syncState?.lastSyncSummary;
  const tone = healthTone(syncHealth?.state);
  const outsideHours = syncHealth?.outsideOperatingHours === true;
  const syncBusy = liveSyncing || syncHealth?.isRunning === true;

  const manualDisabled =
    !onManualSync ||
    syncBusy ||
    isMockMode ||
    !liveSyncEnabled ||
    !isApiEnabled();

  return (
    <SectionCard
      title="Integrations"
      icon={<Plug className="h-4 w-4" />}
      description={
        isMockMode
          ? "External order provider is in mock mode."
          : "Barnet live read-only integration for Planet Hollyweed delivery intake."
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <IntegrationStat label="Barnet mode" value={isMockMode ? "mock" : "live / read-only"} />
        <IntegrationStat
          label="Credentials configured"
          value={health?.configured ? "Yes" : "No"}
          ok={health?.configured}
        />
        <IntegrationStat
          label="Live sync enabled"
          value={liveSyncEnabled ? "Yes" : "No"}
          ok={liveSyncEnabled}
        />
        <IntegrationStat
          label="Sync health"
          value={healthLabel(syncHealth?.state)}
          ok={tone === "ok"}
          warn={tone === "warn" || tone === "info"}
          danger={tone === "error"}
        />
        <IntegrationStat
          label="Edmonton operating state"
          value={outsideHours ? "Quiet hours (12:00 AM–8:30 AM)" : "Scanning allowed"}
          warn={outsideHours}
        />
        <IntegrationStat
          label="Sync running"
          value={syncBusy ? "Yes" : "No"}
          warn={syncBusy}
        />
        <IntegrationStat
          label="Last attempted scan"
          value={formatWhen(
            syncHealth?.lastAttemptedSyncAt ?? syncState?.lastAttemptedSyncAt,
          )}
        />
        <IntegrationStat
          label="Last successful scan"
          value={formatWhen(
            syncHealth?.lastSuccessfulSyncAt ?? syncState?.lastSuccessfulSyncAt,
          )}
        />
        <IntegrationStat
          label="Next eligible scan"
          value={formatWhen(syncHealth?.nextExpectedEligibleScanAt)}
        />
        <IntegrationStat
          label="Latest duration"
          value={
            syncHealth?.lastDurationMs != null
              ? `${Math.round(syncHealth.lastDurationMs / 100) / 10}s`
              : "—"
          }
        />
        <IntegrationStat
          label="Orders examined"
          value={String(
            (counts && "ordersExamined" in counts
              ? counts.ordersExamined
              : undefined) ?? "—",
          )}
        />
        <IntegrationStat
          label="Deliveries found"
          value={String(counts?.deliveryOrdersFound ?? "—")}
        />
        <IntegrationStat label="Inserted" value={String(counts?.inserted ?? "—")} />
        <IntegrationStat label="Updated" value={String(counts?.updated ?? "—")} />
        <IntegrationStat
          label="Unchanged / skipped"
          value={String(
            (counts && "unchanged" in counts ? counts.unchanged : undefined) ?? "—",
          )}
        />
        <IntegrationStat
          label="Error count"
          value={String(
            ((counts && "enrichmentErrors" in counts
              ? counts.enrichmentErrors
              : 0) ?? 0) +
              ((counts && "syncErrors" in counts ? counts.syncErrors : 0) ?? 0) +
              ((counts && "invalid" in counts ? counts.invalid : 0) ?? 0),
          )}
          warn={
            Boolean(
              (counts && "enrichmentErrors" in counts && counts.enrichmentErrors) ||
                (counts && "syncErrors" in counts && counts.syncErrors),
            )
          }
        />
        <IntegrationStat
          label="Latest safe error"
          value={
            syncHealth?.lastSafeErrorMessage ??
            syncState?.lastError ??
            "—"
          }
          danger={Boolean(
            syncHealth?.lastSafeErrorMessage ?? syncState?.lastError,
          )}
        />
      </div>

      {syncHealth?.message && (
        <p
          className={`mt-3 text-xs ${
            tone === "error"
              ? "text-primary"
              : tone === "warn"
                ? "text-warning-foreground"
                : "text-muted-foreground"
          }`}
        >
          {syncHealth.message}
        </p>
      )}

      {outsideHours && (
        <p className="mt-2 text-xs text-muted-foreground">
          Manual sync is paused overnight. Scanning resumes at 8:30 AM Edmonton time.
        </p>
      )}

      {!isMockMode && health?.readsDisabled && (
        <p className="mt-3 text-xs text-warning-foreground">
          Live mode is configured but reads are disabled. Set{" "}
          <code className="text-[11px]">EXTERNAL_ORDER_LIVE_READS_ENABLED=true</code>.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          disabled={liveChecking || !isApiEnabled()}
          onClick={onCheckConnection}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Activity className="h-4 w-4" />
          {liveChecking ? "Checking…" : "Check Connection"}
        </button>
        <button
          disabled={
            livePreviewing ||
            isMockMode ||
            !liveReadsEnabled ||
            !ordersConfigured
          }
          onClick={onPreviewOrders}
          className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {livePreviewing ? "Previewing…" : "Preview Live Orders"}
        </button>
        {onManualSync && (
          <button
            type="button"
            disabled={manualDisabled}
            onClick={onManualSync}
            title={
              outsideHours
                ? "Scanning resumes at 8:30 AM Edmonton time"
                : syncBusy
                  ? "Sync already in progress"
                  : undefined
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncBusy ? "animate-spin" : ""}`} />
            {syncBusy ? "Syncing…" : "Manual Sync"}
          </button>
        )}
        <Link
          href="/live-intake"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Open Live Intake
        </Link>
      </div>

      {liveMessage && <p className="mt-3 text-sm text-muted-foreground">{liveMessage}</p>}
      {error && !liveMessage && <p className="mt-3 text-sm text-primary">{error}</p>}

      {showEnvDiagnostics && (
        <div className="mt-5 rounded-xl border border-warning/40 bg-warning/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-warning" />
                Temporary: Production Environment Diagnostics
              </div>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Admin-only panel for verifying production env wiring. Remove after
                configuration is confirmed. This displays presence flags only and never
                exposes credential values.
              </p>
            </div>
            <button
              disabled={envDiagnosticsLoading || !isApiEnabled()}
              onClick={onRunEnvDiagnostic}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
            >
              <Activity className="h-4 w-4" />
              {envDiagnosticsLoading ? "Running…" : "Run Environment Diagnostic"}
            </button>
          </div>

          {envDiagnosticsError && (
            <p className="mt-3 text-sm text-primary">{envDiagnosticsError}</p>
          )}

          {envDiagnostics && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <DiagnosticStat
                label="vercelEnvironment"
                value={formatNullable(envDiagnostics.vercelEnvironment)}
              />
              <DiagnosticStat
                label="providerModePresent"
                value={formatBoolean(envDiagnostics.providerModePresent)}
                ok={envDiagnostics.providerModePresent}
              />
              <DiagnosticStat
                label="providerMode"
                value={formatNullable(envDiagnostics.providerMode)}
              />
              <DiagnosticStat
                label="baseUrlPresent"
                value={formatBoolean(envDiagnostics.baseUrlPresent)}
                ok={envDiagnostics.baseUrlPresent}
              />
              <DiagnosticStat
                label="pathPrefixPresent"
                value={formatBoolean(envDiagnostics.pathPrefixPresent)}
                ok={envDiagnostics.pathPrefixPresent}
              />
              <DiagnosticStat
                label="apiKeyPresent"
                value={formatBoolean(envDiagnostics.apiKeyPresent)}
                ok={envDiagnostics.apiKeyPresent}
              />
              <DiagnosticStat
                label="apiPassPresent"
                value={formatBoolean(envDiagnostics.apiPassPresent)}
                ok={envDiagnostics.apiPassPresent}
              />
              <DiagnosticStat
                label="locationIdPresent"
                value={formatBoolean(envDiagnostics.locationIdPresent)}
                ok={envDiagnostics.locationIdPresent}
              />
              <DiagnosticStat
                label="liveReadsValue"
                value={formatNullable(envDiagnostics.liveReadsValue)}
              />
              <DiagnosticStat
                label="liveSyncValue"
                value={formatNullable(envDiagnostics.liveSyncValue)}
              />
            </div>
          )}
        </div>
      )}

      {isDev && isMockMode && (
        <p className="mt-3 text-xs text-muted-foreground">
          Mock provider tools are available in development via the Live Intake page when{" "}
          <code className="text-[11px]">EXTERNAL_ORDER_PROVIDER_MODE=mock</code>.
        </p>
      )}
    </SectionCard>
  );
}

function formatBoolean(value: boolean): string {
  return value ? "true" : "false";
}

function formatNullable(value: string | null): string {
  return value ?? "null";
}

function IntegrationStat({
  label,
  value,
  ok,
  warn,
  danger,
}: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-sm font-semibold ${
          danger
            ? "text-primary"
            : warn
              ? "text-warning-foreground"
              : ok === true
                ? "text-success"
                : ok === false
                  ? "text-muted-foreground"
                  : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DiagnosticStat({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/70 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={`mt-1 break-words text-sm font-semibold ${
          ok === true ? "text-success" : ok === false ? "text-muted-foreground" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
