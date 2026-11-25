import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Dialog berbasis <dialog> bawaan: focus trap + Esc otomatis. */
export default function Modal({ open, title, description, onClose, children, busy = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose?.();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      <div className="flex items-start justify-between gap-4 p-6 pb-2">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Tutup"
          className="grid size-9 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-canvas"
        >
          <X className="size-5" />
        </button>
      </div>
      {open && <div className="px-6 pb-6 pt-3">{children}</div>}
    </dialog>
  );
}
