'use client'

import { Truck, CheckCircle2, XCircle, RotateCcw, DollarSign, FileText, AlertCircle, Clock, Filter, Download, Calendar, ChevronDown } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { StatCard } from "@/components/dash/ui/stat-card";
import { SectionCard } from "@/components/dash/ui/section-card";
import { drivers } from "@/lib/dash/mock-data";


export function ReportsPage() {
  return (
    <DashboardLayout title="Reports">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Deliveries" value={248} icon={Truck} tone="info" delta="18%" compareLabel="vs May 3 – May 9" />
        <StatCard label="Completed Deliveries" value={208} icon={CheckCircle2} tone="success" delta="22%" compareLabel="vs May 3 – May 9" />
        <StatCard label="Failed Deliveries" value={18} icon={XCircle} tone="primary" delta="14%" trend="down" compareLabel="vs May 3 – May 9" />
        <StatCard label="Returned Orders" value={22} icon={RotateCcw} tone="purple" delta="6%" compareLabel="vs May 3 – May 9" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Order Value" value="$24,890.50" icon={DollarSign} tone="warning" delta="12%" compareLabel="vs May 3 – May 9" />
        <StatCard label="Total Delivery Fees" value="$3,210.00" icon={FileText} tone="orange" delta="9%" compareLabel="vs May 3 – May 9" />
        <StatCard label="Unpaid Orders" value={16} icon={AlertCircle} tone="primary" delta="20%" trend="down" compareLabel="vs May 3 – May 9" />
        <StatCard label="Average Delivery Time" value="28m 35s" icon={Clock} tone="info" delta="6%" trend="down" compareLabel="vs May 3 – May 9" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        {[
          ["Date Range", "May 10 – May 16, 2024", Calendar],
          ["Compare To", "May 3 – May 9, 2024"],
          ["Driver", "All Drivers"],
          ["Status", "All Statuses"],
        ].map(([l, v, Icon]) => (
          <button key={l as string} className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            <div className="text-left leading-tight"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l as string}</div><div className="text-xs font-medium">{v as string}</div></div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm"><Filter className="h-4 w-4" /> More Filters</button>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-2 text-sm"><Download className="h-4 w-4" /> Export <ChevronDown className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Deliveries Over Time">
          <TrendChart />
          <div className="mt-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">Total Deliveries: 248</span><span className="font-semibold text-success">↑ 18% vs May 3 – May 9</span></div>
        </SectionCard>
        <SectionCard title="Delivery Status Breakdown">
          <div className="flex items-center gap-4">
            <MiniDonut segments={[
              { value: 208, color: "var(--success)" },
              { value: 18, color: "var(--primary)" },
              { value: 22, color: "var(--purple)" },
            ]} total={248} label="Total" />
            <div className="flex-1 space-y-2 text-sm">
              <Legend color="bg-success" label="Completed" v="208 (83.9%)" />
              <Legend color="bg-primary" label="Failed" v="18 (7.3%)" />
              <Legend color="bg-purple" label="Returned" v="22 (8.8%)" />
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Completion Rate: <span className="font-semibold text-success">83.9%</span> · ↑ 22% vs prev</div>
        </SectionCard>
        <SectionCard title="Driver Performance">
          <div className="space-y-2.5">
            {drivers.filter(d => d.deliveries).slice(0,5).map(d => (
              <div key={d.id} className="flex items-center gap-2">
                <div className={`grid h-7 w-7 place-items-center rounded-full ${d.avatarColor} text-[10px] font-semibold`}>{d.initials}</div>
                <div className="w-20 truncate text-xs">{d.name}</div>
                <div className="relative h-4 flex-1 overflow-hidden rounded bg-secondary">
                  <div className="h-full rounded bg-primary" style={{ width: `${(d.deliveries!/50)*100}%` }} />
                </div>
                <div className="w-6 text-right text-xs font-semibold">{d.deliveries}</div>
              </div>
            ))}
          </div>
          <a className="mt-3 block text-center text-xs font-semibold text-primary hover:underline" href="#">View All Driver Performance</a>
        </SectionCard>
        <SectionCard title="Payment Status Breakdown">
          <div className="flex items-center gap-4">
            <MiniDonut segments={[
              { value: 78.3, color: "var(--success)" },
              { value: 12.9, color: "var(--warning)" },
              { value: 8.8, color: "var(--primary)" },
            ]} total="$24,890" label="Total Value" />
            <div className="flex-1 space-y-2 text-sm">
              <Legend color="bg-success" label="Paid" v="$19,500.50 (78.3%)" />
              <Legend color="bg-warning" label="Pending" v="$3,210.00 (12.9%)" />
              <Legend color="bg-primary" label="Unpaid" v="$2,180.00 (8.8%)" />
            </div>
          </div>
          <a className="mt-3 block text-center text-xs font-semibold text-primary hover:underline" href="#">View Payment Details</a>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Top Drivers by Deliveries" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Driver</th><th className="px-2 py-2 font-medium">Deliveries</th><th className="px-4 py-2 font-medium">Success Rate</th></tr></thead>
            <tbody className="divide-y divide-border/60">
              {drivers.filter(d=>d.deliveries).slice(0,5).map(d => (
                <tr key={d.id}><td className="px-4 py-2"><div className="flex items-center gap-2"><div className={`grid h-7 w-7 place-items-center rounded-full ${d.avatarColor} text-[10px] font-semibold`}>{d.initials}</div>{d.name}</div></td><td className="px-2 py-2">{d.deliveries}</td><td className="px-4 py-2 text-success">{d.successRate}%</td></tr>
              ))}
            </tbody>
          </table>
          <div className="p-3"><a className="block text-center text-xs font-semibold text-primary hover:underline" href="#">View Full Driver Report</a></div>
        </SectionCard>
        <SectionCard title="Busiest Zones" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Zone</th><th className="px-2 py-2 font-medium">Deliveries</th><th className="px-4 py-2 font-medium">% of Total</th></tr></thead>
            <tbody className="divide-y divide-border/60">
              {[["Northside",68,"27.4%"],["Downtown",54,"21.8%"],["West End",42,"16.9%"],["Oak Cliff",30,"12.1%"],["East Dallas",26,"10.5%"]].map((r) => (
                <tr key={r[0] as string}><td className="px-4 py-2">{r[0]}</td><td className="px-2 py-2">{r[1]}</td><td className="px-4 py-2 text-muted-foreground">{r[2]}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="p-3"><a className="block text-center text-xs font-semibold text-primary hover:underline" href="#">View Zone Report</a></div>
        </SectionCard>
        <SectionCard title="Failed Delivery Reasons" padded={false}>
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2 font-medium">Reason</th><th className="px-2 py-2 font-medium">Orders</th><th className="px-4 py-2 font-medium">% of Failed</th></tr></thead>
            <tbody className="divide-y divide-border/60">
              {[["Customer Not Available",7,"38.9%"],["Wrong Address",4,"22.2%"],["Customer Refused",3,"16.7%"],["Unreachable Phone",2,"11.1%"],["Other",2,"11.1%"]].map(r => (
                <tr key={r[0] as string}><td className="px-4 py-2">{r[0]}</td><td className="px-2 py-2">{r[1]}</td><td className="px-4 py-2 text-muted-foreground">{r[2]}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="p-3"><a className="block text-center text-xs font-semibold text-primary hover:underline" href="#">View Failure Analysis</a></div>
        </SectionCard>
        <SectionCard title="Recent Trends">
          <div className="space-y-3 text-sm">
            {[
              ["Deliveries", 248, "18%", "up", "var(--success)"],
              ["Completed", 208, "22%", "up", "var(--success)"],
              ["Failed", 18, "14%", "down", "var(--primary)"],
              ["Returned", 22, "6%", "up", "var(--purple)"],
              ["Avg. Delivery Time", "28m 35s", "6%", "down", "var(--info)"],
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1 truncate">{r[0]}</div>
                <div className="w-16 text-right font-semibold">{r[1]}</div>
                <div className={`w-12 text-right text-xs font-semibold ${r[3]==="up"?"text-success":"text-primary"}`}>{r[3]==="up"?"↑":"↓"} {r[2]}</div>
                <svg width="60" height="20" className="shrink-0"><polyline fill="none" stroke={r[4] as string} strokeWidth="1.5" points="0,15 10,10 20,12 30,7 40,9 50,4 60,6" /></svg>
              </div>
            ))}
          </div>
          <a className="mt-3 block text-center text-xs font-semibold text-primary hover:underline" href="#">View Trend Analysis</a>
        </SectionCard>
      </div>

      <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
        <span>All reports are based on the selected date range (May 10 – May 16, 2024) unless otherwise specified.</span>
        <span>Data updated: May 16, 2025 11:32 AM</span>
      </div>
    </DashboardLayout>
  );
}

function Legend({ color, label, v }: { color: string; label: string; v: string }) {
  return <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /><span className="flex-1">{label}</span><span className="text-xs text-muted-foreground">{v}</span></div>;
}
function MiniDonut({ segments, total, label }: { segments: { value: number; color: string }[]; total: string | number; label: string }) {
  const size = 120, stroke = 16, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const sum = segments.reduce((a, b) => a + b.value, 0);
  let off = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((s, i) => { const len = (s.value/sum)*C; const el = <circle key={i} r={r} cx={size/2} cy={size/2} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-off} />; off += len; return el; })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center"><div><div className="text-sm font-bold">{total}</div><div className="text-[10px] text-muted-foreground">{label}</div></div></div>
    </div>
  );
}
function TrendChart() {
  const w = 400, h = 160, pad = 28;
  const cur = [42, 55, 62, 78, 82, 68, 52];
  const prev = [38, 45, 50, 60, 55, 48, 40];
  const days = ["May 10","May 11","May 12","May 13","May 14","May 15","May 16"];
  const max = 100;
  const toPath = (arr: number[]) => arr.map((v,i) => { const x = pad + (i*(w-pad*2))/(arr.length-1); const y = h-pad - (v/max)*(h-pad*2); return `${i===0?"M":"L"} ${x} ${y}`;}).join(" ");
  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" />This Period</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-muted-foreground" />Compare Period</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {[0,1,2,3,4].map(i => <line key={i} x1={pad} x2={w-pad} y1={pad+i*((h-pad*2)/4)} y2={pad+i*((h-pad*2)/4)} stroke="var(--border)" strokeDasharray="3 3" />)}
        <path d={toPath(prev)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d={toPath(cur)} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
        {cur.map((v,i) => { const x = pad + (i*(w-pad*2))/(cur.length-1); const y = h-pad - (v/max)*(h-pad*2); return <circle key={i} cx={x} cy={y} r="3" fill="var(--primary)" />; })}
        {days.map((d, i) => { const x = pad + (i*(w-pad*2))/(days.length-1); return <text key={i} x={x} y={h-6} fontSize="9" textAnchor="middle" fill="var(--muted-foreground)">{d}</text>; })}
      </svg>
    </div>
  );
}