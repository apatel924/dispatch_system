"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dash/brand/logo";
import { ADMIN_NAV, isAdminNavActive } from "@/components/dash/layout/admin-nav";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function AdminNavDrawer({
  open,
  onClose,
  onSignOut,
  signingOut,
}: {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

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
      const closeBtn = panelRef.current?.querySelector<HTMLElement>(
        '[data-drawer-close="true"]',
      );
      closeBtn?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close navigation"
        onClick={onClose}
      />
      <div
        id="admin-mobile-nav"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={trapFocus}
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(100%,20rem)] max-w-full flex-col",
          "border-r border-sidebar-border bg-sidebar shadow-xl",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-sidebar-border px-4 pt-4 pb-4">
          <div className="min-w-0">
            <p id={titleId} className="sr-only">
              Admin navigation
            </p>
            <Logo />
          </div>
          <button
            type="button"
            data-drawer-close="true"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-secondary"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin">
          {ADMIN_NAV.map((item) => {
            const active = isAdminNavActive(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                href={item.to}
                onClick={onClose}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {active && (
                  <span
                    className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary"
                    aria-hidden
                  />
                )}
                <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-3 flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-sm font-semibold">
              AU
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-foreground">
                Admin User
              </div>
              <div className="truncate text-xs text-muted-foreground">
                Administrator
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-secondary disabled:opacity-60"
          >
            <LogOut className="h-5 w-5" />
            <span>{signingOut ? "Signing out…" : "Log out"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
