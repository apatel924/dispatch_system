/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  clearAccountDisabledSession,
  createAccountDisabledHandler,
  handleAccountDisabledResponse,
  isAccountDisabledSession,
  registerAccountDisabledHandler,
  resetAccountDisabledSessionForTests,
} from "@/lib/dash/api/account-disabled";
import { ACCOUNT_DISABLED_CODE } from "@/lib/auth/account-status";
import { clearAuthenticatedQueryCache, shouldPollQuery } from "@/lib/dash/query/query-keys";

describe("ACCOUNT_DISABLED client handling", () => {
  beforeEach(() => {
    resetAccountDisabledSessionForTests();
    registerAccountDisabledHandler(null);
    vi.stubGlobal("location", {
      ...window.location,
      assign: vi.fn(),
    });
  });

  afterEach(() => {
    registerAccountDisabledHandler(null);
    resetAccountDisabledSessionForTests();
    vi.unstubAllGlobals();
  });

  it("clears authenticated query data and stops polling after disable", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["admin", "orders", "list", {}], [{ id: "1" }]);
    queryClient.setQueryData(["driver", "orders", "drv-a", "active"], [{ id: "2" }]);

    const clearProof = vi.fn();
    const signOutPortal = vi.fn(async () => undefined);
    const handler = createAccountDisabledHandler({
      queryClient,
      clearAuthenticatedQueryCache,
      getDriverIdClaims: async () => "drv-a",
      prepareDriverProofLogout: () => ({ hasUnsynced: false, clear: clearProof }),
      signOutPortal,
    });
    registerAccountDisabledHandler(handler);

    const first = handleAccountDisabledResponse("driver");
    const second = handleAccountDisabledResponse("driver");
    await Promise.all([first, second]);

    expect(isAccountDisabledSession()).toBe(true);
    expect(shouldPollQuery("/driver-dashboard", ["/driver-dashboard"])).toBe(false);
    expect(queryClient.getQueryData(["admin", "orders", "list", {}])).toBeUndefined();
    expect(
      queryClient.getQueryData(["driver", "orders", "drv-a", "active"]),
    ).toBeUndefined();
    expect(clearProof).toHaveBeenCalledTimes(1);
    expect(signOutPortal).toHaveBeenCalledWith("driver");
    expect(window.location.assign).toHaveBeenCalledWith(
      expect.stringContaining(`reason=${ACCOUNT_DISABLED_CODE}`),
    );
  });

  it("does not expose Driver A proofs when clearing for Driver B login prep", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["driver", "session", "drv-a"], { id: "drv-a" });
    const clearedIds: string[] = [];
    registerAccountDisabledHandler(
      createAccountDisabledHandler({
        queryClient,
        clearAuthenticatedQueryCache,
        getDriverIdClaims: async () => "drv-a",
        prepareDriverProofLogout: (driverId) => ({
          hasUnsynced: true,
          clear: () => clearedIds.push(driverId),
        }),
        signOutPortal: async () => undefined,
      }),
    );

    await handleAccountDisabledResponse("driver");
    expect(clearedIds).toEqual(["drv-a"]);
    clearAccountDisabledSession();
    expect(isAccountDisabledSession()).toBe(false);
  });
});
