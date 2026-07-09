"use client";

import { useEffect, useRef } from "react";

/**
 * Re-run callback on an interval while enabled.
 * Pauses when the document tab is hidden.
 */
export function usePolling(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled: boolean,
): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let active = true;

    const run = () => {
      if (!active || document.hidden) return;
      void savedCallback.current();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) run();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const id = window.setInterval(run, intervalMs);

    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, enabled]);
}
