"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Loader2, Phone, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminDrivers } from "@/lib/dash/hooks/use-admin-drivers";
import { assignDriverApi } from "@/lib/dash/api/client";
import { isApiEnabled } from "@/lib/dash/api/config";
import { isDriverAssignable } from "@/lib/driver-status";
import { invalidateAfterOrderLifecycle } from "@/lib/dash/query/query-keys";
import { DriverStatusBadge } from "@/components/dash/status-badge";
import { DashEmptyState, DashErrorState } from "@/components/dash/ui/query-state";
import { DriverRowSkeleton } from "@/components/dash/ui/skeletons";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function AssignDriverDialog({
  open,
  orderId,
  orderLabel,
  retryFailed = false,
  onClose,
  onAssigned,
}: {
  open: boolean;
  orderId: string;
  orderLabel?: string;
  retryFailed?: boolean;
  onClose: () => void;
  onAssigned?: () => void;
}) {
  const queryClient = useQueryClient();
  const { drivers, loading, error } = useAdminDrivers();
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const apiEnabled = isApiEnabled();

  const assignable = drivers.filter((d) => isDriverAssignable(d.status));
  const selected = assignable.find((d) => d.id === selectedId);

  useEffect(() => {
    if (!open) return;
    setSelectedId("");
    setSubmitError(null);
    setBusy(false);
  }, [open, orderId]);

  const trapFocus = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !panelRef.current) return;
    const nodes = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
    ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('[data-dialog-close="true"]')
        ?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose, busy]);

  const handleConfirm = async () => {
    if (!selectedId || !apiEnabled || busy) return;
    setBusy(true);
    setSubmitError(null);
    try {
      await assignDriverApi(orderId, {
        driverId: selectedId,
        retryFailed: retryFailed || undefined,
      });
      await invalidateAfterOrderLifecycle(queryClient, { orderId });
      onAssigned?.();
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to assign driver",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close assign driver dialog"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        className={cn(
          "relative z-10 flex w-full max-w-lg flex-col bg-card shadow-xl",
          "max-h-[min(92dvh,40rem)] rounded-t-2xl sm:rounded-2xl",
          "border border-border",
          "pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {retryFailed ? "Retry & Assign Driver" : "Assign Driver"}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {orderLabel ?? orderId}
            </p>
          </div>
          <button
            type="button"
            data-dialog-close="true"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {!apiEnabled && (
            <DashErrorState message="Enable the API (NEXT_PUBLIC_USE_API=true) to assign drivers." />
          )}
          {error && <DashErrorState message={error} />}
          {submitError && (
            <div className="mb-3">
              <DashErrorState message={submitError} />
            </div>
          )}

          {loading && assignable.length === 0 ? (
            <div className="space-y-2 py-2">
              <DriverRowSkeleton />
              <DriverRowSkeleton />
              <DriverRowSkeleton />
            </div>
          ) : assignable.length === 0 ? (
            <DashEmptyState message="No available drivers" className="py-8" />
          ) : (
            <ul className="space-y-2" role="listbox" aria-label="Assignable drivers">
              {drivers.map((d) => {
                const canAssign = isDriverAssignable(d.status);
                const selected = d.id === selectedId;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={!canAssign || busy || !apiEnabled}
                      onClick={() => setSelectedId(d.id)}
                      className={cn(
                        "flex w-full min-h-14 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:bg-secondary/40",
                        !canAssign && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <div
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-semibold",
                          d.avatarColor,
                        )}
                      >
                        {d.initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {d.name}
                          </span>
                          <DriverStatusBadge status={d.status} />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {d.phone && d.phone !== "—" && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" aria-hidden />
                              {d.phone}
                            </span>
                          )}
                          {d.vehicle && <span>{d.vehicle}</span>}
                          <span>
                            {d.activeDeliveries} active
                          </span>
                        </div>
                        {!canAssign && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Not assignable ({d.status})
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || !selectedId || !apiEnabled}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Assigning…
              </>
            ) : selected ? (
              `Assign ${selected.name.split(" ")[0]}`
            ) : (
              "Assign Driver"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
