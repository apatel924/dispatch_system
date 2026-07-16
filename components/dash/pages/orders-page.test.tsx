/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { OrdersPage } from "@/components/dash/pages/orders-page";

const useAdminOrders = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dash/hooks/use-admin-orders", () => ({
  useAdminOrders,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/orders",
  useSearchParams: () => new URLSearchParams(),
}));

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const sampleOrders = [
  {
    id: "QRX-1",
    external: "EXT-1",
    customer: "Alpha",
    phone: "555",
    address: "1 St",
    driver: null,
    status: "New",
    payment: "Paid",
    total: "$1",
    created: "a",
    updated: "b",
  },
  {
    id: "QRX-2",
    external: "EXT-2",
    customer: "Beta",
    phone: "555",
    address: "2 St",
    driver: "James",
    status: "Out for Delivery",
    payment: "Paid",
    total: "$2",
    created: "a",
    updated: "b",
  },
  {
    id: "QRX-3",
    external: "EXT-3",
    customer: "Gamma",
    phone: "555",
    address: "3 St",
    driver: "James",
    status: "En Route",
    payment: "Paid",
    total: "$3",
    created: "a",
    updated: "b",
  },
];

describe("OrdersPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("shows loading state", () => {
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: true,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });

    const { container } = renderWithQuery(<OrdersPage />);
    expect(container.querySelector("[aria-label='Loading orders']")).toBeTruthy();

    const tbodies = container.querySelectorAll("table tbody");
    expect(tbodies).toHaveLength(1);
    expect(tbodies[0].querySelector("tbody")).toBeNull();
    const skeletonRows = tbodies[0].querySelectorAll("tr[aria-hidden='true']");
    expect(skeletonRows.length).toBeGreaterThan(0);
    for (const row of skeletonRows) {
      expect(row.parentElement).toBe(tbodies[0]);
    }
  });

  it("renders loaded order rows as direct tbody children", () => {
    useAdminOrders.mockReturnValue({
      orders: sampleOrders,
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });

    const { container } = renderWithQuery(<OrdersPage />);
    const tbody = container.querySelector("table tbody");
    expect(tbody).toBeTruthy();
    expect(tbody!.querySelector("tbody")).toBeNull();
    expect(screen.getAllByText("QRX-1").length).toBeGreaterThan(0);
    const dataRow = Array.from(tbody!.querySelectorAll("tr")).find((tr) =>
      tr.textContent?.includes("QRX-1"),
    );
    expect(dataRow?.parentElement).toBe(tbody);
  });

  it("keeps empty-state markup valid inside a single tbody", () => {
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });

    const { container } = renderWithQuery(<OrdersPage />);
    const tbodies = container.querySelectorAll("table tbody");
    expect(tbodies).toHaveLength(1);
    expect(tbodies[0].querySelector("tbody")).toBeNull();
    expect(screen.getAllByText("No orders found").length).toBeGreaterThan(0);
  });

  it("shows error state with retry", () => {
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: false,
      refreshing: false,
      error: "Failed to load orders",
      refresh: vi.fn(),
    });

    renderWithQuery(<OrdersPage />);
    expect(screen.getByRole("alert").textContent).toContain("Failed to load orders");
    expect(screen.getByRole("button", { name: /Retry/i })).toBeTruthy();
  });

  it("keeps search and lifecycle tabs without dead bulk controls", () => {
    useAdminOrders.mockReturnValue({
      orders: sampleOrders,
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });

    renderWithQuery(<OrdersPage />);
    expect(screen.getByLabelText("Search orders")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Active" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Create Order/i }).length).toBeGreaterThan(0);

    expect(screen.queryByText(/Bulk Actions/i)).toBeNull();
    expect(screen.queryByText(/0 selected/i)).toBeNull();
    expect(screen.queryByText(/Save View/i)).toBeNull();
    expect(screen.queryByText(/^Export$/i)).toBeNull();
    expect(screen.queryByText(/^Filters$/i)).toBeNull();
    expect(screen.queryByLabelText(/Filter by status/i)).toBeNull();
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });

  it("groups En Route under Active via authoritative helpers", () => {
    useAdminOrders.mockReturnValue({
      orders: sampleOrders,
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });

    renderWithQuery(<OrdersPage />);
    fireEvent.click(screen.getAllByRole("tab", { name: "Active" })[0]);
    expect(screen.getAllByText("QRX-2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("QRX-3").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("QRX-1")).toHaveLength(0);
  });

  it("excludes unrecognized-status orders from Awaiting and shows Needs Review", () => {
    useAdminOrders.mockReturnValue({
      orders: [
        {
          id: "QRX-NEW",
          external: "EXT-N",
          customer: "Delta",
          phone: "555",
          address: "4 St",
          driver: null,
          driverId: null,
          status: "Scheduled",
          unrecognizedStatusRaw: "Weird Legacy",
          payment: "Paid",
          total: "$4",
          created: "a",
          updated: "b",
        },
        {
          id: "QRX-OK",
          external: "EXT-O",
          customer: "Epsilon",
          phone: "555",
          address: "5 St",
          driver: null,
          driverId: null,
          status: "New",
          unrecognizedStatusRaw: null,
          payment: "Paid",
          total: "$5",
          created: "a",
          updated: "b",
        },
      ],
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });

    renderWithQuery(<OrdersPage />);
    fireEvent.click(screen.getAllByRole("tab", { name: "Awaiting" })[0]);
    expect(screen.getAllByText("QRX-OK").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("QRX-NEW")).toHaveLength(0);

    fireEvent.click(screen.getAllByRole("tab", { name: "All" })[0]);
    expect(screen.getAllByText("QRX-NEW").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Needs Review").length).toBeGreaterThan(0);
  });

  it("does not render fake pagination controls", () => {
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: false,
      refreshing: false,
      error: null,
      refresh: vi.fn(),
    });

    renderWithQuery(<OrdersPage />);
    expect(screen.queryByRole("button", { name: "17" })).toBeNull();
  });
});
