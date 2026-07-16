import {
  LayoutDashboard,
  ClipboardList,
  Radio,
  PlusCircle,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/live-intake", label: "Live Intake", icon: Radio },
  { to: "/create-order", label: "Create Order", icon: PlusCircle },
  { to: "/drivers", label: "Drivers", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function isAdminNavActive(pathname: string, to: string): boolean {
  return pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
}
