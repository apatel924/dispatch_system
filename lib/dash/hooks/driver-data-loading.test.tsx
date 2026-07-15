/**
 * @vitest-environment happy-dom
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { makeQueryClient } from "@/components/providers/query-provider";
import { getMockDriverProfile } from "@/lib/dash/api/driver-adapters";

vi.mock("next/navigation", () => ({
  usePathname: () => "/driver-dashboard",
}));

function createWrapper(client: ReturnType<typeof makeQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("API-enabled driver hooks — no mock-first", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_USE_API", "true");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_MOCK", "false");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("does not initially return mock profile data when API is enabled", async () => {
    vi.doMock("@/lib/dash/api/config", () => ({
      isApiEnabled: () => true,
      shouldUseMockData: () => false,
      isDevMockEnabled: () => false,
    }));
    vi.doMock("@/lib/auth/firebase-client", () => ({
      isAuthConfigured: () => true,
      getDriverAuthClaims: async () => ({ driverId: "drv-real" }),
      subscribeToAuthState: () => () => undefined,
    }));
    let resolveProfile: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveProfile = resolve;
    });
    vi.doMock("@/lib/dash/api/driver-client", () => ({
      fetchDriverProfile: () => pending,
      fetchDriverOrders: vi.fn(),
      fetchDriverOrderDetail: vi.fn(),
    }));

    const { useDriverSession } = await import(
      "@/lib/dash/hooks/use-driver-session"
    );
    const client = makeQueryClient();
    const { result } = renderHook(() => useDriverSession(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.driver).toBeNull();
    expect(result.current.driver?.name).not.toBe(getMockDriverProfile().name);

    resolveProfile({
      driver: {
        id: "drv-real",
        name: "Real Driver",
        phone: "+15555550100",
        email: "real@example.com",
        status: "Available",
        vehicle: "Van",
        zone: "North",
        activeDeliveries: 1,
        completedToday: 0,
        failedToday: 0,
      },
    });

    await waitFor(() => expect(result.current.driver?.id).toBe("drv-real"));
    expect(result.current.driver?.name).toBe("Real Driver");
    expect(result.current.source).toBe("api");
  });

  it("does not fall back to mocks when profile fetch fails", async () => {
    vi.doMock("@/lib/dash/api/config", () => ({
      isApiEnabled: () => true,
      shouldUseMockData: () => false,
      isDevMockEnabled: () => false,
    }));
    vi.doMock("@/lib/auth/firebase-client", () => ({
      isAuthConfigured: () => true,
      getDriverAuthClaims: async () => ({ driverId: "drv-real" }),
      subscribeToAuthState: () => () => undefined,
    }));
    vi.doMock("@/lib/dash/api/driver-client", () => ({
      fetchDriverProfile: async () => {
        throw new Error("boom");
      },
      fetchDriverOrders: vi.fn(),
      fetchDriverOrderDetail: vi.fn(),
    }));

    const { useDriverSession } = await import(
      "@/lib/dash/hooks/use-driver-session"
    );
    const qc = makeQueryClient();
    qc.setDefaultOptions({ queries: { retry: false } });

    const { result } = renderHook(() => useDriverSession(), {
      wrapper: createWrapper(qc),
    });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.driver).toBeNull();
    expect(result.current.source).not.toBe("mock");
  });

  it("uses mock profile only in explicit demo mode", async () => {
    vi.doMock("@/lib/dash/api/config", () => ({
      isApiEnabled: () => false,
      shouldUseMockData: () => true,
      isDevMockEnabled: () => true,
    }));
    vi.doMock("@/lib/auth/firebase-client", () => ({
      isAuthConfigured: () => false,
      getDriverAuthClaims: async () => null,
      subscribeToAuthState: () => () => undefined,
    }));

    const { useDriverSession } = await import(
      "@/lib/dash/hooks/use-driver-session"
    );
    const { result } = renderHook(() => useDriverSession(), {
      wrapper: createWrapper(makeQueryClient()),
    });

    await waitFor(() => expect(result.current.driver).not.toBeNull());
    expect(result.current.source).toBe("mock");
    expect(result.current.driver?.id).toBe(getMockDriverProfile().id);
  });

  it("does not initially return mock orders when API is enabled", async () => {
    vi.doMock("@/lib/dash/api/config", () => ({
      isApiEnabled: () => true,
      shouldUseMockData: () => false,
      isDevMockEnabled: () => false,
    }));
    vi.doMock("@/lib/auth/firebase-client", () => ({
      isAuthConfigured: () => true,
      getDriverAuthClaims: async () => ({ driverId: "drv-real" }),
      subscribeToAuthState: () => () => undefined,
    }));
    vi.doMock("@/lib/dash/api/driver-client", () => ({
      fetchDriverProfile: async () => ({
        driver: {
          id: "drv-real",
          name: "Real Driver",
          phone: "+1",
          email: "a@b.c",
          status: "Available",
          vehicle: "Van",
          zone: "N",
          activeDeliveries: 0,
          completedToday: 0,
          failedToday: 0,
        },
      }),
      fetchDriverOrders: vi.fn(async () => ({ orders: [] })),
      fetchDriverOrderDetail: vi.fn(),
    }));

    const { useDriverSession } = await import(
      "@/lib/dash/hooks/use-driver-session"
    );
    const { useDriverOrders } = await import(
      "@/lib/dash/hooks/use-driver-orders"
    );

    const client = makeQueryClient();
    const wrapper = createWrapper(client);
    renderHook(() => useDriverSession(), { wrapper });
    const { result } = renderHook(() => useDriverOrders(), { wrapper });

    // While resolving / before data, never seed mock ids
    expect(result.current.activeOrders).toEqual([]);
    expect(result.current.source).toBe("api");

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.activeOrders).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
