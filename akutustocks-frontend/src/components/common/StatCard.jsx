import { cn } from "@/lib/utils";

const iconTone = {
  info: "bg-[#cfe6f7] text-primary",
  success: "bg-[#d4f1e0] text-success-ink",
  warning: "bg-[#fdf0c7] text-warning-ink",
  danger: "bg-[#fbd5d5] text-danger-ink",
};

/** Kartu ringkasan sesuai mockup: nilai + satuan sama besar, keterangan kecil, baris footer. */
export default function StatCard({ label, value, unit, caption, icon: Icon, tone = "info", footer }) {
  return (
    <section className="flex flex-col rounded-card bg-surface p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] text-ink-muted">{label}</h2>
          <p className="mt-2 font-display text-[32px] font-semibold leading-tight tabular-nums">
            {value}
            {unit && <span className={String(unit).length > 6 ? "text-xl" : undefined}> {unit}</span>}
          </p>
          {caption && <p className="mt-0.5 text-xs text-ink-muted">{caption}</p>}
        </div>
        {Icon && (
          <span className={cn("grid size-14 shrink-0 place-items-center rounded-2xl", iconTone[tone])}>
            <Icon className="size-6" aria-hidden="true" />
          </span>
        )}
      </div>
      {footer && <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-sm">{footer}</div>}
    </section>
  );
}
