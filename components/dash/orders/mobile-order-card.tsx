"use client";

import { useRouter } from "next/navigation";
import { Phone, UserPlus, AlertTriangle } from "lucide-react";
import type { AdminOrderRow } from "@/lib/dash/api/adapters";
import {
  tryNormalizeOrderStatus,
  type CanonicalOrderStatus,
} from "@/lib/order-status";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { OrderActionsMenu } from "@/components/dash/order-actions-menu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/dash/ui/skeletons";

function primaryAssignLabel(
  status: CanonicalOrderStatus | null,
  hasDriver: boolean,
): string | null {
  if (!status) return null;
  if (status === "Failed") return "Retry & Assign";
  if (status === "New" || status === "Scheduled") return "Assign Driver";
  if ((status === "Assigned" || status === "Picked Up" || status === "Out for Delivery") && !hasDriver) {
    return "Assign Driver";
  }
  if (status === "Assigned" || status === "Picked Up" || status === "Out for Delivery") {
    return null; // reassign stays in overflow
  }
  return null;
}

export function MobileOrderCard({
  order,
  onStatusChanged,
  onAssign,
  className,
}: {
  order: AdminOrderRow;
  onStatusChanged?: () => void;
  onAssign?: (orderId: string, options?: { retryFailed?: boolean }) => void;
  className?: string;
}) {
  const router = useRouter();
  const needsReview = Boolean(order.unrecognizedStatusRaw);
  const status = needsReview ? null : tryNormalizeOrderStatus(order.status);
  const hasDriver = Boolean(order.driver);
  const assignLabel = primaryAssignLabel(status, hasDriver);
  const isIssue =
    status === "Failed" || status === "Returned" || needsReview;
  const phoneHref =
    order.phone && order.phone !== "—"
      ? `tel:${order.phone.replace(/[^\d+]/g, "")}`
      : null;

  const openDetail = () => {
    router.push(`/orders/${order.id}`);
  };

  const handleAssign = (e: React.MouseEvent) => {
    e.stopPropagation();
    const retryFailed = status === "Failed";
    if (onAssign) {
      onAssign(order.id, { retryFailed });
      return;
    }
    const qs = retryFailed ? "?action=assign&retryFailed=1" : "?action=assign";
    router.push(`/orders/${order.id}${qs}`);
  };

  return (
    <article
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]",
        "transition-colors active:bg-secondary/40",
        isIssue && "border-l-4 border-l-primary",
        className,
      )}
    >
      <div
        role="link"
        tabIndex={0}
        aria-label={`Open order ${order.id}`}
        className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
        onClick={openDetail}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDetail();
          }
        }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-foreground">
                {order.id}
              </span>
              <OrderStatusBadge
                status={order.status}
                unrecognizedStatusRaw={order.unrecognizedStatusRaw}
              />
              {isIssue && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {needsReview ? "Needs review" : status}
                </span>
              )}
            </div>
            {order.external && order.external !== "—" && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                Ext {order.external}
              </p>
            )}
            <p className="mt-2 truncate text-base font-semibold text-foreground">
              {order.customer}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.driver ?? "Unassigned"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Updated {order.updated}
              {order.created ? ` · Created ${order.created}` : ""}
            </p>
          </div>

          <div
            className="flex shrink-0 flex-col items-end gap-1"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <OrderActionsMenu
              order={order}
              onStatusChanged={onStatusChanged}
              onAssign={onAssign}
              triggerClassName="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
        {phoneHref && (
          <a
            href={phoneHref}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"
            aria-label={`Call ${order.customer}`}
          >
            <Phone className="h-4 w-4" />
            Call
          </a>
        )}
        {assignLabel ? (
          <button
            type="button"
            onClick={handleAssign}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <UserPlus className="h-4 w-4" />
            {assignLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={openDetail}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-input bg-card px-3 py-2 text-sm font-semibold hover:bg-secondary"
          >
            View Details
          </button>
        )}
      </div>
    </article>
  );
}

export function MobileOrderCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-border bg-card p-4"
      aria-busy="true"
      aria-label="Loading order"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-11 w-11 rounded-lg" />
      </div>
      <div className="mt-3 flex gap-2 border-t border-border/60 pt-3">
        <Skeleton className="h-11 w-20 rounded-lg" />
        <Skeleton className="h-11 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
