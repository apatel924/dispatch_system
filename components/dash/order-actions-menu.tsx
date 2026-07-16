'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  MoreVertical,
  Eye,
  Users,
  CheckCircle2,
  XCircle,
  Copy,
  Loader2,
  RotateCcw,
  Truck,
  Package,
} from "lucide-react";
import type { AdminOrderRow } from "@/lib/dash/api/adapters";
import { isApiEnabled } from "@/lib/dash/api/config";
import { updateOrderStatusApi } from "@/lib/dash/api/client";
import {
  isPostPickupStatus,
  isTerminalOrderStatus,
  tryNormalizeOrderStatus,
  type CanonicalOrderStatus,
} from "@/lib/order-status";
import { invalidateAfterOrderLifecycle } from "@/lib/dash/query/query-keys";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/dash/ui/dropdown-menu";

export type OrderActionsOrder = Pick<
  AdminOrderRow,
  "id" | "status" | "driver" | "unrecognizedStatusRaw"
>;

interface OrderActionsMenuProps {
  order: OrderActionsOrder;
  onStatusChanged?: () => void;
  /** When provided, assign/reassign uses this instead of navigating to ?action=assign. */
  onAssign?: (orderId: string, options?: { retryFailed?: boolean }) => void;
  align?: "start" | "end";
  triggerClassName?: string;
}

interface MenuAction {
  key: string;
  label: string;
  icon: typeof Eye;
  onClick: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
}

function contextualActionsForStatus(
  status: CanonicalOrderStatus | null,
  hasDriver: boolean,
): {
  showAssign: boolean;
  assignLabel: string;
  showMarkDelivered: boolean;
  showMarkFailed: boolean;
  showMarkReturned: boolean;
  showRetryAssign: boolean;
  showBeginDelivery: boolean;
  showMarkPickedUp: boolean;
  showReturnToNew: boolean;
  viewLabel: string;
  readonly: boolean;
} {
  if (!status || isTerminalOrderStatus(status)) {
    if (status === "Failed") {
      return {
        showAssign: false,
        assignLabel: "Assign Driver",
        showMarkDelivered: false,
        showMarkFailed: false,
        showMarkReturned: true,
        showRetryAssign: true,
        showBeginDelivery: false,
        showMarkPickedUp: false,
        showReturnToNew: false,
        viewLabel: "View Details",
        readonly: false,
      };
    }
    return {
      showAssign: false,
      assignLabel: "Assign Driver",
      showMarkDelivered: false,
      showMarkFailed: false,
      showMarkReturned: false,
      showRetryAssign: false,
      showBeginDelivery: false,
      showMarkPickedUp: false,
      showReturnToNew: false,
      viewLabel: "View Details",
      readonly: true,
    };
  }

  switch (status) {
    case "New":
      return {
        showAssign: true,
        assignLabel: "Assign Driver",
        showMarkDelivered: false,
        showMarkFailed: true,
        showMarkReturned: false,
        showRetryAssign: false,
        showBeginDelivery: false,
        showMarkPickedUp: false,
        showReturnToNew: false,
        viewLabel: "View Details",
        readonly: false,
      };
    case "Scheduled":
      return {
        showAssign: true,
        assignLabel: "Assign Driver",
        showMarkDelivered: false,
        showMarkFailed: true,
        showMarkReturned: false,
        showRetryAssign: false,
        showBeginDelivery: false,
        showMarkPickedUp: false,
        showReturnToNew: true,
        viewLabel: "View Details",
        readonly: false,
      };
    case "Assigned":
      return {
        showAssign: true,
        assignLabel: hasDriver ? "Reassign Driver" : "Assign Driver",
        showMarkDelivered: false,
        showMarkFailed: true,
        showMarkReturned: false,
        showRetryAssign: false,
        showBeginDelivery: false,
        showMarkPickedUp: true,
        showReturnToNew: false,
        viewLabel: "View Details",
        readonly: false,
      };
    case "Picked Up":
      return {
        showAssign: true,
        assignLabel: "Reassign Driver",
        showMarkDelivered: false,
        showMarkFailed: true,
        showMarkReturned: false,
        showRetryAssign: false,
        showBeginDelivery: true,
        showMarkPickedUp: false,
        showReturnToNew: false,
        viewLabel: "View Details",
        readonly: false,
      };
    case "Out for Delivery":
      return {
        showAssign: true,
        assignLabel: "Reassign Driver",
        showMarkDelivered: true,
        showMarkFailed: true,
        showMarkReturned: false,
        showRetryAssign: false,
        showBeginDelivery: false,
        showMarkPickedUp: false,
        showReturnToNew: false,
        viewLabel: "View Delivery",
        readonly: false,
      };
    default:
      return {
        showAssign: false,
        assignLabel: "Assign Driver",
        showMarkDelivered: false,
        showMarkFailed: false,
        showMarkReturned: false,
        showRetryAssign: false,
        showBeginDelivery: false,
        showMarkPickedUp: false,
        showReturnToNew: false,
        viewLabel: "View Details",
        readonly: true,
      };
  }
}

export function OrderActionsMenu({
  order,
  onStatusChanged,
  onAssign,
  align = "end",
  triggerClassName,
}: OrderActionsMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const apiEnabled = isApiEnabled();
  const needsReview = Boolean(order.unrecognizedStatusRaw);
  const status = needsReview ? null : tryNormalizeOrderStatus(order.status);
  const hasDriver = Boolean(order.driver);
  const ctx = contextualActionsForStatus(status, hasDriver);

  const runStatusUpdate = async (
    actionKey: string,
    nextStatus: "Delivered" | "Failed" | "Returned" | "Out for Delivery" | "Picked Up" | "New",
    confirmMessage: string,
  ) => {
    if (!apiEnabled) {
      window.alert("Enable the API (NEXT_PUBLIC_USE_API=true) to update order status.");
      return;
    }
    if (!window.confirm(confirmMessage)) return;

    setBusy(actionKey);
    try {
      await updateOrderStatusApi(order.id, {
        status: nextStatus,
        note: `Status updated to ${nextStatus} by admin`,
        ...(nextStatus === "Out for Delivery" ? { stepKey: "outForDelivery" as const } : {}),
        ...(nextStatus === "Picked Up" ? { stepKey: "pickedUp" as const } : {}),
      });
      await invalidateAfterOrderLifecycle(queryClient, { orderId: order.id });
      onStatusChanged?.();
      setOpen(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to update order status");
    } finally {
      setBusy(null);
    }
  };

  const actions: MenuAction[] = [
    {
      key: "view",
      label: ctx.viewLabel,
      icon: Eye,
      onClick: () => {
        setOpen(false);
        router.push(`/orders/${order.id}`);
      },
    },
  ];

  if (ctx.showAssign) {
    actions.push({
      key: "assign",
      label: ctx.assignLabel,
      icon: Users,
      onClick: () => {
        setOpen(false);
        if (onAssign) {
          onAssign(order.id);
          return;
        }
        router.push(`/orders/${order.id}?action=assign`);
      },
    });
  }

  if (ctx.showRetryAssign) {
    actions.push({
      key: "retry",
      label: "Retry and Assign",
      icon: RotateCcw,
      onClick: () => {
        setOpen(false);
        if (onAssign) {
          onAssign(order.id, { retryFailed: true });
          return;
        }
        router.push(`/orders/${order.id}?action=assign&retryFailed=1`);
      },
    });
  }

  if (ctx.showReturnToNew) {
    actions.push({
      key: "return-new",
      label: "Return to New",
      icon: RotateCcw,
      onClick: () =>
        runStatusUpdate(
          "return-new",
          "New",
          `Return order ${order.id} to New?`,
        ),
      disabled: !apiEnabled,
    });
  }

  if (ctx.showMarkPickedUp) {
    actions.push({
      key: "picked-up",
      label: "Mark Picked Up",
      icon: Package,
      onClick: () =>
        runStatusUpdate(
          "picked-up",
          "Picked Up",
          `Mark order ${order.id} as Picked Up?`,
        ),
      disabled: !apiEnabled,
    });
  }

  if (ctx.showBeginDelivery) {
    actions.push({
      key: "begin",
      label: "Begin Delivery",
      icon: Truck,
      onClick: () =>
        runStatusUpdate(
          "begin",
          "Out for Delivery",
          `Mark order ${order.id} as Out for Delivery?`,
        ),
      disabled: !apiEnabled,
    });
  }

  if (ctx.showMarkDelivered) {
    actions.push({
      key: "delivered",
      label: "Mark as Delivered",
      icon: CheckCircle2,
      onClick: () =>
        runStatusUpdate(
          "delivered",
          "Delivered",
          `Mark order ${order.id} as delivered? Required proofs must be on file.`,
        ),
      disabled: !apiEnabled,
    });
  }

  if (ctx.showMarkFailed) {
    actions.push({
      key: "failed",
      label: "Mark as Failed",
      icon: XCircle,
      onClick: () =>
        runStatusUpdate(
          "failed",
          "Failed",
          `Mark order ${order.id} as failed?`,
        ),
      destructive: true,
      disabled: !apiEnabled,
    });
  }

  if (ctx.showMarkReturned) {
    actions.push({
      key: "returned",
      label: "Mark as Returned",
      icon: XCircle,
      onClick: () =>
        runStatusUpdate(
          "returned",
          "Returned",
          `Mark order ${order.id} as returned?`,
        ),
      disabled: !apiEnabled,
    });
  }

  actions.push({
    key: "copy",
    label: copied ? "Copied!" : "Copy Order ID",
    icon: Copy,
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(order.id);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        window.alert("Could not copy to clipboard");
      }
    },
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for order ${order.id}`}
          className={cn(
            "rounded p-1 text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            triggerClassName,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        className="min-w-[180px]"
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          const isLoading = busy === action.key;
          return (
            <DropdownMenuItem
              key={action.key}
              disabled={action.disabled || Boolean(busy)}
              className={cn(
                action.destructive && "text-destructive focus:bg-destructive/10 focus:text-destructive",
              )}
              onSelect={(event) => {
                event.preventDefault();
                void action.onClick();
              }}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Exported for tests — keep assign-path helpers discoverable. */
export const __orderActionsTest = {
  isPostPickupStatus,
  contextualActionsForStatus,
};
