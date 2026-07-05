"use client";

import { useCallback, useEffect, useState } from "react";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  driverToAdminRow,
  getMockAdminDrivers,
  mockDriverToAdminRow,
  type AdminDriverRow,
} from "@/lib/dash/api/adapters";
import { fetchDriverDetail, fetchDriversList } from "@/lib/dash/api/client";
import { drivers as mockDrivers } from "@/lib/dash/mock-data";

export function useAdminDrivers(options?: { limit?: number }) {
  const [drivers, setDrivers] = useState<AdminDriverRow[]>(getMockAdminDrivers);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const applyLimit = (rows: AdminDriverRow[]) =>
      options?.limit ? rows.slice(0, options.limit) : rows;

    if (!isApiEnabled()) {
      setDrivers(applyLimit(getMockAdminDrivers()));
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchDriversList({ limit: options?.limit ?? 50 });
      setDrivers(result.drivers.map(driverToAdminRow));
      setSource("api");
    } catch (err) {
      setDrivers(applyLimit(getMockAdminDrivers()));
      setSource("mock");
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, [options?.limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { drivers, source, loading, error, refresh: load };
}

export function useAdminDriver(driverId: string) {
  const [driver, setDriver] = useState<AdminDriverRow | null>(() => {
    const d = mockDrivers.find((x) => x.id === driverId);
    return d ? mockDriverToAdminRow(d) : mockDriverToAdminRow(mockDrivers[0]);
  });
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const mockFallback = () => {
      const d = mockDrivers.find((x) => x.id === driverId);
      return d ? mockDriverToAdminRow(d) : null;
    };

    if (!isApiEnabled()) {
      setDriver(mockFallback());
      setSource("mock");
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { driver: apiDriver } = await fetchDriverDetail(driverId);
      setDriver(driverToAdminRow(apiDriver));
      setSource("api");
    } catch (err) {
      setDriver(mockFallback());
      setSource("mock");
      setError(err instanceof Error ? err.message : "Failed to load driver");
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
  }, [load]);

  return { driver, source, loading, error, refresh: load };
}
