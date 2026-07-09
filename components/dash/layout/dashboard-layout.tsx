'use client'

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutUser } from "@/lib/auth/firebase-client";
import {
  LayoutDashboard,
  ClipboardList,
  Radio,
  PlusCircle,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Search,
  Bell,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/dash/brand/logo";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/dash/ui/tooltip";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/live-intake", label: "Live Intake", icon: Radio },
  { to: "/create-order", label: "Create Order", icon: PlusCircle },
  { to: "/drivers", label: "Drivers", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardLayout({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutUser();
      router.push("/");
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex min-h-screen bg-background">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-in-out md:flex",
            collapsed ? "w-[76px]" : "w-[240px]",
          )}
        >
          <div className={cn("flex items-start border-b border-sidebar-border pt-4 pb-4", collapsed ? "justify-center px-2" : "px-5")}>
            <Logo collapsed={collapsed} />
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {nav.map((item) => {
              const active = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
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
                    onClick={handleSignOut}
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
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-secondary disabled:opacity-60"
              >
                <LogOut className="h-5 w-5" />
                <span>{signingOut ? "Signing out…" : "Log out"}</span>
              </button>
            )}
          </div>
        </aside>

        <div className={cn("flex min-h-screen w-full flex-col transition-[padding] duration-300", collapsed ? "md:pl-[76px]" : "md:pl-[240px]")}>
          <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border bg-card px-4 md:px-6">
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="hidden rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:inline-flex"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
            <div className="ml-auto flex items-center gap-2 md:gap-4">
              <div className="relative hidden lg:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search orders, drivers, customers…"
                  className="h-10 w-[360px] rounded-full border border-border bg-secondary/50 pl-10 pr-14 text-sm outline-none focus:border-primary/40 focus:bg-card focus:ring-3 focus:ring-primary/10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</span>
              </div>
              <button className="relative rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">8</span>
              </button>
              <div className="flex items-center gap-2 rounded-full pl-1 pr-2 hover:bg-secondary">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold">AU</div>
                <div className="hidden text-right leading-tight sm:block">
                  <div className="text-sm font-semibold">Admin User</div>
                  <div className="text-xs text-muted-foreground">Administrator</div>
                </div>
                <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
              </div>
            </div>
          </header>

          {actions && (
            <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-4 md:px-8">{actions}</div>
          )}

          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}