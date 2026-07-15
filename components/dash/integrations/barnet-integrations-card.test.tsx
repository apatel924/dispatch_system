/**
 * @vitest-environment happy-dom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarnetIntegrationsCard } from "@/components/dash/integrations/barnet-integrations-card";

vi.mock("@/lib/dash/api/config", () => ({
  isApiEnabled: () => true,
}));

describe("BarnetIntegrationsCard sync health UI", () => {
  afterEach(() => cleanup());

  it("distinguishes outside hours from failed", () => {
    render(
      <BarnetIntegrationsCard
        health={{
          mode: "live",
          configured: true,
          liveReadsEnabled: true,
          liveSyncEnabled: true,
          ordersConfigured: true,
        } as never}
        syncState={{
          lastSuccessfulSyncAt: "2026-07-13T12:00:00.000Z",
          lastError: null,
          lastSyncSummary: null,
        }}
        syncHealth={{
          state: "outside_hours",
          message: "Scanning is paused overnight.",
          outsideOperatingHours: true,
          isRunning: false,
          isLocked: false,
          lastAttemptedSyncAt: null,
          lastSuccessfulSyncAt: "2026-07-13T12:00:00.000Z",
          lastDurationMs: 1200,
          lastSafeErrorMessage: null,
          lastErrorCode: null,
          lastRunStatus: "success",
          counts: null,
          nextExpectedEligibleScanAt: "2026-07-14T14:30:00.000Z",
        }}
        liveChecking={false}
        livePreviewing={false}
        envDiagnostics={null}
        envDiagnosticsLoading={false}
        envDiagnosticsError={null}
        showEnvDiagnostics={false}
        liveMessage={null}
        error={null}
        onCheckConnection={() => undefined}
        onPreviewOrders={() => undefined}
        onRunEnvDiagnostic={() => undefined}
        onManualSync={() => undefined}
      />,
    );

    expect(screen.getByText("Outside hours")).toBeTruthy();
    expect(screen.queryByText("Failed")).toBeNull();
    expect(
      screen.getByText(/Scanning resumes at 8:30 AM Edmonton time/),
    ).toBeTruthy();
  });

  it("disables manual sync while running", () => {
    render(
      <BarnetIntegrationsCard
        health={{
          mode: "live",
          configured: true,
          liveReadsEnabled: true,
          liveSyncEnabled: true,
          ordersConfigured: true,
        } as never}
        syncState={null}
        syncHealth={{
          state: "running",
          message: "A synchronization run is in progress.",
          outsideOperatingHours: false,
          isRunning: true,
          isLocked: true,
          lastAttemptedSyncAt: null,
          lastSuccessfulSyncAt: null,
          lastDurationMs: null,
          lastSafeErrorMessage: null,
          lastErrorCode: null,
          lastRunStatus: "running",
          counts: null,
          nextExpectedEligibleScanAt: null,
        }}
        liveChecking={false}
        livePreviewing={false}
        liveSyncing
        envDiagnostics={null}
        envDiagnosticsLoading={false}
        envDiagnosticsError={null}
        showEnvDiagnostics={false}
        liveMessage={null}
        error={null}
        onCheckConnection={() => undefined}
        onPreviewOrders={() => undefined}
        onRunEnvDiagnostic={() => undefined}
        onManualSync={() => undefined}
      />,
    );

    const button = screen.getByRole("button", { name: /Syncing/i });
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows safe error without raw internals", () => {
    render(
      <BarnetIntegrationsCard
        health={{
          mode: "live",
          configured: true,
          liveReadsEnabled: true,
          liveSyncEnabled: true,
          ordersConfigured: true,
        } as never}
        syncState={{
          lastSuccessfulSyncAt: null,
          lastError: "Synchronization failed.",
          lastSyncSummary: null,
        }}
        syncHealth={{
          state: "failed",
          message: "The latest eligible synchronization run failed.",
          outsideOperatingHours: false,
          isRunning: false,
          isLocked: false,
          lastAttemptedSyncAt: "2026-07-14T18:00:00.000Z",
          lastSuccessfulSyncAt: null,
          lastDurationMs: 500,
          lastSafeErrorMessage: "Synchronization failed.",
          lastErrorCode: "sync_failed",
          lastRunStatus: "failed",
          counts: null,
          nextExpectedEligibleScanAt: null,
        }}
        liveChecking={false}
        livePreviewing={false}
        envDiagnostics={null}
        envDiagnosticsLoading={false}
        envDiagnosticsError={null}
        showEnvDiagnostics={false}
        liveMessage={null}
        error={null}
        onCheckConnection={() => undefined}
        onPreviewOrders={() => undefined}
        onRunEnvDiagnostic={() => undefined}
        onManualSync={() => undefined}
      />,
    );

    expect(screen.getByText("Synchronization failed.")).toBeTruthy();
    expect(screen.queryByText(/stack|Authorization|Bearer/i)).toBeNull();
  });
});
