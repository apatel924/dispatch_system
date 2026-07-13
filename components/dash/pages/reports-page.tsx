'use client'

import Link from "next/link";
import { Truck, CheckCircle2, XCircle, RotateCcw, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/dash/layout/dashboard-layout";
import { StatCard } from "@/components/dash/ui/stat-card";
import { SectionCard } from "@/components/dash/ui/section-card";
import { TableScroll } from "@/components/dash/ui/table-scroll";
import { DashEmptyState, DashErrorState, DashLoadingState } from "@/components/dash/ui/query-state";
import { useAdminReports } from "@/lib/dash/hooks/use-admin-reports";
import { formatPercentChange } from "@/lib/delivery-metrics";

function formatPeriodLabel(from: string, to: string): string {
  if (!from || !to) return "—";
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T12:00:00.000Z`);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

function comparisonProps(
  value: number | null | undefined,
  compareLabel: string,
): { delta?: string; trend?: "up" | "down"; compareLabel?: string } {
  if (value == null) {
    return { compareLabel: "No comparison data" };
  }
  return {
    delta: formatPercentChange(value),
    trend: value < 0 ? "down" : "up",
    compareLabel,
  };
}

export function ReportsPage() {
  const { reports, loading, error } = useAdminReports();
  const { totals, statusBreakdown, drivers: reportDrivers, trendDays, compareTrendDays, period, comparePeriod, comparisons, dataCoverage } = reports;
  const statusTotal = statusBreakdown.completed + statusBreakdown.failed + statusBreakdown.returned;
  const completionRate = statusTotal > 0
    ? ((statusBreakdown.completed / statusTotal) * 100).toFixed(1)
    : "0";

  const compareLabel = comparePeriod
    ? `vs ${formatPeriodLabel(comparePeriod.from, comparePeriod.to)}`
    : "No comparison data";

  return (
    <DashboardLayout title="Reports">
      {error && (
        <div className="mb-4">
          <DashErrorState message={error} />
        </div>
      )}

      {loading && !error && (
        <div className="mb-4">
          <DashLoadingState message="Loading reports…" />
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
        Reporting period: <span className="font-medium text-foreground">{formatPeriodLabel(period.from, period.to)}</span>
        {comparePeriod && (
          <>
            {" · "}Compared to: <span className="font-medium text-foreground">{formatPeriodLabel(comparePeriod.from, comparePeriod.to)}</span>
          </>
        )}
      </div>

      {dataCoverage && !dataCoverage.complete && dataCoverage.message && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning-soft/40 px-4 py-3 text-sm text-warning-foreground">
          {dataCoverage.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total Deliveries"
          value={totals.deliveries}
          icon={Truck}
          tone="info"
          {...comparisonProps(comparisons?.deliveries, compareLabel)}
        />
        <StatCard
          label="Completed Deliveries"
          value={totals.completed}
          icon={CheckCircle2}
          tone="success"
          {...comparisonProps(comparisons?.completed, compareLabel)}
        />
        <StatCard
          label="Failed Deliveries"
          value={totals.failed}
          icon={XCircle}
          tone="primary"
          {...comparisonProps(comparisons?.failed, compareLabel)}
        />
        <StatCard
          label="Returned Deliveries"
          value={totals.returned}
          icon={RotateCcw}
          tone="purple"
          {...comparisonProps(comparisons?.returned, compareLabel)}
        />
        <StatCard
          label="Average Delivery Time"
          value={totals.avgDeliveryTime}
          icon={Clock}
          tone="warning"
          {...comparisonProps(comparisons?.avgDeliveryTimeMs, compareLabel)}
        />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <SectionCard title="Deliveries Over Time">
          {trendDays.length === 0 ? (
            <DashEmptyState message="No deliveries in this period" className="py-8" />
          ) : (
            <>
              <TrendChart days={trendDays} compareDays={compareTrendDays} />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Deliveries: {totals.deliveries}</span>
                <span className="text-muted-foreground">
                  {comparisons?.deliveries != null
                    ? `${formatPercentChange(comparisons.deliveries)} ${compareLabel}`
                    : "No comparison data"}
                </span>
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Delivery Status Breakdown">
          {statusTotal === 0 ? (
            <DashEmptyState message="No terminal deliveries in this period" className="py-8" />
          ) : (
            <>
              <div className="flex items-center gap-4">
                <MiniDonut segments={[
                  { value: statusBreakdown.completed, color: "var(--success)" },
                  { value: statusBreakdown.failed, color: "var(--primary)" },
                  { value: statusBreakdown.returned, color: "var(--purple)" },
                ]} total={statusTotal} label="Total" />
                <div className="flex-1 space-y-2 text-sm">
                  <Legend color="bg-success" label="Completed" v={`${statusBreakdown.completed} (${statusTotal ? ((statusBreakdown.completed / statusTotal) * 100).toFixed(1) : 0}%)`} />
                  <Legend color="bg-primary" label="Failed" v={`${statusBreakdown.failed} (${statusTotal ? ((statusBreakdown.failed / statusTotal) * 100).toFixed(1) : 0}%)`} />
                  <Legend color="bg-purple" label="Returned" v={`${statusBreakdown.returned} (${statusTotal ? ((statusBreakdown.returned / statusTotal) * 100).toFixed(1) : 0}%)`} />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Completion Rate: <span className="font-semibold text-success">{completionRate}%</span>
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard title="Driver Performance">
          {reportDrivers.length === 0 ? (
            <DashEmptyState message="No driver deliveries in this period" className="py-8" />
          ) : (
            <div className="space-y-2.5">
              {reportDrivers.slice(0, 8).map((d) => (
                <div key={d.id} className="flex items-center gap-2">
                  <div className={`grid h-7 w-7 place-items-center rounded-full ${d.avatarColor} text-[10px] font-semibold`}>{d.initials}</div>
                  <div className="w-24 truncate text-xs">{d.name}</div>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-secondary">
                    <div className="h-full rounded bg-primary" style={{ width: `${Math.min(100, (d.deliveries / Math.max(1, reportDrivers[0]?.deliveries ?? 1)) * 100)}%` }} />
                  </div>
                  <div className="w-6 text-right text-xs font-semibold">{d.deliveries}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Top Drivers by Deliveries" padded={false}>
          {reportDrivers.length === 0 ? (
            <DashEmptyState message="No driver deliveries in this period" />
          ) : (
            <>
              <TableScroll>
              <table className="w-full text-sm">
                <thead className="bg-secondary/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Driver</th>
                    <th className="px-2 py-2 font-medium">Deliveries</th>
                    <th className="px-2 py-2 font-medium">Completed</th>
                    <th className="px-2 py-2 font-medium">Failed</th>
                    <th className="px-4 py-2 font-medium">Success Rate</th>
                    <th className="px-4 py-2 font-medium">Avg Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {reportDrivers.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2">
                        <Link href={`/drivers/${d.id}`} className="flex items-center gap-2 hover:text-primary">
                          <div className={`grid h-7 w-7 place-items-center rounded-full ${d.avatarColor} text-[10px] font-semibold`}>{d.initials}</div>
                          {d.name}
                        </Link>
                      </td>
                      <td className="px-2 py-2">{d.deliveries}</td>
                      <td className="px-2 py-2">{d.completed}</td>
                      <td className="px-2 py-2">{d.failed}</td>
                      <td className="px-4 py-2 text-success">{d.successRate != null ? `${d.successRate}%` : "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{d.avgDeliveryTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </TableScroll>
            </>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 text-xs text-muted-foreground">
        Reports are based on orders created within the selected period. Average delivery time uses assigned-to-delivered duration when both timestamps exist.
      </div>
    </DashboardLayout>
  );
}

function Legend({ color, label, v }: { color: string; label: string; v: string }) {
  return <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} /><span className="flex-1">{label}</span><span className="text-xs text-muted-foreground">{v}</span></div>;
}

function MiniDonut({ segments, total, label }: { segments: { value: number; color: string }[]; total: string | number; label: string }) {
  const size = 120, stroke = 16, r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const sum = segments.reduce((a, b) => a + b.value, 0) || 1;
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

function TrendChart({
  days,
  compareDays,
}: {
  days: { label: string; deliveries: number; completed: number; failed: number }[];
  compareDays: { label: string; deliveries: number }[] | null;
}) {
  const w = 400, h = 160, pad = 28;
  const cur = days.map((d) => d.deliveries);
  const prev = compareDays?.map((d) => d.deliveries) ?? [];
  const labels = days.map((d) => d.label);
  const max = Math.max(...cur, ...prev, 1);
  const toPath = (arr: number[]) => arr.map((v,i) => { const x = pad + (i*(w-pad*2))/Math.max(arr.length-1, 1); const y = h-pad - (v/max)*(h-pad*2); return `${i===0?"M":"L"} ${x} ${y}`;}).join(" ");
  return (
    <div>
      {compareDays && compareDays.length > 0 && (
        <div className="mb-2 flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" />This Period</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t border-dashed border-muted-foreground" />Compare Period</span>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {[0,1,2,3,4].map(i => <line key={i} x1={pad} x2={w-pad} y1={pad+i*((h-pad*2)/4)} y2={pad+i*((h-pad*2)/4)} stroke="var(--border)" strokeDasharray="3 3" />)}
        {prev.length > 0 && <path d={toPath(prev)} fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray="4 4" />}
        <path d={toPath(cur)} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
        {cur.map((v,i) => { const x = pad + (i*(w-pad*2))/Math.max(cur.length-1, 1); const y = h-pad - (v/max)*(h-pad*2); return <circle key={i} cx={x} cy={y} r="3" fill="var(--primary)" />; })}
        {labels.map((d, i) => { const x = pad + (i*(w-pad*2))/Math.max(labels.length-1, 1); return <text key={i} x={x} y={h-6} fontSize="9" textAnchor="middle" fill="var(--muted-foreground)">{d}</text>; })}
      </svg>
    </div>
  );
}
