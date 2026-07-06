'use client'

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Lock, LogIn, MessageSquare, ShieldCheck, Loader2 } from "lucide-react";
import { Logo } from "@/components/dash/brand/logo";
import {
  isAuthConfigured,
  resolvePostLoginRedirect,
  signInWithEmail,
} from "@/lib/auth/firebase-client";


export function DriverLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const authConfigured = isAuthConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!authConfigured) {
      router.push("/driver-dashboard");
      return;
    }

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
      const { redirectTo, error: redirectError } = await resolvePostLoginRedirect("driver");
      if (redirectError) {
        if (redirectTo) {
          setInfo(redirectError);
          router.push(redirectTo);
          return;
        }
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
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex justify-center"><Logo /></div>
          <h1 className="mt-6 text-center text-2xl font-bold">Driver Sign In</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">Sign in to start your route</p>

          {!authConfigured && (
            <p className="mt-4 rounded-lg border border-warning/30 bg-warning-soft/40 px-3 py-2 text-xs text-muted-foreground">
              Firebase is not configured — demo mode uses direct navigation without sign-in.
            </p>
          )}

          {error && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {info && (
            <p className="mt-4 rounded-lg border border-info/30 bg-info-soft/40 px-3 py-2 text-sm text-info">
              {info}
            </p>
          )}

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
                  placeholder="driver@qre.com"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10"
                  placeholder="Enter your password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              Sign in
            </button>
            <button
              type="button"
              disabled
              title="SMS login is not used for drivers"
              className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-input bg-secondary/50 text-base font-medium text-muted-foreground opacity-60"
            >
              <MessageSquare className="h-5 w-5" /> SMS login — not available
            </button>
          </form>
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>Authorized drivers only. All activity is logged and monitored. Contact dispatch if you need access.</span>
          </div>
          <Link href="/" className="mt-4 block text-center text-xs text-muted-foreground hover:text-primary">
            Admin / dispatcher login →
          </Link>
        </div>
        <div className="mt-6 text-center text-xs text-muted-foreground">Powered by <span className="font-semibold text-primary">Zeta Web Studios</span></div>
      </div>
    </div>
  );
}
