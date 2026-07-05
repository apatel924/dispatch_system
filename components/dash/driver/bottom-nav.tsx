'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Route as RouteIcon, MessageCircle, User } from "lucide-react";

const tabs = [
  { icon: Home, label: "Home", href: "/driver-dashboard" },
  { icon: FileText, label: "Orders", href: "/driver-orders" },
  { icon: RouteIcon, label: "Route", href: "/driver-route" },
  { icon: MessageCircle, label: "Messages", href: "/driver-messages", badge: 3 },
  { icon: User, label: "Account", href: "/driver-account" },
];

export function DriverBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((t) => {
          const active = pathname === t.href || (t.href !== "/driver-dashboard" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.label}
              href={t.href}
              className={`relative flex flex-col items-center gap-1 py-3 text-[11px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              <div className="relative">
                <t.icon className="h-5 w-5" />
                {t.badge && (
                  <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {t.badge}
                  </span>
                )}
              </div>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
