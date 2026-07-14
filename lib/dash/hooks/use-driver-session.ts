"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
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

export function useDriverSession() {
  const [driver, setDriver] = useState<DriverProfile>(getMockDriverProfile);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isApiEnabled()) {
      setDriver(getMockDriverProfile());
      setSource("mock");
      setError(null);
      return;
    }

    if (!isAuthConfigured()) {
      setDriver(getMockDriverProfile());
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const claims = await getDriverAuthClaims();
      const driverId = claims?.driverId;

      if (!driverId) {
        setError("Driver profile not linked to account");
        return;
      }

      const { driver: apiDriver } = await fetchDriverProfile(driverId);
      setDriver(apiDriverToUiProfile(apiDriver));
      setSource("api");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load driver profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!isAuthConfigured()) return;
    return subscribeToAuthState("driver", () => {
      load();
    });
  }, [load]);

  return { driver, source, loading, error, refresh: load };
}
