/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { OrdersPage } from "@/components/dash/pages/orders-page";

const useAdminOrders = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dash/hooks/use-admin-orders", () => ({
  useAdminOrders,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/orders",
}));

describe("OrdersPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("shows loading state", () => {
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<OrdersPage />);
    expect(screen.getByText("Loading orders…")).toBeTruthy();
  });

  it("shows error state when API fails", () => {
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: "Failed to load orders",
      refresh: vi.fn(),
    });

    render(<OrdersPage />);
    expect(screen.getByRole("alert").textContent).toContain("Failed to load orders");
  });

  it("shows empty state when there are no orders", () => {
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<OrdersPage />);
    expect(screen.getByText("No orders found")).toBeTruthy();
  });

  it("does not render the legacy May 2024 date filter chip", () => {
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<OrdersPage />);
    expect(screen.queryByText(/May 10/)).toBeNull();
    expect(screen.queryByText(/May 16, 2024/)).toBeNull();
  });

  it("does not render fake pagination controls", () => {
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<OrdersPage />);
    expect(screen.queryByText("…")).toBeNull();
    expect(screen.queryByRole("button", { name: "17" })).toBeNull();
    expect(screen.queryByRole("button", { name: "4" })).toBeNull();
  });
});
