import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  success: { cls: "bg-success/12 text-success-ink", Icon: CircleCheck },
  warning: { cls: "bg-warning/18 text-warning-ink", Icon: TriangleAlert },
  danger: { cls: "bg-danger/12 text-danger-ink", Icon: CircleX },
  info: { cls: "bg-info/12 text-info-ink", Icon: Info },
  neutral: { cls: "bg-line text-ink", Icon: Info },
};

/** Selalu menyertakan ikon + teks, tidak mengandalkan warna saja. */
export default function StatusBadge({ tone = "neutral", children, className }) {
  const { cls, Icon } = tones[tone] ?? tones.neutral;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", cls, className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}
