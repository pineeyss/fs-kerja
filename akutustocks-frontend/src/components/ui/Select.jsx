import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** <select> bawaan browser (aksesibel) dengan tampilan mockup. label wajib; hideLabel menyembunyikannya secara visual. */
const Select = forwardRef(function Select(
  { label, hideLabel = false, error, options, className, selectClassName, id, ...props },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={selectId} className={cn("mb-1.5 block text-sm font-medium text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-error` : undefined}
          className={cn(
            "h-11 w-full appearance-none rounded-lg border border-line bg-surface pl-3 pr-9 text-sm text-ink",
            error && "border-danger",
            selectClassName
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
      </div>
      {error && <p id={`${selectId}-error`} className="mt-1.5 text-[13px] font-medium text-danger-ink">{error}</p>}
    </div>
  );
});

export default Select;
