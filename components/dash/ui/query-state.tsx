import { AlertCircle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashLoadingState({
  message = "Loading…",
  className,
}: {
  message?: string;
  className?: string;
}) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{message}</p>;
}

export function DashErrorState({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground",
        className,
      )}
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span>{message}</span>
    </div>
  );
}

export function DashEmptyState({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <Inbox className="h-8 w-8 opacity-50" />
      <span>{message}</span>
    </div>
  );
}
