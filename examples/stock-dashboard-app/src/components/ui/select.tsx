import * as React from "react";
import { cn } from "@/lib/cn";

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-white/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
