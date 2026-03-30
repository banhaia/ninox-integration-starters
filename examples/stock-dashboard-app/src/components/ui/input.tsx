import * as React from "react";
import { cn } from "@/lib/cn";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-white/80 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  );
}
