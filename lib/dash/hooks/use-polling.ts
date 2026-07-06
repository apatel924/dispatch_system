"use client";

import { useEffect, useRef } from "react";

/** Re-run callback on an interval while enabled; pauses when the tab is hidden. */
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

    const id = window.setInterval(run, intervalMs);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [intervalMs, enabled]);
}
