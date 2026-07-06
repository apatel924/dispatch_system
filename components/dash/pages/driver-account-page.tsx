'use client'

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Phone, Mail, Truck, LogOut, ChevronRight, Bell } from "lucide-react";
import { DriverBottomNav } from "@/components/dash/driver/bottom-nav";
import { useDriverSession } from "@/lib/dash/hooks/use-driver-session";
import { signOutUser } from "@/lib/auth/firebase-client";

export function DriverAccountPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const { driver, loading } = useDriverSession();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutUser();
      router.push("/driver-login");
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-md p-4">
        <header>
          <h1 className="text-xl font-bold">Account</h1>
        </header>

        {loading && !driver ? (
          <div className="mt-8 text-center text-sm text-muted-foreground">Loading profile…</div>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <div className={`grid h-16 w-16 place-items-center rounded-full text-xl font-bold ${driver.avatarColor}`}>
                {driver.initials}
              </div>
              <div>
                <div className="text-lg font-bold">{driver.name}</div>
                <div className="text-sm text-muted-foreground">Driver · {driver.id}</div>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-2xl border border-border bg-card divide-y divide-border/60">
              <InfoRow icon={Phone} label="Phone" value={driver.phone} />
              <InfoRow icon={Mail} label="Email" value={driver.email} />
              <InfoRow icon={Truck} label="Vehicle" value={driver.vehicle} />
            </div>
          </>
        )}

        <div className="mt-4 rounded-2xl border border-border bg-card">
          <button
            onClick={() => setNotifications(!notifications)}
            className="flex w-full items-center gap-3 p-4"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-left text-sm font-medium">Push Notifications</span>
            <span className={`inline-block h-6 w-11 rounded-full transition-colors ${notifications ? "bg-success" : "bg-secondary"}`}>
              <span className={`mt-0.5 block h-5 w-5 rounded-full bg-white transition-transform ${notifications ? "translate-x-5" : "translate-x-0.5"}`} />
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" /> {signingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>
      <DriverBottomNav />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
