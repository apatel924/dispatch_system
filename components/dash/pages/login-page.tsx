'use client'

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, Shield, MessageSquare, LogIn, MapPin, Bell, FileCheck, Users, Loader2 } from "lucide-react";
import { Logo } from "@/components/dash/brand/logo";
import { DevDualLoginHint } from "@/components/dash/auth/dev-dual-login-hint";
import { OrderStatusBadge } from "@/components/dash/status-badge";
import {
  AUTH_NOT_CONFIGURED_MESSAGE,
  isAuthConfigured,
  resolvePostLoginRedirect,
  signInWithEmail,
} from "@/lib/auth/firebase-client";


export function LoginPage() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const authConfigured = isAuthConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!authConfigured) {
      setError(AUTH_NOT_CONFIGURED_MESSAGE);
      return;
    }

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
      const { redirectTo, error: redirectError } = await resolvePostLoginRedirect("admin");
      if (redirectError && !redirectTo) {
        setError(redirectError);
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sign in failed. Check your credentials.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-4 md:p-8">
        <div className="grid w-full max-w-6xl gap-6 rounded-2xl md:grid-cols-2">
          {/* Left: sign in */}
          <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
            <div className="mx-auto max-w-sm">
              <div className="flex justify-center"><Logo /></div>
              <h1 className="mt-8 text-center text-3xl font-bold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-center text-sm text-muted-foreground">Sign in to your Quick-Run Express dispatch platform</p>

              <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> For admins, dispatchers, and drivers
              </div>

              {!authConfigured && (
                <p className="mt-4 rounded-lg border border-warning/30 bg-warning-soft/40 px-3 py-2 text-xs text-muted-foreground">
                  {AUTH_NOT_CONFIGURED_MESSAGE}
                </p>
              )}

              <DevDualLoginHint />

              {error && (
                <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email address</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      autoComplete="email"
                      className="h-11 w-full rounded-lg border border-input bg-card pl-10 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="h-11 w-full rounded-lg border border-input bg-card pl-10 pr-10 text-sm outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
                    />
                    <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input type="checkbox" className="h-4 w-4 rounded border-input text-primary focus:ring-primary/30" /> Remember me
                  </label>
                  <a href="#" className="font-medium text-primary hover:underline">Forgot password?</a>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  Sign in
                </button>
                <div className="relative py-1 text-center">
                  <div className="absolute inset-0 top-1/2 h-px bg-border" />
                  <span className="relative bg-card px-3 text-xs text-muted-foreground">or</span>
                </div>
                <button
                  type="button"
                  disabled
                  title="SMS login is reserved for future customer notifications only"
                  className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-input bg-secondary/50 text-sm font-medium text-muted-foreground opacity-60"
                >
                  <MessageSquare className="h-4 w-4" /> SMS login — not available
                </button>
                <Link href="/driver-login" className="block text-center text-xs text-muted-foreground hover:text-primary">Driver app login →</Link>
              </form>
            </div>
          </div>

          {/* Right: brand panel */}
          <div className="hidden rounded-2xl border border-border bg-card p-10 md:block">
            <p className="text-sm font-semibold text-primary">Built for fast, reliable deliveries</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight">Everything you need to<br/>run your deliveries smarter</h2>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">Manage orders, drivers, and customers in real-time from one powerful platform.</p>

            <div className="mt-8 rounded-xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Active Orders</div>
                <button className="rounded-md border border-input bg-card px-2.5 py-1 text-xs font-medium">View All</button>
              </div>
              <div className="mt-3 divide-y divide-border/60 text-sm">
                {[
                  ["QRX-10098", "Acme Manufacturing", "Out for Delivery", "9:12 AM"],
                  ["QRX-10097", "Northside Pharmacy", "Picked Up", "9:03 AM"],
                  ["QRX-10096", "Global Office Supplies", "Assigned", "9:01 AM"],
                  ["QRX-10095", "City Hospital Supply", "New", "8:58 AM"],
                  ["QRX-10094", "Downtown Deli", "Out for Delivery", "8:45 AM"],
                ].map(([id, cust, st, t]) => (
                  <div key={id} className="flex items-center justify-between py-2.5">
                    <div className="w-24 font-mono text-xs text-muted-foreground">{id}</div>
                    <div className="flex-1 truncate px-2">{cust}</div>
                    <OrderStatusBadge status={st as never} />
                    <div className="w-16 text-right text-xs text-muted-foreground">{t}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { icon: MapPin, tone: "bg-success-soft text-success", title: "Order Tracking", desc: "Real-time status and live updates" },
                { icon: Bell, tone: "bg-purple-soft text-purple", title: "Driver Notifications", desc: "Instant alerts and route updates" },
                { icon: FileCheck, tone: "bg-info-soft text-info", title: "Proof of Delivery", desc: "Capture signatures and delivery proof" },
                { icon: Users, tone: "bg-orange-soft text-orange", title: "Customer Updates", desc: "Keep customers informed every step" },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-border bg-card p-4">
                  <div className={`mb-2 grid h-9 w-9 place-items-center rounded-lg ${f.tone}`}><f.icon className="h-4 w-4"/></div>
                  <div className="text-sm font-semibold">{f.title}</div>
                  <div className="text-xs text-muted-foreground">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <footer className="flex items-center justify-center gap-2 pb-6 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" /> Secure, reliable, and built for speed.
        <span className="mx-2">·</span>
        <span>Powered by <span className="font-semibold text-primary">Zeta Web Studios</span></span>
      </footer>
    </div>
  );
}
