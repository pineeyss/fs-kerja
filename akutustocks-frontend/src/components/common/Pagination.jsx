import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Pagination({ page, pageCount, onChange, summary }) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-2 pt-4 text-[13px] text-ink-muted">
      <p>{summary}</p>
      <nav aria-label="Halaman" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
          className="grid size-9 place-items-center rounded-lg hover:bg-canvas disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "grid size-9 place-items-center rounded-lg text-sm font-semibold",
              p === page ? "bg-primary text-white" : "text-primary hover:bg-canvas"
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Halaman berikutnya"
          className="grid size-9 place-items-center rounded-lg hover:bg-canvas disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  );
}
