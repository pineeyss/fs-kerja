import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Panel samping kanan berbasis <dialog> (focus trap + Esc bawaan). footer = area tombol yang menempel di bawah. */
export default function Drawer({ open, title, description, onClose, children, footer, busy = false }) {
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
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-[520px] bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/40"
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Tutup"
              className="grid size-9 shrink-0 place-items-center rounded-md text-ink hover:bg-canvas"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
