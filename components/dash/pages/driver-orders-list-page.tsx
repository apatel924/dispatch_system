'use client'

import Link from "next/link";
import { useState } from "react";
import { Package, ChevronRight, Search } from "lucide-react";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import { DriverBottomNav } from "@/components/dash/driver/bottom-nav";
import { useDriverOrders } from "@/lib/dash/hooks/use-driver-orders";

type Tab = "active" | "completed";

export function DriverOrdersList() {
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const { activeOrders, completedOrders, loading } = useDriverOrders();

  const filteredActive = activeOrders.filter((o) =>
    !query || o.id.toLowerCase().includes(query.toLowerCase()) || o.customer.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredCompleted = completedOrders.filter((o) =>
    !query || o.id.toLowerCase().includes(query.toLowerCase()) || o.customer.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md p-4">
        <header>
          <h1 className="text-xl font-bold">Orders</h1>
        </header>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search orders..."
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="mt-4 flex gap-2">
          {(["active", "completed"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {t === "active" ? `Active (${activeOrders.length})` : `Completed (${completedOrders.length})`}
            </button>
          ))}
        </div>

        <div className="mt-4 divide-y divide-border/60 rounded-2xl border border-border bg-card">
          {loading && tab === "active" && activeOrders.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading orders…</div>
          ) : tab === "active" ? (
            filteredActive.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No orders found</div>
            ) : (
              filteredActive.map((o) => (
                <Link key={o.id} href={`/driver-orders/${o.id}`} className="flex items-center gap-3 p-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-purple-soft text-purple">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{o.id}</div>
                    <div className="truncate text-sm">{o.customer}</div>
                  </div>
                  <div className="text-right">
                    <OrderStatusBadge status={o.status} />
                    <div className="mt-1 text-xs font-semibold">{o.eta}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))
            )
          ) : (
            filteredCompleted.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No completed orders</div>
            ) : (
              filteredCompleted.map((o) => (
                <div key={o.id} className="flex items-center gap-3 p-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{o.id}</div>
                    <div className="truncate text-sm">{o.customer}</div>
                  </div>
                  <OrderStatusBadge status="Delivered" />
                  <div className="text-xs text-muted-foreground">{o.eta}</div>
                </div>
              ))
            )
          )}
        </div>
      </div>
      <DriverBottomNav />
    </div>
  );
}
