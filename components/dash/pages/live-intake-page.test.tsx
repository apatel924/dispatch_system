/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LiveIntakePage, rowPills } from "@/components/dash/pages/live-intake-page";
import type { ExternalOrderIntakeRow } from "@/lib/dash/api/client";

const useLiveIntake = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dash/hooks/use-live-intake", () => ({
  useLiveIntake,
}));

vi.mock("@/lib/dash/hooks/use-admin-drivers", () => ({
  useAdminDrivers: () => ({ drivers: [] }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/dash/layout/dashboard-layout", () => ({
  DashboardLayout: ({ children, title }: { children: ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function baseRow(overrides: Partial<ExternalOrderIntakeRow> = {}): ExternalOrderIntakeRow {
  return {
    id: "barnet_1",
    provider: "barnet",
    externalOrderId: "1",
    externalOrderNumber: "1",
    customerName: "Ada",
    customerPhone: null,
    deliveryAddress: null,
    itemsCount: 1,
    total: 2500,
    sourceStatus: "Paid",
    dispatchReady: false,
    needsReview: true,
    reviewReasons: ["missing_address"],
    customerMessagingReady: false,
    missingFields: ["address", "city", "state", "zip"],
    assignmentStatus: "unassigned",
    dispatchStatus: "needs_review",
    assignedDriverId: null,
    assignedDriverName: null,
    isPreview: false,
    alreadyImported: true,
    promoted: false,
    promotedOrderId: null,
    promotedAt: null,
    updatedAt: "2026-07-14T12:00:00Z",
    lastSyncedAt: "2026-07-14T12:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LiveIntakePage sync summary and review pills", () => {
  it("rowPills show Needs Review and Missing Address for reviewable imports", () => {
    const pills = rowPills(baseRow());
    expect(pills.map((p) => p.label)).toEqual(
      expect.arrayContaining(["Needs Review", "Missing Address"]),
    );
  });

  it("shows last sync needs-review summary and imported review order", async () => {
    useLiveIntake.mockReturnValue({
      health: { mode: "live", liveReadsEnabled: true, liveSyncEnabled: true, ordersConfigured: true },
      orders: [baseRow()],
      tableRows: [baseRow()],
      previewRows: [],
      summary: {
        ordersScanned: 10,
        deliveryOrdersFound: 1,
        readyToDispatch: 0,
        needsReview: 1,
        alreadyImported: 1,
        assigned: 0,
      },
      syncState: {
        lastSuccessfulSyncAt: "2026-07-14T19:45:00.000Z",
        lastAttemptedSyncAt: "2026-07-14T19:45:00.000Z",
        lastScanAt: "2026-07-14T19:45:00.000Z",
        lastResult: "imported_new",
        lastError: null,
        lastSyncSummary: {
          inserted: 1,
          updated: 0,
          deliveryOrdersFound: 1,
          pagesScanned: 10,
        },
      },
      lastSyncResult: {
        ok: true,
        mode: "live",
        pagesScanned: 10,
        totalOrdersSeen: 200,
        deliveryOrdersFound: 1,
        pickupOrdersIgnored: 199,
        unknownOrdersIgnored: 0,
        inserted: 1,
        updated: 0,
        total: 1,
        unchangedOrders: 0,
        needsReview: 1,
        readyToDispatch: 0,
        invalidOrders: 0,
      },
      selectedOrderId: null,
      selectedDetail: null,
      discoveredLocations: [],
      scanStats: {
        pagesScanned: 10,
        totalOrdersSeen: 200,
        deliveryOrdersFound: 1,
        pickupOrdersIgnored: 199,
        unknownOrdersIgnored: 0,
      },
      orderDetailDiagnostics: null,
      loading: false,
      detailLoading: false,
      liveChecking: false,
      liveDiscovering: false,
      livePreviewing: false,
      liveScanning: false,
      liveSyncing: false,
      liveProbing: false,
      assigning: false,
      promoting: false,
      error: null,
      message:
        "Delivery found: 1 · Imported: 1 · Updated: 0 · Unchanged: 0 · Ready to dispatch: 0 · Needs review: 1 · Skipped: 199",
      isMockMode: false,
      liveReadsEnabled: true,
      liveSyncEnabled: true,
      ordersConfigured: true,
      loadIntake: vi.fn(),
      loadDetail: vi.fn(),
      checkConnection: vi.fn(),
      discoverLocations: vi.fn(),
      previewOrders: vi.fn(),
      scanDeliveryOrders: vi.fn(),
      syncDeliveryOrders: vi.fn(),
      probeOrderDetail: vi.fn(),
      assignDriver: vi.fn(),
      promoteToDispatch: vi.fn(),
      clearPreview: vi.fn(),
      setSelectedOrderId: vi.fn(),
      setSelectedDetail: vi.fn(),
      formatTotal: (cents: number) => `$${(cents / 100).toFixed(2)}`,
    });

    render(<LiveIntakePage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Last completed scan:/i)).toBeTruthy();
    });
    expect(screen.getByText(/Last successful sync:/i)).toBeTruthy();
    expect(screen.getByText(/Last cron attempt:/i)).toBeTruthy();
    expect(screen.getByText(/Last scan imported 1 new delivery order/i)).toBeTruthy();
    expect(screen.getAllByText(/Delivery found: 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Imported: 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Missing Address").length).toBeGreaterThan(0);
  });

  it("keeps preview visible messaging when refresh fails after sync", async () => {
    useLiveIntake.mockReturnValue({
      health: { mode: "live", liveReadsEnabled: true, liveSyncEnabled: true, ordersConfigured: true },
      orders: [],
      tableRows: [baseRow({ isPreview: true, alreadyImported: false })],
      previewRows: [baseRow({ isPreview: true, alreadyImported: false })],
      summary: {
        ordersScanned: 10,
        deliveryOrdersFound: 1,
        readyToDispatch: 0,
        needsReview: 1,
        alreadyImported: 0,
        assigned: 0,
      },
      syncState: null,
      lastSyncResult: {
        ok: true,
        mode: "live",
        pagesScanned: 10,
        totalOrdersSeen: 200,
        deliveryOrdersFound: 1,
        pickupOrdersIgnored: 199,
        unknownOrdersIgnored: 0,
        inserted: 1,
        updated: 0,
        total: 1,
        needsReview: 1,
        readyToDispatch: 0,
      },
      selectedOrderId: null,
      selectedDetail: null,
      discoveredLocations: [],
      scanStats: null,
      orderDetailDiagnostics: null,
      loading: false,
      detailLoading: false,
      liveChecking: false,
      liveDiscovering: false,
      livePreviewing: false,
      liveScanning: false,
      liveSyncing: false,
      liveProbing: false,
      assigning: false,
      promoting: false,
      error: "Sync completed but failed to refresh imported orders: network",
      message: null,
      isMockMode: false,
      liveReadsEnabled: true,
      liveSyncEnabled: true,
      ordersConfigured: true,
      loadIntake: vi.fn(),
      loadDetail: vi.fn(),
      checkConnection: vi.fn(),
      discoverLocations: vi.fn(),
      previewOrders: vi.fn(),
      scanDeliveryOrders: vi.fn(),
      syncDeliveryOrders: vi.fn(),
      probeOrderDetail: vi.fn(),
      assignDriver: vi.fn(),
      promoteToDispatch: vi.fn(),
      clearPreview: vi.fn(),
      setSelectedOrderId: vi.fn(),
      setSelectedDetail: vi.fn(),
      formatTotal: (cents: number) => `$${(cents / 100).toFixed(2)}`,
    });

    render(<LiveIntakePage />, { wrapper });

    expect(screen.getByText(/Preview results \(not saved\)/i)).toBeTruthy();
    expect(screen.getByText(/failed to refresh imported orders/i)).toBeTruthy();
  });

  it("does not expose Live Intake assign controls for already-promoted orders", async () => {
    useLiveIntake.mockReturnValue({
      health: {
        mode: "live",
        liveReadsEnabled: true,
        liveSyncEnabled: true,
        ordersConfigured: true,
      },
      orders: [],
      tableRows: [
        baseRow({
          id: "barnet_promoted",
          promoted: true,
          promotedOrderId: "QRX-10007",
          promotedAt: "2026-07-16T00:45:16.788Z",
          dispatchReady: true,
          needsReview: false,
          missingFields: ["delivery_instructions"],
        }),
      ],
      previewRows: [],
      summary: {
        ordersScanned: 1,
        deliveryOrdersFound: 1,
        readyToDispatch: 0,
        needsReview: 0,
        alreadyImported: 1,
        assigned: 0,
      },
      syncState: null,
      lastSyncResult: null,
      selectedOrderId: "barnet_promoted",
      selectedDetail: {
        id: "barnet_promoted",
        provider: "barnet",
        externalOrderId: "826071552835",
        externalOrderNumber: "826071552835",
        sourceLocationId: "14",
        sourceStatus: "Paid",
        deliveryStatus: null,
        paymentStatus: "Paid",
        placedAt: "2026-07-15T00:00:00.000Z",
        createdAt: "2026-07-15T00:00:00.000Z",
        updatedAt: "2026-07-15T00:00:00.000Z",
        lastSyncedAt: "2026-07-15T00:00:00.000Z",
        isDelivery: true,
        customer: {
          externalCustomerId: "1",
          name: "Abigail Walker",
          phone: "8259757685",
          email: null,
        },
        delivery: {
          address1: "27 740 Daniels way",
          address2: null,
          city: null,
          province: null,
          postalCode: "T6H 5N2",
          formattedAddress: "27 740 Daniels way, T6H 5N2",
          notes: null,
        },
        items: [{ name: "Unknown item", quantity: 1, unitPrice: 10, notes: null }],
        totals: {
          subtotal: null,
          tax: null,
          discount: null,
          total: 23,
        },
        dispatchReady: true,
        needsReview: false,
        reviewReasons: [],
        customerMessagingReady: true,
        customerEnrichmentStatus: "success",
        missingFields: ["delivery_instructions"],
        assignmentStatus: "unassigned",
        dispatchStatus: "promoted",
        assignedDriverId: null,
        assignedDriverName: null,
        assignedAt: null,
        assignedBy: null,
        dispatchChecks: {
          deliveryOrderConfirmed: true,
          customerNamePresent: true,
          customerPhonePresent: true,
          deliveryAddressPresent: true,
          itemsPresent: true,
          notAlreadyAssigned: true,
        },
        promoted: true,
        promotedOrderId: "QRX-10007",
        promotedAt: "2026-07-16T00:45:16.788Z",
      },
      discoveredLocations: [],
      scanStats: null,
      orderDetailDiagnostics: null,
      loading: false,
      detailLoading: false,
      liveChecking: false,
      liveDiscovering: false,
      livePreviewing: false,
      liveScanning: false,
      liveSyncing: false,
      liveProbing: false,
      assigning: false,
      promoting: false,
      error: null,
      message: null,
      isMockMode: false,
      liveReadsEnabled: true,
      liveSyncEnabled: true,
      ordersConfigured: true,
      loadIntake: vi.fn(),
      loadDetail: vi.fn(),
      checkConnection: vi.fn(),
      discoverLocations: vi.fn(),
      previewOrders: vi.fn(),
      scanDeliveryOrders: vi.fn(),
      syncDeliveryOrders: vi.fn(),
      probeOrderDetail: vi.fn(),
      assignDriver: vi.fn(),
      promoteToDispatch: vi.fn(),
      clearPreview: vi.fn(),
      setSelectedOrderId: vi.fn(),
      setSelectedDetail: vi.fn(),
      formatTotal: (cents: number) => `$${(cents / 100).toFixed(2)}`,
    });

    render(<LiveIntakePage />, { wrapper });

    expect(screen.getByText(/Already in Orders as QRX-10007/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open Dispatch Order/i })).toBeTruthy();
    expect(
      screen.getByText(/Driver assignment is managed on the dispatch order/i),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Assign on Orders page/i })).toBeTruthy();
    expect(screen.queryByLabelText(/Active driver/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Assign Driver$/i }),
    ).toBeNull();
  });
});
