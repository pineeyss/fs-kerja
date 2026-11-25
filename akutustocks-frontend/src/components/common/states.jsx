import { Inbox, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import Button from "@/components/ui/Button";

export function LoadingState({ label = "Memuat data…" }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-ink-muted">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Empty state menjelaskan cara memulai (design.md bagian 9). */
export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <Inbox className="size-8 text-ink-muted" aria-hidden="true" />
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Data tidak dapat dimuat", message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <TriangleAlert className="size-8 text-danger" aria-hidden="true" />
      <p className="font-semibold text-ink">{title}</p>
      {message && <p className="max-w-sm text-sm text-ink-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-2" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Coba lagi
        </Button>
      )}
    </div>
  );
}
