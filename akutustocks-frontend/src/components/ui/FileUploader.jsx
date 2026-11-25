import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 2;

/**
 * Unggah satu gambar (seret-lepas atau Browse). File dikirim ke induk lewat onChange;
 * pengunggahan sebenarnya terjadi saat form disimpan. existingUrl = foto yang sudah tersimpan.
 */
export default function FileUploader({ label, hint, file, existingUrl, onChange, onRemoveExisting }) {
  const id = useId();
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return setError("Format harus JPG, PNG, atau WebP.");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`Ukuran foto maksimal ${MAX_MB} MB.`);
    setError("");
    onChange(f);
  };

  const shown = preview ?? existingUrl;

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="mb-1.5 text-sm font-medium">
        {label}
      </p>
      <input ref={inputRef} type="file" accept={ACCEPT.join(",")} className="sr-only" tabIndex={-1} aria-label={label} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />

      {shown ? (
        <div className="flex items-center gap-4 rounded-lg border border-line p-3">
          <img src={shown} alt="Pratinjau foto produk" className="size-20 rounded-lg object-cover" />
          <div className="flex flex-1 flex-col items-start gap-1 text-sm">
            <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-primary hover:underline">
              Ganti foto
            </button>
            <button
              type="button"
              onClick={() => (file ? onChange(null) : onRemoveExisting?.())}
              className="inline-flex items-center gap-1.5 text-danger-ink hover:underline"
            >
              <Trash2 className="size-4" aria-hidden="true" /> Hapus foto
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
          className={cn("flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm", drag ? "border-primary bg-primary/5" : "border-line")}
        >
          <ImagePlus className="size-8 text-ink-muted" aria-hidden="true" />
          <p>Tarik dan lepas foto di sini</p>
          <p className="text-ink-muted">atau</p>
          <button type="button" onClick={() => inputRef.current?.click()} className="font-semibold text-primary hover:underline">
            Browse
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger-ink">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-[13px] text-ink-muted">{hint}</p>
      )}
    </div>
  );
}
