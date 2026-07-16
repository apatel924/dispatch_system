import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/dash/ui/skeletons";

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "info",
  delta,
  trend = "up",
  compareLabel,
  loading = false,
}: {
  label: string;
  /** Pass null/undefined when value is unknown (shows skeleton). Genuine `0` displays as 0. */
  value: string | number | null | undefined;
  icon: LucideIcon;
  tone?: "info" | "success" | "warning" | "purple" | "orange" | "primary";
  delta?: string;
  trend?: "up" | "down";
  compareLabel?: string;
  loading?: boolean;
}) {
  const toneMap: Record<string, string> = {
    info: "bg-info-soft text-info",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning-foreground",
    purple: "bg-purple-soft text-purple",
    orange: "bg-orange-soft text-orange",
    primary: "bg-primary/10 text-primary",
  };
  const showSkeleton = loading || value === null || value === undefined;

  const showCompare = Boolean(delta || compareLabel);

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_0_rgb(0_0_0/0.03)] sm:p-4"
      aria-busy={showSkeleton || undefined}
    >
      <div className={cn("grid h-9 w-9 place-items-center rounded-lg sm:h-10 sm:w-10", toneMap[tone])}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="mt-2 min-h-[1.5rem] text-xl font-bold tracking-tight text-foreground tabular-nums sm:mt-3 sm:min-h-[1.75rem] sm:text-2xl">
        {showSkeleton ? <Skeleton className="h-6 w-12 sm:h-7 sm:w-14" /> : value}
      </div>
      <div className="mt-1 text-xs leading-snug font-medium text-muted-foreground sm:font-normal">{label}</div>
      {showCompare && !showSkeleton && (
        <div className="mt-2 hidden flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs sm:mt-2.5 sm:flex">
          {delta && (
            <>
              {trend === "up" ? (
                <ArrowUp className="h-3.5 w-3.5 text-success" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5 text-primary" />
              )}
              <span className={cn("font-semibold", trend === "up" ? "text-success" : "text-primary")}>{delta}</span>
            </>
          )}
          {compareLabel && (
            <span className="text-muted-foreground">{compareLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}