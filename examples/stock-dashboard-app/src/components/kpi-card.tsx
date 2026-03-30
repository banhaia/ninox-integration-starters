import { ArrowDownUp, Box, Palette, Ruler } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const iconMap = {
  products: Box,
  stock: ArrowDownUp,
  colors: Palette,
  sizes: Ruler
} as const;

interface KpiCardProps {
  tone?: "default" | "accent";
  icon: keyof typeof iconMap;
  label: string;
  value: string;
  hint: string;
}

export function KpiCard({
  tone = "default",
  icon,
  label,
  value,
  hint
}: KpiCardProps): JSX.Element {
  const Icon = iconMap[icon];

  return (
    <Card
      className={cn(
        "overflow-hidden",
        tone === "accent" && "bg-primary text-primary-foreground",
        tone === "default" && "bg-white/85"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={cn("text-sm", tone === "accent" ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{value}</p>
          <p className={cn("mt-2 text-sm", tone === "accent" ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {hint}
          </p>
        </div>
        <div
          className={cn(
            "rounded-2xl p-3",
            tone === "accent" ? "bg-white/15 text-white" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
