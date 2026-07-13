import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal scroll wrapper for wide tables. Menus inside tables should use a
 * portaled dropdown so they are not clipped by this overflow container.
 */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full min-w-0 overflow-x-auto", className)}>{children}</div>;
}
