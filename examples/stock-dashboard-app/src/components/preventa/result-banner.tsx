import { CheckCircle, X, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

interface ResultBannerProps {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}

export function ResultBanner({ type, message, onDismiss }: ResultBannerProps): JSX.Element {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
        type === "success"
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      {type === "success" ? (
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      )}
      <span className="flex-1 whitespace-pre-wrap">{message}</span>
      <button
        onClick={onDismiss}
        className="ml-auto shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
        aria-label="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
