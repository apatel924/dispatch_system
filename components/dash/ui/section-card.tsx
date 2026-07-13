import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  icon,
  action,
  description,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card shadow-[0_1px_2px_0_rgb(0_0_0/0.03)]", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && <span className="text-primary">{icon}</span>}
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{action}</div>}
        </header>
      )}
      <div className={cn(padded ? "p-5" : "")}>{children}</div>
    </section>
  );
}