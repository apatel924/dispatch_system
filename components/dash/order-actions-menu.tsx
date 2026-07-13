'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Eye,
  Users,
  CheckCircle2,
  XCircle,
  Copy,
  Loader2,
} from "lucide-react";
import type { AdminOrderRow } from "@/lib/dash/api/adapters";
import { isApiEnabled } from "@/lib/dash/api/config";
import { updateOrderStatusApi } from "@/lib/dash/api/client";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/dash/ui/dropdown-menu";

const TERMINAL_STATUSES = new Set(["Delivered", "Failed", "Returned"]);

export type OrderActionsOrder = Pick<AdminOrderRow, "id" | "status" | "driver">;

interface OrderActionsMenuProps {
  order: OrderActionsOrder;
  onStatusChanged?: () => void;
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

export function OrderActionsMenu({
  order,
  onStatusChanged,
  align = "end",
  triggerClassName,
}: OrderActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const apiEnabled = isApiEnabled();
  const isActive = !TERMINAL_STATUSES.has(order.status);

  const runStatusUpdate = async (
    actionKey: string,
    status: "Delivered" | "Failed" | "Returned",
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
        status,
        note: `Status updated to ${status} by admin`,
      });
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
      label: "View Details",
      icon: Eye,
      onClick: () => {
        setOpen(false);
        router.push(`/orders/${order.id}`);
      },
    },
    {
      key: "assign",
      label: order.driver ? "Reassign Driver" : "Assign Driver",
      icon: Users,
      onClick: () => {
        setOpen(false);
        router.push(`/orders/${order.id}?action=assign`);
      },
      disabled: !isActive,
    },
  ];

  if (isActive) {
    actions.push(
      {
        key: "delivered",
        label: "Mark as Delivered",
        icon: CheckCircle2,
        onClick: () =>
          runStatusUpdate(
            "delivered",
            "Delivered",
            `Mark order ${order.id} as delivered?`,
          ),
        disabled: !apiEnabled,
      },
      {
        key: "failed",
        label: "Mark as Failed",
        icon: XCircle,
        onClick: () =>
          runStatusUpdate(
            "failed",
            "Failed",
            `Mark order ${order.id} as failed? This cannot be undone easily.`,
          ),
        destructive: true,
        disabled: !apiEnabled,
      },
    );
  }

  if (order.status === "Failed") {
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
