import * as React from "react";
import { cn } from "@/lib/cn";

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground",
        className
      )}
      {...props}
    />
  );
}
