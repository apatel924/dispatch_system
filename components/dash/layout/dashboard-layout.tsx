'use client'

import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signOutAdmin } from "@/lib/auth/firebase-client";
import { clearAuthenticatedQueryCache } from "@/lib/dash/query/query-keys";
import {
    LogOut,
    Menu,
    Search,
    ChevronDown,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dash/brand/logo";
import { AdminNotificationBell } from "@/components/dash/admin-notification-bell";
import { AdminNavDrawer } from "@/components/dash/layout/admin-nav-drawer";
import { ADMIN_NAV, isAdminNavActive } from "@/components/dash/layout/admin-nav";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/dash/ui/tooltip";

export function DashboardLayout({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      clearAuthenticatedQueryCache(queryClient);
      await signOutAdmin();
      router.push("/");
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex min-h-dvh bg-background">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out md:flex",
            collapsed ? "w-[76px]" : "w-[240px]",
          )}
        >
          <div className={cn("flex items-start border-b border-sidebar-border pt-4 pb-4", collapsed ? "justify-center px-2" : "px-5")}>
            <Logo collapsed={collapsed} />
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {ADMIN_NAV.map((item) => {
              const active = isAdminNavActive(pathname, item.to);
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.to}
                  href={item.to}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-primary"
                      : "text-sidebar-foreground hover:bg-secondary hover:text-foreground",
                    collapsed && "justify-center px-2",
                  )}
                >
                  {active && <span className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-primary" aria-hidden />}
                  <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border p-3">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    disabled={signingOut}
                    className="flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-sm text-sidebar-foreground hover:bg-secondary disabled:opacity-60"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{signingOut ? "Signing out…" : "Log out"}</TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-secondary disabled:opacity-60"
              >
                <LogOut className="h-5 w-5" />
                <span>{signingOut ? "Signing out…" : "Log out"}</span>
              </button>
            )}
          </div>
        </aside>

        <AdminNavDrawer
          open={mobileNavOpen}
          onClose={closeMobileNav}
          onSignOut={() => void handleSignOut()}
          signingOut={signingOut}
        />

        <div
          className={cn(
            "flex min-h-dvh min-w-0 w-full flex-1 flex-col transition-[padding] duration-300",
            collapsed ? "md:pl-[76px]" : "md:pl-[240px]",
          )}
        >
          <header
            className={cn(
              "sticky top-0 z-20 flex shrink-0 flex-col border-b border-border bg-card",
              "pt-[env(safe-area-inset-top)]",
            )}
          >
            <div className="flex h-14 items-center gap-2 px-4 md:h-[72px] md:gap-3 md:px-8">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
                aria-label="Open navigation menu"
                aria-expanded={mobileNavOpen}
                aria-controls="admin-mobile-nav"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground md:inline-flex"
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight md:text-2xl">
                {title}
              </h1>
              <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-4">
                <div className="relative hidden lg:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    placeholder="Search orders, drivers, customers…"
                    className="h-10 w-[360px] rounded-full border border-border bg-secondary/50 pl-10 pr-14 text-sm outline-none focus:border-primary/40 focus:bg-card focus:ring-3 focus:ring-primary/10"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</span>
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
                  aria-label={mobileSearchOpen ? "Close search" : "Open search"}
                  aria-expanded={mobileSearchOpen}
                  onClick={() => setMobileSearchOpen((v) => !v)}
                >
                  {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                </button>
                <AdminNotificationBell />
                <div className="flex items-center gap-2 rounded-full pl-1 pr-1 hover:bg-secondary sm:pr-2">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold">AU</div>
                  <div className="hidden text-right leading-tight sm:block">
                    <div className="text-sm font-semibold">Admin User</div>
                    <div className="text-xs text-muted-foreground">Administrator</div>
                  </div>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </div>
              </div>
            </div>
            {mobileSearchOpen && (
              <div className="border-t border-border px-4 py-3 lg:hidden">
                <label htmlFor="admin-mobile-global-search" className="sr-only">
                  Search orders, drivers, customers
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="admin-mobile-global-search"
                    type="search"
                    autoFocus
                    placeholder="Search orders, drivers, customers…"
                    className="h-11 w-full rounded-lg border border-border bg-secondary/50 pl-10 pr-3 text-sm outline-none focus:border-primary/40 focus:bg-card focus:ring-3 focus:ring-primary/10"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tip: use the search field on the Orders page for live results.
                </p>
              </div>
            )}
          </header>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 px-4 pt-4 md:px-8">{actions}</div>
          )}

          <main className="min-w-0 flex-1 px-4 py-4 md:px-8 md:py-8">
            <div className="mx-auto w-full min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
