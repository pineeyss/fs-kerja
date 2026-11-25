import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardCheck, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACTIVITY_TYPE } from "@/lib/constants";

const META = {
  IN: { Icon: ArrowDownToLine, cls: "bg-success/12 text-success-ink" },
  OUT: { Icon: ArrowUpFromLine, cls: "bg-warning/18 text-warning-ink" },
  TRANSFER_OUT: { Icon: ArrowLeftRight, cls: "bg-info/12 text-info-ink" },
  TRANSFER_IN: { Icon: ArrowLeftRight, cls: "bg-info/12 text-info-ink" },
  PHYSICAL_COUNT: { Icon: ClipboardCheck, cls: "bg-line text-ink" },
  ADJUSTMENT: { Icon: SlidersHorizontal, cls: "bg-primary/10 text-primary" },
};

export default function ActivityTypeBadge({ type }) {
  const { Icon, cls } = META[type] ?? META.PHYSICAL_COUNT;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold", cls)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {ACTIVITY_TYPE[type] ?? type}
    </span>
  );
}
