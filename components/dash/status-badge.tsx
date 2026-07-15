import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentStatus, DriverStatus, ProofReviewStatus } from "@/lib/types/backend";

const orderStyles: Record<OrderStatus, string> = {
  New: "bg-info-soft text-info",
  Assigned: "bg-purple-soft text-purple",
  "Picked Up": "bg-orange-soft text-orange",
  "Out for Delivery": "bg-orange-soft text-orange",
  Delivered: "bg-success-soft text-success",
  Failed: "bg-primary/10 text-primary",
  Returned: "bg-muted text-muted-foreground",
  Scheduled: "bg-muted text-muted-foreground",
};

const paymentStyles: Record<PaymentStatus, string> = {
  Paid: "bg-success-soft text-success",
  Pending: "bg-warning-soft text-warning-foreground",
  Unpaid: "bg-primary/10 text-primary",
};

const driverStyles: Record<DriverStatus, string> = {
  Available: "bg-success-soft text-success",
  Busy: "bg-warning-soft text-warning-foreground",
  Inactive: "bg-muted text-muted-foreground",
  Suspended: "bg-primary/10 text-primary",
};

const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function OrderStatusBadge({
  status,
  unrecognizedStatusRaw,
  className,
}: {
  status: OrderStatus;
  unrecognizedStatusRaw?: string | null;
  className?: string;
}) {
  if (unrecognizedStatusRaw) {
    return (
      <span
        className={cn(base, "bg-warning-soft text-warning-foreground", className)}
        title="Unrecognized status — needs review"
      >
        Needs Review
      </span>
    );
  }
  return <span className={cn(base, orderStyles[status], className)}>{status}</span>;
}
export function PaymentBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return <span className={cn(base, paymentStyles[status], className)}>{status}</span>;
}
export function DriverStatusBadge({ status, className }: { status: DriverStatus; className?: string }) {
  return <span className={cn(base, driverStyles[status], className)}>{status}</span>;
}

const proofReviewStyles: Record<ProofReviewStatus, string> = {
  pending: "bg-warning-soft text-warning-foreground",
  approved: "bg-success-soft text-success",
  rejected: "bg-primary/10 text-primary",
};

export function ProofReviewBadge({
  status,
  className,
}: {
  status: ProofReviewStatus;
  className?: string;
}) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={cn(base, proofReviewStyles[status], className)}>{label}</span>;
}