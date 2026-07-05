'use client'

import { MessageCircle } from "lucide-react";
import { DriverBottomNav } from "@/components/dash/driver/bottom-nav";
import { driverMessages } from "@/lib/dash/driver-mock-data";

export function DriverMessagesPage() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md p-4">
        <header>
          <h1 className="text-xl font-bold">Messages</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dispatch & support</p>
        </header>

        <div className="mt-4 divide-y divide-border/60 rounded-2xl border border-border bg-card">
          {driverMessages.map((m) => (
            <button key={m.id} className="flex w-full items-start gap-3 p-4 text-left hover:bg-secondary/50">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${m.unread ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm ${m.unread ? "font-bold" : "font-semibold"}`}>{m.from}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{m.time}</span>
                </div>
                <p className={`mt-0.5 truncate text-sm ${m.unread ? "text-foreground" : "text-muted-foreground"}`}>{m.preview}</p>
              </div>
              {m.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </div>
      <DriverBottomNav />
    </div>
  );
}
