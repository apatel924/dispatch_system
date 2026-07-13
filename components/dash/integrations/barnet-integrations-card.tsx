"use client";

import { Activity, Download, Plug, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { SectionCard } from "@/components/dash/ui/section-card";
import { isApiEnabled } from "@/lib/dash/api/config";
import type {
  ExternalOrderProviderSyncState,
  OrderProviderEnvDiagnosticsResponse,
  OrderProviderHealthWithSync,
} from "@/lib/dash/api/client";

const isDev = process.env.NODE_ENV === "development";

interface BarnetIntegrationsCardProps {
  health: OrderProviderHealthWithSync | null;
  syncState: ExternalOrderProviderSyncState | null;
  liveChecking: boolean;
  livePreviewing: boolean;
  envDiagnostics: OrderProviderEnvDiagnosticsResponse | null;
  envDiagnosticsLoading: boolean;
  envDiagnosticsError: string | null;
  showEnvDiagnostics: boolean;
  liveMessage: string | null;
  error: string | null;
  onCheckConnection: () => void;
  onPreviewOrders: () => void;
  onRunEnvDiagnostic: () => void;
}

export function BarnetIntegrationsCard({
  health,
  syncState,
  liveChecking,
  livePreviewing,
  envDiagnostics,
  envDiagnosticsLoading,
  envDiagnosticsError,
  showEnvDiagnostics,
  liveMessage,
  error,
  onCheckConnection,
  onPreviewOrders,
  onRunEnvDiagnostic,
}: BarnetIntegrationsCardProps) {
  const isMockMode = health?.mode !== "live";
  const liveReadsEnabled = health?.liveReadsEnabled ?? false;
  const liveSyncEnabled = health?.liveSyncEnabled ?? false;
  const ordersConfigured = health?.ordersConfigured ?? false;

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
      <div className="grid gap-3 sm:grid-cols-2">
        <IntegrationStat label="Barnet mode" value={isMockMode ? "mock" : "live / read-only"} />
        <IntegrationStat
          label="Credentials configured"
          value={health?.configured ? "Yes" : "No"}
          ok={health?.configured}
        />
        <IntegrationStat
          label="Locations configured"
          value={ordersConfigured ? "Yes" : "No"}
          ok={ordersConfigured}
        />
        <IntegrationStat
          label="Live reads enabled"
          value={liveReadsEnabled ? "Yes" : "No"}
          ok={liveReadsEnabled}
        />
        <IntegrationStat
          label="Live sync enabled"
          value={liveSyncEnabled ? "Yes" : "No"}
          ok={liveSyncEnabled}
        />
        <IntegrationStat
          label="Last successful sync"
          value={syncState?.lastSuccessfulSyncAt ?? "—"}
        />
        <IntegrationStat
          label="Last error"
          value={syncState?.lastError ?? "—"}
          warn={Boolean(syncState?.lastError)}
        />
      </div>

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
}: {
  label: string;
  value: string;
  ok?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-sm font-semibold ${
          warn ? "text-primary" : ok === true ? "text-success" : ok === false ? "text-muted-foreground" : ""
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
