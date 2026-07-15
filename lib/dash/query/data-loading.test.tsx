/**
 * @vitest-environment happy-dom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, renderHook, waitFor, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { StatCard } from "@/components/dash/ui/stat-card";
import { FileText } from "lucide-react";
import {
  clearAuthenticatedQueryCache,
  dashboardKeys,
  driverKeys,
  invalidateAfterOrderLifecycle,
  orderKeys,
  shouldPollQuery,
} from "@/lib/dash/query/query-keys";
import { shouldUseMockData, isDevMockEnabled } from "@/lib/dash/api/config";
import { makeQueryClient } from "@/components/providers/query-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/driver-dashboard",
}));

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("mock-mode policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not enable mocks when API is on", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_API", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_MOCK", "true");
    expect(isDevMockEnabled()).toBe(false);
    expect(shouldUseMockData()).toBe(false);
  });

  it("enables mocks only with explicit demo flag and API off", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_API", "false");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_MOCK", "true");
    expect(shouldUseMockData()).toBe(true);
  });

  it("does not infer mocks from missing data alone", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_API", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_MOCK", undefined);
    expect(shouldUseMockData()).toBe(false);
  });
});

describe("query key factories", () => {
  it("includes filters that change the response", () => {
    expect(orderKeys.list({ status: "Assigned" })).not.toEqual(
      orderKeys.list({ status: "Delivered" }),
    );
    expect(driverKeys.orders("drv-a", "active")).not.toEqual(
      driverKeys.orders("drv-b", "active"),
    );
    expect(driverKeys.orderDetail("drv-a", "ord-1")).not.toEqual(
      driverKeys.orderDetail("drv-a", "ord-2"),
    );
  });

  it("uses stable list keys for empty vs omitted filter objects", () => {
    expect(orderKeys.list()).toEqual(orderKeys.list({}));
  });
});

describe("authenticated cache isolation", () => {
  it("clears admin and driver query caches on logout", () => {
    const client = makeQueryClient();
    client.setQueryData(dashboardKeys.stats(), { newOrders: 3 });
    client.setQueryData(driverKeys.session("drv-a"), {
      driver: { id: "drv-a", name: "A" },
      source: "api",
    });
    client.setQueryData(orderKeys.list(), { rows: [{ id: "1" }], source: "api" });

    clearAuthenticatedQueryCache(client);

    expect(client.getQueryData(dashboardKeys.stats())).toBeUndefined();
    expect(client.getQueryData(driverKeys.session("drv-a"))).toBeUndefined();
    expect(client.getQueryData(orderKeys.list())).toBeUndefined();
  });

  it("does not reuse Driver A session key for Driver B", () => {
    expect(driverKeys.session("drv-a")).not.toEqual(driverKeys.session("drv-b"));
    expect(driverKeys.orders("drv-a", "active")).not.toEqual(
      driverKeys.orders("drv-b", "active"),
    );
  });
});

describe("mutation invalidation", () => {
  it("invalidates orders, dashboard stats, and optional detail after lifecycle", async () => {
    const client = makeQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    await invalidateAfterOrderLifecycle(client, {
      orderId: "ord-9",
      driverId: "drv-1",
    });

    const keys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        orderKeys.all,
        dashboardKeys.all,
        orderKeys.detail("ord-9"),
        driverKeys.detail("drv-1"),
        driverKeys.ordersRoot,
      ]),
    );
  });
});

describe("polling visibility gate", () => {
  it("pauses polling when document is hidden", () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    expect(shouldPollQuery("/dashboard", ["/dashboard"])).toBe(false);
  });

  it("allows polling on matching focused routes", () => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    expect(shouldPollQuery("/dashboard", ["/dashboard"])).toBe(true);
    expect(shouldPollQuery("/settings", ["/dashboard"])).toBe(false);
  });
});

describe("StatCard loading vs genuine zero", () => {
  afterEach(() => cleanup());

  it("shows a skeleton for unknown values instead of 0", () => {
    const { container } = render(
      <StatCard label="New Orders" value={null} icon={FileText} loading />,
    );
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("renders genuine zero", () => {
    render(<StatCard label="New Orders" value={0} icon={FileText} />);
    expect(screen.getByText("0")).toBeTruthy();
  });
});

describe("dashboard stats hook — no snap / retain on error", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_USE_API", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_MOCK", "false");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/dash/api/client");
    vi.doUnmock("@/lib/dash/api/config");
  });

  it("starts with null stats (not zeros) while loading", async () => {
    vi.doMock("@/lib/dash/api/config", () => ({
      isApiEnabled: () => true,
      shouldUseMockData: () => false,
      isDevMockEnabled: () => false,
    }));
    let resolveFetch: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.doMock("@/lib/dash/api/client", () => ({
      fetchDashboardStats: () => pending,
    }));

    const { useAdminDashboardStats } = await import(
      "@/lib/dash/hooks/use-admin-dashboard-stats"
    );
    const client = makeQueryClient();
    const { result } = renderHook(() => useAdminDashboardStats(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.stats).toBeNull();
    expect(result.current.loading).toBe(true);

    resolveFetch({
      stats: {
        newOrders: 4,
        awaitingAssignment: 1,
        activeDeliveries: 2,
        completedToday: 0,
        failedToday: 0,
        returnedToday: 0,
        failedReturnedToday: 0,
        availableDrivers: 3,
        busyDrivers: 1,
        totalActiveDrivers: 4,
        dataCoverage: { complete: true },
      },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats?.newOrders).toBe(4);
    expect(result.current.stats?.completedToday).toBe(0);
  });

  it("keeps stale real stats when a refresh fails", async () => {
    vi.doMock("@/lib/dash/api/config", () => ({
      isApiEnabled: () => true,
      shouldUseMockData: () => false,
      isDevMockEnabled: () => false,
    }));

    let call = 0;
    vi.doMock("@/lib/dash/api/client", () => ({
      fetchDashboardStats: async () => {
        call += 1;
        if (call === 1) {
          return {
            stats: {
              newOrders: 7,
              awaitingAssignment: 2,
              activeDeliveries: 1,
              completedToday: 0,
              failedToday: 0,
              returnedToday: 0,
              failedReturnedToday: 0,
              availableDrivers: 2,
              busyDrivers: 0,
              totalActiveDrivers: 2,
              dataCoverage: { complete: true },
            },
          };
        }
        throw new Error("network down");
      },
    }));

    const { useAdminDashboardStats } = await import(
      "@/lib/dash/hooks/use-admin-dashboard-stats"
    );
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
      },
    });
    const { result } = renderHook(() => useAdminDashboardStats(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.stats?.newOrders).toBe(7));

    await client.invalidateQueries({ queryKey: dashboardKeys.stats() });
    await waitFor(() => expect(result.current.error).toBeTruthy());

    expect(result.current.stats?.newOrders).toBe(7);
  });
});

describe("query deduplication", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_USE_API", "true");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("two consumers of the same stats key trigger one request", async () => {
    vi.doMock("@/lib/dash/api/config", () => ({
      isApiEnabled: () => true,
      shouldUseMockData: () => false,
      isDevMockEnabled: () => false,
    }));
    const fetchDashboardStats = vi.fn().mockResolvedValue({
      stats: {
        newOrders: 1,
        awaitingAssignment: 0,
        activeDeliveries: 0,
        completedToday: 0,
        failedToday: 0,
        returnedToday: 0,
        failedReturnedToday: 0,
        availableDrivers: 0,
        busyDrivers: 0,
        totalActiveDrivers: 0,
        dataCoverage: { complete: true },
      },
    });
    vi.doMock("@/lib/dash/api/client", () => ({ fetchDashboardStats }));

    const { useAdminDashboardStats } = await import(
      "@/lib/dash/hooks/use-admin-dashboard-stats"
    );
    const client = makeQueryClient();
    const wrapper = createWrapper(client);

    const a = renderHook(() => useAdminDashboardStats(), { wrapper });
    const b = renderHook(() => useAdminDashboardStats(), { wrapper });

    await waitFor(() => {
      expect(a.result.current.hasData).toBe(true);
      expect(b.result.current.hasData).toBe(true);
    });

    expect(fetchDashboardStats).toHaveBeenCalledTimes(1);
  });
});
