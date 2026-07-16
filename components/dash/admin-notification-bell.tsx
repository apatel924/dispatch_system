"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { isApiEnabled } from "@/lib/dash/api/config";
import {
  fetchAdminNotifications,
  markAdminNotificationReadApi,
  markAllAdminNotificationsReadApi,
} from "@/lib/dash/api/client";

interface AdminNotificationRow {
  id: string;
  title: string;
  message: string;
  read: boolean;
  link?: string | null;
  createdAt: string;
}

const POLL_MS = 45_000;

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isApiEnabled()) return;
    try {
      const result = await fetchAdminNotifications({ limit: 20 });
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch {
      // Keep last known count — do not blank the bell on transient errors.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refresh();
    }, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const onOpen = async () => {
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      await refresh();
      setLoading(false);
    }
  };

  const onClickNotification = async (n: AdminNotificationRow) => {
    if (!n.read) {
      try {
        await markAdminNotificationReadApi(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((rows) =>
          rows.map((row) => (row.id === n.id ? { ...row, read: true } : row)),
        );
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
  };

  const onMarkAll = async () => {
    try {
      await markAllAdminNotificationsReadApi();
      setUnreadCount(0);
      setNotifications((rows) => rows.map((row) => ({ ...row, read: true })));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void onOpen()}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void onMarkAll()}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div
                    className={`border-b border-border/60 px-3 py-2.5 text-left hover:bg-secondary/40 ${
                      n.read ? "opacity-70" : ""
                    }`}
                  >
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                  </div>
                );
                if (n.link) {
                  return (
                    <Link
                      key={n.id}
                      href={n.link}
                      onClick={() => void onClickNotification(n)}
                    >
                      {content}
                    </Link>
                  );
                }
                return (
                  <button
                    key={n.id}
                    type="button"
                    className="block w-full"
                    onClick={() => void onClickNotification(n)}
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
