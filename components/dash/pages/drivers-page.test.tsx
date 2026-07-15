/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { DriversPage } from "@/components/dash/pages/drivers-page";

const useAdminDrivers = vi.hoisted(() => vi.fn());
const useAdminDashboardStats = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dash/hooks/use-admin-drivers", () => ({
  useAdminDrivers,
}));

vi.mock("@/lib/dash/hooks/use-admin-dashboard-stats", () => ({
  useAdminDashboardStats,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/drivers",
}));

function renderWithQuery(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("DriversPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("keeps search and removes dead Filter / Status / Export controls", () => {
    useAdminDrivers.mockReturnValue({
      drivers: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    useAdminDashboardStats.mockReturnValue({
      stats: null,
      loading: false,
      error: null,
    });

    renderWithQuery(<DriversPage />);

    expect(screen.getByLabelText("Search drivers")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Filter/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Status/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Export/i })).toBeNull();
  });
});
