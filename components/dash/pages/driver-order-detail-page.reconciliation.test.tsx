/**
 * @vitest-environment happy-dom
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProofAsset } from "@/lib/types/backend";

const useDriverOrder = vi.hoisted(() => vi.fn());
const useDriverSession = vi.hoisted(() => vi.fn());
const postOrderProof = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dash/hooks/use-driver-order", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dash/hooks/use-driver-order")>(
    "@/lib/dash/hooks/use-driver-order",
  );
  return {
    ...actual,
    useDriverOrder,
  };
});

vi.mock("@/lib/dash/hooks/use-driver-session", () => ({
  useDriverSession,
}));

vi.mock("@/lib/dash/api/config", () => ({
  isApiEnabled: () => true,
  shouldUseMockData: () => false,
}));

vi.mock("@/lib/dash/api/driver-client", () => ({
  postOrderProof,
  postOrderStatus: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { DriverOrderDetail } from "@/components/dash/pages/driver-order-detail-page";
import {
  getOrderProofs,
  reconcileLocalProofsWithServer,
  resetProofUploadStateForTests,
  saveOrderProofs,
  saveProof,
  saveProofAsync,
} from "@/lib/dash/driver-store";

const baseOrder = {
  id: "ORD-1",
  customer: "Test Customer",
  phone: "555-0100",
  address: "123 Main",
  unit: "",
  status: "Out for Delivery" as const,
  eta: "5 min",
  pickupName: "Store",
  pickupAddress: "1 Warehouse",
  notes: "",
  deliveryInstructions: "",
  receivedAt: "10:00 AM",
  assignedAt: "10:05 AM",
};

function serverProof(
  type: "signature" | "exteriorPhoto",
  downloadUrl = `https://signed.example/${type}`,
): ProofAsset {
  return {
    id: type,
    orderId: "ORD-1",
    type,
    stepKey: type,
    storagePath: `orders/ORD-1/proofs/${type}.png`,
    mimeType: "image/png",
    uploadedBy: "u1",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    reviewStatus: "pending",
    downloadUrl,
  };
}

function renderDetail(
  ui: ReactNode,
  options?: { strict?: boolean },
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const tree = (
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
  return render(options?.strict ? <StrictMode>{tree}</StrictMode> : tree);
}

describe("DriverOrderDetail proof reconciliation", () => {
  beforeEach(() => {
    localStorage.clear();
    resetProofUploadStateForTests();
    vi.clearAllMocks();
    useDriverSession.mockReturnValue({
      driver: { id: "DRV-A", name: "Alex" },
      driverId: "DRV-A",
    });
    useDriverOrder.mockReturnValue({
      order: baseOrder,
      completedSteps: [],
      proofs: [],
      statusEvents: [],
      consumerNotes: [],
      source: "api",
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    resetProofUploadStateForTests();
  });

  it("completes initial reconciliation without maximum update depth", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderDetail(<DriverOrderDetail orderId="ORD-1" />);
    await waitFor(() => {
      expect(screen.getByText("Test Customer")).toBeTruthy();
    });
    expect(
      errorSpy.mock.calls.some((args) =>
        String(args[0]).includes("Maximum update depth"),
      ),
    ).toBe(false);
    errorSpy.mockRestore();
  });

  it("does not loop under React Strict Mode", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderDetail(<DriverOrderDetail orderId="ORD-1" />, { strict: true });
    await waitFor(() => {
      expect(screen.getByText("Test Customer")).toBeTruthy();
    });
    expect(
      errorSpy.mock.calls.some((args) =>
        String(args[0]).includes("Maximum update depth"),
      ),
    ).toBe(false);
    errorSpy.mockRestore();
  });

  it("does not reset local failed previews when equivalent server polls rotate signed URLs", async () => {
    saveProof("DRV-A", "ORD-1", "signature", "data:image/png;base64,FAILED", {
      syncStatus: "failed",
      error: "Proof storage is temporarily unavailable. Please retry.",
    });

    const { rerender } = renderDetail(<DriverOrderDetail orderId="ORD-1" />);
    await waitFor(() => {
      expect(screen.getByText("Test Customer")).toBeTruthy();
    });

    useDriverOrder.mockReturnValue({
      order: baseOrder,
      completedSteps: [],
      proofs: [],
      statusEvents: [],
      consumerNotes: [],
      source: "api",
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });
    rerender(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <DriverOrderDetail orderId="ORD-1" />
      </QueryClientProvider>,
    );

    expect(getOrderProofs("DRV-A", "ORD-1").proofs.signature).toContain("FAILED");
  });

  it("uses server-backed previews after sync and clears local Data URLs", async () => {
    saveOrderProofs("DRV-A", "ORD-1", {
      completedSteps: [],
      stepTimestamps: {},
      proofs: { signature: "data:image/png;base64,LOCAL" },
      proofSync: {
        signature: { syncStatus: "failed", error: "retry me" },
      },
    });

    useDriverOrder.mockReturnValue({
      order: baseOrder,
      completedSteps: ["signature"],
      proofs: [serverProof("signature")],
      statusEvents: [],
      consumerNotes: [],
      source: "api",
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });

    renderDetail(<DriverOrderDetail orderId="ORD-1" />);
    await waitFor(() => {
      expect(getOrderProofs("DRV-A", "ORD-1").proofs.signature).toBeUndefined();
      expect(getOrderProofs("DRV-A", "ORD-1").proofSync.signature?.syncStatus).toBe(
        "synced",
      );
    });
  });

  it("loads the correct order when orderId switches", async () => {
    saveProof("DRV-A", "ORD-1", "signature", "data:image/png;base64,ORD1", {
      syncStatus: "failed",
    });
    saveProof("DRV-A", "ORD-2", "signature", "data:image/png;base64,ORD2", {
      syncStatus: "failed",
    });

    function Harness() {
      const [id, setId] = useState("ORD-1");
      return (
        <div>
          <button type="button" onClick={() => setId("ORD-2")}>
            switch
          </button>
          <DriverOrderDetail orderId={id} />
        </div>
      );
    }

    useDriverOrder.mockImplementation((orderId: string) => ({
      order: { ...baseOrder, id: orderId },
      completedSteps: [],
      proofs: [],
      statusEvents: [],
      consumerNotes: [],
      source: "api",
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    }));

    renderDetail(<Harness />);
    await waitFor(() => expect(screen.getByText("ORD-1")).toBeTruthy());
    await act(async () => {
      screen.getByRole("button", { name: "switch" }).click();
    });
    await waitFor(() => expect(screen.getByText("ORD-2")).toBeTruthy());
    expect(getOrderProofs("DRV-A", "ORD-2").proofs.signature).toContain("ORD2");
    expect(getOrderProofs("DRV-A", "ORD-1").proofs.signature).toContain("ORD1");
  });

  it("never exposes another driver's proofs after driver switch", async () => {
    saveProof("DRV-A", "ORD-1", "signature", "data:image/png;base64,AAA", {
      syncStatus: "failed",
    });
    saveProof("DRV-B", "ORD-1", "signature", "data:image/png;base64,BBB", {
      syncStatus: "failed",
    });

    useDriverSession.mockReturnValue({
      driver: { id: "DRV-B", name: "Blake" },
      driverId: "DRV-B",
    });

    renderDetail(<DriverOrderDetail orderId="ORD-1" />);
    await waitFor(() => expect(screen.getByText("Test Customer")).toBeTruthy());
    expect(getOrderProofs("DRV-B", "ORD-1").proofs.signature).toContain("BBB");
    expect(getOrderProofs("DRV-A", "ORD-1").proofs.signature).toContain("AAA");
  });

  it("retry updates failed proof to synced and clears Data URL", async () => {
    saveProof("DRV-A", "ORD-1", "signature", "data:image/png;base64,RETRY", {
      syncStatus: "failed",
      error: "retry",
    });
    postOrderProof.mockResolvedValueOnce({
      proof: { id: "signature", type: "signature", storagePath: "orders/ORD-1/proofs/signature.png" },
    });

    const result = await saveProofAsync(
      "DRV-A",
      "ORD-1",
      "signature",
      "data:image/png;base64,RETRY",
    );
    expect(result.synced).toBe(true);
    expect(result.proofs.proofs.signature).toBeUndefined();
    expect(result.proofs.proofSync.signature?.syncStatus).toBe("synced");
  });

  it("unchanged server proofs do not rewrite localStorage timestamps on every reconcile", () => {
    saveOrderProofs("DRV-A", "ORD-1", {
      completedSteps: ["signature"],
      stepTimestamps: { signature: "2026-01-01T00:00:00.000Z" },
      proofs: {},
      proofSync: {
        signature: {
          syncStatus: "synced",
          serverProofId: "signature",
          syncedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const before = localStorage.getItem("qre-driver-proofs-v2");
    reconcileLocalProofsWithServer("DRV-A", "ORD-1", [serverProof("signature")]);
    reconcileLocalProofsWithServer("DRV-A", "ORD-1", [
      serverProof("signature", "https://signed.example/signature?v=2"),
    ]);
    const after = localStorage.getItem("qre-driver-proofs-v2");
    expect(after).toBe(before);
  });
});
