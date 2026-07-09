import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "info",
  delta,
  trend = "up",
  compareLabel = "vs yesterday",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "info" | "success" | "warning" | "purple" | "orange" | "primary";
  delta?: string;
  trend?: "up" | "down";
  compareLabel?: string;
}) {
  const toneMap: Record<string, string> = {
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning-foreground",
    purple: "bg-purple-soft text-purple",
    orange: "bg-orange-soft text-orange",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]">
      <div className={cn("grid h-10 w-10 place-items-center rounded-lg", toneMap[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-xs leading-snug text-muted-foreground">{label}</div>
      {delta && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          {trend === "up" ? (
            <ArrowUp className="h-3.5 w-3.5 text-success" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          )}
          <span className={cn("font-semibold", trend === "up" ? "text-success" : "text-primary")}>{delta}</span>
          <span className="text-muted-foreground">{compareLabel}</span>
        </div>
      )}
    </div>
  );
}