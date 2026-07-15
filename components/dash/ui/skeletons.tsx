"use client";

import { cn } from "@/lib/utils";

/** Accessible pulse skeleton — aria-busy without chatty live regions. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-secondary/80", className)}
      {...props}
    />
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]",
        className,
      )}
      aria-busy="true"
      aria-label="Loading statistic"
    >
      <Skeleton className="h-10 w-10 rounded-lg" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}

export function TableRowSkeleton({
  columns = 6,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <tr className={className} aria-hidden="true">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton className="h-4 w-full max-w-[8rem]" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Skeleton table rows only — callers must own a single <tbody>.
 * Returning another <tbody> nests invalid HTML and causes hydration errors.
 */
export function OrdersTableSkeletonRows({
  rows = 6,
  columns = 7,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </>
  );
}

/** @deprecated Prefer OrdersTableSkeletonRows inside an owning tbody. */
export function OrdersTableSkeleton(props: {
  rows?: number;
  columns?: number;
}) {
  return <OrdersTableSkeletonRows {...props} />;
}

export function DriverRowSkeleton() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
      aria-busy="true"
      aria-label="Loading driver"
    >
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-16 rounded-md" />
    </div>
  );
}

export function RecentAssignmentSkeleton() {
  return (
    <div className="flex gap-3 py-3" aria-busy="true" aria-label="Loading activity">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4 max-w-[14rem]" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

export function OrderDetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading order">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function DriverAssignmentSkeleton() {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 space-y-3"
      aria-busy="true"
      aria-label="Loading assignment"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-56" />
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    </div>
  );
}
