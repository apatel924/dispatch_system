'use client'

import { useCallback, useEffect, useRef, useState } from "react";
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

const TERMINAL_STATUSES = new Set(["Delivered", "Failed", "Returned"]);

interface OrderActionsMenuProps {
  order: AdminOrderRow;
  onStatusChanged?: () => void;
  align?: "left" | "right";
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
  align = "right",
}: OrderActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const apiEnabled = isApiEnabled();
  const isActive = !TERMINAL_STATUSES.has(order.status);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

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
      close();
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
        close();
        router.push(`/orders/${order.id}`);
      },
    },
    {
      key: "assign",
      label: order.driver ? "Reassign Driver" : "Assign Driver",
      icon: Users,
      onClick: () => {
        close();
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
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-label={`Actions for order ${order.id}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded p-1 text-muted-foreground hover:bg-secondary"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-card py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action) => {
            const Icon = action.icon;
            const isLoading = busy === action.key;
            return (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                disabled={action.disabled || Boolean(busy)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-50",
                  action.destructive
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground",
                )}
                onClick={() => void action.onClick()}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4 shrink-0" />
                )}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
