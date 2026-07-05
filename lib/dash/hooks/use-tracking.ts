"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrackingView } from "@/lib/types/backend";
import type { DataSource } from "@/lib/dash/api/config";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  fetchTracking,
  getDemoTrackingView,
  isDemoTrackingCode,
} from "@/lib/dash/api/tracking-client";

export function useTracking(trackingId: string) {
  const [tracking, setTracking] = useState<TrackingView | null>(null);
  const [source, setSource] = useState<DataSource>("mock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const normalized = trackingId.trim();
    if (!normalized) {
      setTracking(null);
      setNotFound(true);
      setError(null);
      return;
    }

    if (isDemoTrackingCode(normalized)) {
      setTracking(getDemoTrackingView());
      setSource("mock");
      setNotFound(false);
      setError(null);
      return;
    }

    if (!isApiEnabled()) {
      setTracking(null);
      setSource("mock");
      setNotFound(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const { tracking: apiTracking } = await fetchTracking(normalized);
      setTracking(apiTracking);
      setSource("api");
    } catch (err) {
      setTracking(null);
      setSource("mock");
      setNotFound(true);
      setError(err instanceof Error ? err.message : "Tracking not found");
    } finally {
      setLoading(false);
    }
  }, [trackingId]);

  useEffect(() => {
    load();
  }, [load]);

  return { tracking, source, loading, error, notFound, refresh: load };
}
