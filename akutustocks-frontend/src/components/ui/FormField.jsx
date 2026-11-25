import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

/** Label + input + pesan error di dekat field (design.md bagian 9). */
const FormField = forwardRef(function FormField(
  { label, error, hint, className, inputClassName, rightSlot, id, ...inputProps },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted/70",
            "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary",
            error ? "border-danger" : "border-line",
            rightSlot && "pr-12",
            inputClassName
          )}
          {...inputProps}
        />
        {rightSlot && <div className="absolute inset-y-0 right-1.5 flex items-center">{rightSlot}</div>}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-[13px] font-medium text-danger-ink">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default FormField;
