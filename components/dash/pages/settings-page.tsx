'use client'

import { useEffect, useState } from "react";
import { Building2, Bell, Truck, Users, Shield, Edit3, MapPin, Mail, Phone, FileText, ChevronDown, MessageCircle, Save, X } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { SectionCard } from "@/components/dash/ui/section-card";
import { Logo } from "@/components/dash/brand/logo";
import { BarnetIntegrationsCard } from "@/components/dash/integrations/barnet-integrations-card";
import { getCurrentUserRole, subscribeToAuthState } from "@/lib/auth/firebase-client";
import { useExternalOrderProvider } from "@/lib/dash/hooks/use-external-order-provider";
import {
  fetchOrderProviderEnvDiagnostics,
  fetchOrderProviderHealthWithSync,
} from "@/lib/dash/api/client";
import { isApiEnabled } from "@/lib/dash/api/config";
import type {
  ExternalOrderProviderSyncState,
  OrderProviderEnvDiagnosticsResponse,
  OrderProviderHealthWithSync,
} from "@/lib/dash/api/client";
import type { UserRole } from "@/lib/types/backend";

export function SettingsPage() {
  const {
    health: providerHealth,
    liveChecking,
    livePreviewing,
    error: providerError,
    liveMessage,
    checkLiveConfig,
    previewLiveOrders,
  } = useExternalOrderProvider();

  const [healthWithSync, setHealthWithSync] = useState<OrderProviderHealthWithSync | null>(null);
  const [syncState, setSyncState] = useState<ExternalOrderProviderSyncState | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [envDiagnostics, setEnvDiagnostics] =
    useState<OrderProviderEnvDiagnosticsResponse | null>(null);
  const [envDiagnosticsLoading, setEnvDiagnosticsLoading] = useState(false);
  const [envDiagnosticsError, setEnvDiagnosticsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      const role = await getCurrentUserRole();
      if (!cancelled) setCurrentRole(role);
    };

    void loadRole();
    const unsubscribe = subscribeToAuthState(() => {
      void loadRole();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isApiEnabled()) return;
    void fetchOrderProviderHealthWithSync()
      .then((result) => {
        setHealthWithSync(result);
        setSyncState(result.syncState ?? null);
      })
      .catch(() => {
        setHealthWithSync(providerHealth);
      });
  }, [providerHealth]);

  const handleCheckConnection = async () => {
    await checkLiveConfig(true);
    if (isApiEnabled()) {
      try {
        const result = await fetchOrderProviderHealthWithSync();
        setHealthWithSync(result);
        setSyncState(result.syncState ?? null);
      } catch {
        // health refresh optional
      }
    }
  };

  const handleRunEnvDiagnostic = async () => {
    if (!isApiEnabled()) {
      setEnvDiagnosticsError("Enable NEXT_PUBLIC_USE_API=true to run diagnostics");
      return;
    }

    setEnvDiagnosticsLoading(true);
    setEnvDiagnosticsError(null);
    try {
      const result = await fetchOrderProviderEnvDiagnostics();
      setEnvDiagnostics(result);
    } catch (err) {
      setEnvDiagnostics(null);
      setEnvDiagnosticsError(
        err instanceof Error ? err.message : "Environment diagnostic failed",
      );
    } finally {
      setEnvDiagnosticsLoading(false);
    }
  };

  return (
    <DashboardLayout title="Settings" actions={
      <>
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"><X className="h-4 w-4" /> Discard</button>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Save className="h-4 w-4" /> Save Changes</button>
      </>
    }>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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

          <BarnetIntegrationsCard
            health={healthWithSync ?? providerHealth}
            syncState={syncState}
            liveChecking={liveChecking}
            livePreviewing={livePreviewing}
            envDiagnostics={envDiagnostics}
            envDiagnosticsLoading={envDiagnosticsLoading}
            envDiagnosticsError={envDiagnosticsError}
            showEnvDiagnostics={currentRole === "admin"}
            liveMessage={liveMessage}
            error={providerError}
            onCheckConnection={() => void handleCheckConnection()}
            onPreviewOrders={() => void previewLiveOrders()}
            onRunEnvDiagnostic={() => void handleRunEnvDiagnostic()}
          />

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
