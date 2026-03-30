import * as React from "react";
import { cn } from "@/lib/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-primary text-primary-foreground shadow-soft hover:translate-y-[-1px] hover:bg-primary/90",
        variant === "secondary" && "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        variant === "ghost" && "bg-transparent text-foreground hover:bg-white/60",
        className
      )}
      {...props}
    />
  );
}
