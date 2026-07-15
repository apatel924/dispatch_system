"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled, shouldUseMockData } from "@/lib/dash/api/config";
import { CACHE_DRIVER_SESSION_MS } from "@/lib/dash/query/cache-policy";
import {
  apiDriverToUiProfile,
  getMockDriverProfile,
} from "@/lib/dash/api/driver-adapters";
import { fetchDriverProfile } from "@/lib/dash/api/driver-client";
import {
  getDriverAuthClaims,
  isAuthConfigured,
  subscribeToAuthState,
} from "@/lib/auth/firebase-client";
import type { DriverProfile } from "@/lib/dash/driver-mock-data";
import {
  clearAuthenticatedQueryCache,
  driverKeys,
} from "@/lib/dash/query/query-keys";

async function resolveDriverId(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  const claims = await getDriverAuthClaims();
  return claims?.driverId ?? null;
}

export function useDriverSession() {
  const queryClient = useQueryClient();
  const apiEnabled = isApiEnabled();
  const mockMode = shouldUseMockData();

  const claimsQuery = useQuery({
    queryKey: driverKeys.authClaims(),
    queryFn: resolveDriverId,
    enabled: apiEnabled,
    staleTime: CACHE_DRIVER_SESSION_MS,
  });

  const driverId = claimsQuery.data ?? null;

  const profileQuery = useQuery({
    queryKey: driverKeys.session(driverId ?? "unresolved"),
    queryFn: async (): Promise<{ driver: DriverProfile; source: DataSource }> => {
      if (mockMode) {
        return { driver: getMockDriverProfile(), source: "mock" };
      }
      if (!apiEnabled) {
        throw new Error("API is not enabled. Set NEXT_PUBLIC_USE_API=true.");
      }
      if (!driverId) {
        throw new Error("Driver profile not linked to account");
      }
      const { driver: apiDriver } = await fetchDriverProfile(driverId);
      return { driver: apiDriverToUiProfile(apiDriver), source: "api" };
    },
    enabled: mockMode || (apiEnabled && claimsQuery.isSuccess && Boolean(driverId)),
    staleTime: CACHE_DRIVER_SESSION_MS,
  });

  useEffect(() => {
    if (!isAuthConfigured()) return;
    return subscribeToAuthState("driver", (user) => {
      if (!user) {
        clearAuthenticatedQueryCache(queryClient);
      }
      void queryClient.invalidateQueries({ queryKey: driverKeys.authClaims() });
      void queryClient.invalidateQueries({ queryKey: driverKeys.sessionRoot });
    });
  }, [queryClient]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: driverKeys.authClaims() });
    await queryClient.invalidateQueries({ queryKey: driverKeys.sessionRoot });
  }, [queryClient]);

  const loading =
    mockMode
      ? false
      : apiEnabled &&
        ((claimsQuery.isPending && !claimsQuery.data) ||
          (Boolean(driverId) && profileQuery.isPending && !profileQuery.data) ||
          (claimsQuery.isSuccess && !driverId));

  const error = useMemo(() => {
    if (mockMode) return null;
    if (!apiEnabled) return "API is not enabled. Set NEXT_PUBLIC_USE_API=true.";
    if (claimsQuery.isSuccess && !driverId) {
      return "Driver profile not linked to account";
    }
    if (claimsQuery.error instanceof Error) return claimsQuery.error.message;
    if (profileQuery.error instanceof Error) return profileQuery.error.message;
    return null;
  }, [mockMode, apiEnabled, claimsQuery, driverId, profileQuery.error]);

  return {
    driver: profileQuery.data?.driver ?? null,
    source: profileQuery.data?.source ?? (mockMode ? "mock" : "api"),
    driverId,
    loading,
    error,
    refreshing: profileQuery.isFetching && !!profileQuery.data,
    refresh,
  };
}
