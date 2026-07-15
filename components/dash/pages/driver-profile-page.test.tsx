/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DriverProfilePage } from "@/components/dash/pages/driver-profile-page";

const useAdminDriver = vi.hoisted(() => vi.fn());
const useAdminOrders = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dash/hooks/use-admin-drivers", () => ({
  useAdminDriver,
}));

vi.mock("@/lib/dash/hooks/use-admin-orders", () => ({
  useAdminOrders,
}));

vi.mock("@/components/dash/driver-edit-dialog", () => ({
  DriverEditDialog: () => null,
}));

vi.mock("@/components/dash/driver-account-access", () => ({
  DriverAccountAccessCard: () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/drivers/DRV-1",
}));

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("DriverProfilePage operational cleanup", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("omits Member Since, Average Delivery Time, and rating placeholders", () => {
    useAdminDriver.mockReturnValue({
      driver: {
        id: "DRV-1",
        name: "James Carter",
        phone: "(555) 111-2222",
        email: "j@qre.com",
        status: "Available",
        activeDeliveries: 1,
        completedToday: 2,
        failedToday: 0,
        averageTime: "24m",
        lastActive: "1m ago",
        avatarColor: "bg-info-soft text-info",
        initials: "JC",
        joinedDate: "Jan 2024",
        deliveries: 10,
        successRate: 95,
        vehicle: "Van",
      },
      loading: false,
      error: null,
      applyDriverUpdate: vi.fn(),
    });
    useAdminOrders.mockReturnValue({
      orders: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    renderWithQuery(<DriverProfilePage driverId="DRV-1" />);

    expect(screen.queryByText("Member Since")).toBeNull();
    expect(screen.queryByText("Average Delivery Time")).toBeNull();
    expect(screen.queryByText(/Coming soon/i)).toBeNull();
    expect(screen.queryByText(/rating/i)).toBeNull();
    expect(screen.getByText("Total Deliveries")).toBeTruthy();
    expect(screen.getByText("Success Rate")).toBeTruthy();
    expect(screen.getByText("Active Orders")).toBeTruthy();
  });
});
