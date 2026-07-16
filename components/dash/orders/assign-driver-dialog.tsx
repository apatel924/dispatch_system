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
import { normalizeNorthAmericanPhone } from "@/lib/server/notifications/phone";
import { DriverStatusBadge } from "@/components/dash/status-badge";
import { DashEmptyState, DashErrorState } from "@/components/dash/ui/query-state";
import { DriverRowSkeleton } from "@/components/dash/ui/skeletons";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function newOperationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `assign_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export type AssignDriverSuccessInfo = {
  driverName: string;
  notificationRequested: boolean;
  notificationSent: boolean;
};

export function AssignDriverDialog({
  open,
  orderId,
  orderLabel,
  currentDriverId = null,
  currentDriverName = null,
  retryFailed = false,
  onClose,
  onAssigned,
}: {
  open: boolean;
  orderId: string;
  orderLabel?: string;
  currentDriverId?: string | null;
  currentDriverName?: string | null;
  retryFailed?: boolean;
  onClose: () => void;
  onAssigned?: (info: AssignDriverSuccessInfo) => void;
}) {
  const queryClient = useQueryClient();
  const { drivers, loading, error } = useAdminDrivers();
  const [selectedId, setSelectedId] = useState("");
  const [notifyDriver, setNotifyDriver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const operationIdRef = useRef<string>(newOperationId());
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const smsId = useId();
  const apiEnabled = isApiEnabled();

  const isReassign = Boolean(currentDriverId);
  const selected = drivers.find((d) => d.id === selectedId);
  const selectedFirstName = selected?.name.split(" ")[0] ?? "driver";
  const selectedHasPhone = selected
    ? normalizeNorthAmericanPhone(
        selected.phone && selected.phone !== "—" ? selected.phone : null,
      ).ok
    : false;
  const changingDriver =
    Boolean(selectedId) &&
    Boolean(currentDriverId) &&
    selectedId !== currentDriverId;

  useEffect(() => {
    if (!open) return;
    setSelectedId("");
    setSubmitError(null);
    setSuccessMessage(null);
    setBusy(false);
    operationIdRef.current = newOperationId();
    // First assign → unchecked; reassign to a *different* driver → checked (set when selection changes)
    setNotifyDriver(false);
  }, [open, orderId, currentDriverId]);

  useEffect(() => {
    if (!open || !selectedId) return;
    if (!selectedHasPhone) {
      setNotifyDriver(false);
      return;
    }
    // Reassignment to a different driver defaults SMS on; same driver / first assign stays off unless user toggles.
    setNotifyDriver(changingDriver);
  }, [open, selectedId, selectedHasPhone, changingDriver]);

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
    if (!selectedId || !apiEnabled || busy || successMessage) return;
    setBusy(true);
    setSubmitError(null);
    const operationId = operationIdRef.current;
    const driverName = selected?.name ?? "driver";
    const firstName = driverName.split(" ")[0] ?? driverName;
    const wantNotify = notifyDriver && selectedHasPhone;

    try {
      const result = await assignDriverApi(orderId, {
        driverId: selectedId,
        retryFailed: retryFailed || undefined,
        notifyDriver: wantNotify || undefined,
        assignmentOperationId: operationId,
      });

      await invalidateAfterOrderLifecycle(queryClient, {
        orderId,
        driverId: selectedId,
        previousDriverId: result.assignment?.previousDriverId ?? currentDriverId,
      });

      const notificationRequested = Boolean(result.notification?.requested);
      const notificationSent = Boolean(result.notification?.sent);

      let message = `Order assigned to ${firstName}.`;
      if (notificationRequested && notificationSent) {
        message = `Order assigned to ${firstName} and notification sent.`;
      } else if (notificationRequested && !notificationSent) {
        message = `Order assigned to ${firstName}, but the text message could not be sent.`;
      }

      setSuccessMessage(message);
      onAssigned?.({
        driverName,
        notificationRequested,
        notificationSent,
      });

      window.setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to assign driver",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const heading = retryFailed
    ? "Retry & Assign Driver"
    : isReassign
      ? "Reassign Driver"
      : "Assign Driver";

  const confirmLabel = busy
    ? isReassign
      ? "Reassigning…"
      : "Assigning…"
    : selected
      ? isReassign
        ? `Reassign to ${selectedFirstName}`
        : `Assign Order`
      : isReassign
        ? "Reassign Order"
        : "Assign Order";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close assign driver dialog"
        disabled={busy}
        onClick={() => {
          if (!busy && !successMessage) onClose();
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
              {heading}
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {orderLabel ?? orderId}
            </p>
            {isReassign && currentDriverName && (
              <p className="mt-1 text-xs text-muted-foreground">
                Currently assigned to{" "}
                <span className="font-medium text-foreground">{currentDriverName}</span>
              </p>
            )}
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
          {successMessage && (
            <div
              role="status"
              className="mb-3 rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm text-success"
            >
              {successMessage}
            </div>
          )}

          {loading && drivers.length === 0 ? (
            <div className="space-y-2 py-2">
              <DriverRowSkeleton />
              <DriverRowSkeleton />
              <DriverRowSkeleton />
            </div>
          ) : drivers.length === 0 ? (
            <DashEmptyState message="No drivers found" className="py-8" />
          ) : (
            <ul className="space-y-2" role="listbox" aria-label="Assignable drivers">
              {drivers.map((d) => {
                const canAssign = isDriverAssignable(d.status);
                const isSelected = d.id === selectedId;
                const isCurrent = d.id === currentDriverId;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={!canAssign || busy || !apiEnabled || Boolean(successMessage)}
                      onClick={() => setSelectedId(d.id)}
                      className={cn(
                        "flex w-full min-h-14 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                        isSelected
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
                          {isCurrent && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {d.phone && d.phone !== "—" && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" aria-hidden />
                              {d.phone}
                            </span>
                          )}
                          {d.vehicle && <span>{d.vehicle}</span>}
                          <span>{d.activeDeliveries} active</span>
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

        <div className="shrink-0 space-y-3 border-t border-border px-4 py-3 sm:px-5">
          <div className="space-y-1">
            <label
              htmlFor={smsId}
              className={cn(
                "flex min-h-11 items-start gap-3 rounded-lg border border-border px-3 py-2.5 text-sm",
                (!selectedId || !selectedHasPhone || busy || successMessage) &&
                  "opacity-60",
              )}
            >
              <input
                id={smsId}
                type="checkbox"
                checked={notifyDriver && selectedHasPhone}
                disabled={
                  !selectedId || !selectedHasPhone || busy || Boolean(successMessage)
                }
                onChange={(e) => setNotifyDriver(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span className="min-w-0">
                <span className="font-medium text-foreground">
                  {selected
                    ? `Text ${selectedFirstName} about this assignment`
                    : "Text driver about this assignment"}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Optional. Sent only after the assignment succeeds.
                </span>
                {selectedId && !selectedHasPhone && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    No mobile number is available for this driver.
                  </span>
                )}
              </span>
            </label>
          </div>

          <div className="flex gap-2">
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
              disabled={
                busy ||
                !selectedId ||
                !apiEnabled ||
                Boolean(successMessage) ||
                (isReassign && selectedId === currentDriverId && !retryFailed)
              }
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {confirmLabel}
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
