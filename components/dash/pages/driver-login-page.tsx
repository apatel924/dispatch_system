'use client'

import Link from "next/link";

import { Mail, Lock, LogIn, MessageSquare, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/dash/brand/logo";


export function DriverLogin() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex justify-center"><Logo /></div>
          <h1 className="mt-6 text-center text-2xl font-bold">Driver Sign In</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">Sign in to start your route</p>
          <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email or Phone</label>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10" placeholder="driver@qre.com" /></div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <div className="relative"><Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="password" className="h-12 w-full rounded-xl border border-input bg-card pl-10 pr-3 text-base outline-none focus:border-primary/50 focus:ring-3 focus:ring-primary/10" placeholder="Enter your password" /></div>
            </div>
            <Link href="/driver-dashboard" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"><LogIn className="h-5 w-5" /> Sign in</Link>
            <button type="button" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-input bg-card text-base font-medium hover:bg-secondary"><MessageSquare className="h-5 w-5 text-primary" /> Use SMS code</button>
          </form>
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/40 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>Authorized drivers only. All activity is logged and monitored. Contact dispatch if you need access.</span>
          </div>
        </div>
        <div className="mt-6 text-center text-xs text-muted-foreground">Powered by <span className="font-semibold text-primary">Zeta Web Studios</span></div>
      </div>
    </div>
  );
}