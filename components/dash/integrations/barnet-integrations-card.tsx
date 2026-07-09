"use client";

import { Activity, Download, Plug } from "lucide-react";
import Link from "next/link";
import { SectionCard } from "@/components/dash/ui/section-card";
import { isApiEnabled } from "@/lib/dash/api/config";
import type {
  ExternalOrderProviderSyncState,
  OrderProviderHealthWithSync,
} from "@/lib/dash/api/client";

const isDev = process.env.NODE_ENV === "development";

interface BarnetIntegrationsCardProps {
  health: OrderProviderHealthWithSync | null;
  syncState: ExternalOrderProviderSyncState | null;
  liveChecking: boolean;
  livePreviewing: boolean;
  liveMessage: string | null;
  error: string | null;
  onCheckConnection: () => void;
  onPreviewOrders: () => void;
}

export function BarnetIntegrationsCard({
  health,
  syncState,
  liveChecking,
  livePreviewing,
  liveMessage,
  error,
  onCheckConnection,
  onPreviewOrders,
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

      {isDev && isMockMode && (
        <p className="mt-3 text-xs text-muted-foreground">
          Mock provider tools are available in development via the Live Intake page when{" "}
          <code className="text-[11px]">EXTERNAL_ORDER_PROVIDER_MODE=mock</code>.
        </p>
      )}
    </SectionCard>
  );
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
