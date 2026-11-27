import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpFromLine,
  CircleCheck,
  GitCommitHorizontal,
  Info,
  Plus,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { LoadingState, ErrorState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Select from "@/components/ui/Select";
import { useWarehouse } from "@/app/providers/WarehouseContext";
import { cn } from "@/lib/utils";
import { getErrorMessage, getFieldErrors } from "@/services/api/client";
import { listProducts } from "@/services/api/products.api";
import { createCommit } from "@/services/api/transactions.api";

const TYPES = {
  IN: { label: "Barang Masuk", tag: "+ STOK", desc: "Penerimaan barang ke gudang tujuan.", Icon: ArrowDownToLine, tagCls: "bg-success/12 text-success-ink" },
  OUT: { label: "Barang Keluar", tag: "− STOK", desc: "Pengeluaran barang dari gudang asal.", Icon: ArrowUpFromLine, tagCls: "bg-danger/12 text-danger-ink" },
  TRANSFER: { label: "Perpindahan", tag: "MUTASI", desc: "Pindahkan stok antar gudang.", Icon: ArrowLeftRight, tagCls: "bg-info/12 text-info-ink" },
  ADJUSTMENT: { label: "Penyesuaian", tag: "KOREKSI", desc: "Koreksi jumlah stok dengan alasan.", Icon: SlidersHorizontal, tagCls: "bg-warning/18 text-warning-ink" },
};

const stockAt = (p, wid) => p?.stocks?.find((s) => s.warehouse_id === wid)?.quantity ?? 0;
const labelOf = (p) => `${p.code} — ${p.name}`;

export default function TransactionPage() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const { warehouses } = useWarehouse();
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const relatedId = params.get("koreksi");
  const initialType = TYPES[params.get("jenis")] ? params.get("jenis") : "IN";

  // State form aktivitas aktif
  const [type, setType] = useState(initialType);
  const [productText, setProductText] = useState("");
  const [fromId, setFromId] = useState(params.get("gudang") ?? "");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});

  // State daftar aktivitas dalam satu commit + commit message opsional
  const [stagedEntries, setStagedEntries] = useState([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(null);

  const list = products.data ?? [];
  const product = useMemo(() => {
    const t = productText.trim().toLowerCase();
    return t ? list.find((p) => labelOf(p).toLowerCase() === t || p.code.toLowerCase() === t) ?? null : null;
  }, [list, productText]);

  useEffect(() => {
    const id = params.get("produk");
    if (id && list.length && !productText) {
      const p = list.find((x) => x.id === id);
      if (p) setProductText(labelOf(p));
    }
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stok berjalan memperhitungkan aktivitas yang sudah masuk ke antrean commit saat ini
  const effectiveStockAt = (prod, wid) => {
    let current = stockAt(prod, wid);
    for (const entry of stagedEntries) {
      for (const it of entry.payloadItems) {
        if (it.product_id === prod.id && it.warehouse_id === wid) {
          if (it.activity_type === "IN" || it.activity_type === "TRANSFER_IN") current += it.quantity;
          else if (it.activity_type === "OUT" || it.activity_type === "TRANSFER_OUT") current -= it.quantity;
          else if (it.activity_type === "ADJUSTMENT") current = it.quantity;
        }
      }
    }
    return current;
  };

  const n = qty.trim() === "" ? NaN : Number(qty);
  const nValid = Number.isInteger(n) && n >= (type === "ADJUSTMENT" ? 0 : 1);
  const isOut = type === "OUT" || type === "TRANSFER";
  const fromLabel = type === "IN" ? "Gudang tujuan" : type === "OUT" ? "Gudang asal" : type === "TRANSFER" ? "Gudang asal" : "Gudang";

  const impact = useMemo(() => {
    if (!product || !nValid || !fromId) return [];
    const w = (id) => warehouses.find((x) => x.id === id);
    const b = effectiveStockAt(product, fromId);
    if (type === "IN") return [{ w: w(fromId), before: b, after: b + n }];
    if (type === "OUT") return [{ w: w(fromId), before: b, after: b - n }];
    if (type === "ADJUSTMENT") return [{ w: w(fromId), before: b, after: n }];
    if (type === "TRANSFER" && toId && toId !== fromId) {
      return [
        { w: w(fromId), before: b, after: b - n },
        { w: w(toId), before: effectiveStockAt(product, toId), after: effectiveStockAt(product, toId) + n },
      ];
    }
    return [];
  }, [product, nValid, n, fromId, toId, type, warehouses, stagedEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  const validate = () => {
    const e = {};
    if (!product) e.product = "Pilih barang dari daftar.";
    if (!fromId) e.from = type === "IN" ? "Pilih gudang tujuan." : "Pilih gudang asal.";
    if (type === "TRANSFER") {
      if (!toId) e.to = "Pilih gudang tujuan.";
      else if (toId === fromId) e.to = "Gudang asal dan tujuan tidak boleh sama.";
    }
    const avail = product && fromId ? effectiveStockAt(product, fromId) : 0;
    if (!nValid) {
      e.qty =
        type === "ADJUSTMENT"
          ? "Masukkan jumlah setelah penyesuaian (bilangan bulat, minimal 0)."
          : "Masukkan jumlah (bilangan bulat, minimal 1).";
    } else if (isOut && product && fromId && n > avail) {
      e.qty =
        type === "OUT"
          ? `Jumlah barang keluar melebihi stok tersedia di gudang ini (sisa ${avail}).`
          : `Jumlah perpindahan melebihi stok tersedia di gudang asal (sisa ${avail}).`;
    }
    const r = reason.trim();
    if (type === "OUT" && r.length < 3) e.reason = "Alasan pengeluaran wajib diisi.";
    if (type === "ADJUSTMENT" && r.length < 5) e.reason = "Alasan penyesuaian wajib diisi (minimal 5 karakter).";
    return e;
  };

  const buildPayloadForCurrent = () => {
    const base = { product_id: product.id, reason: reason.trim() || undefined };
    if (type === "TRANSFER") {
      return [
        { ...base, activity_type: "TRANSFER_OUT", warehouse_id: fromId, quantity: n },
        { ...base, activity_type: "TRANSFER_IN", warehouse_id: toId, quantity: n },
      ];
    }
    return [{ ...base, activity_type: type, warehouse_id: fromId, quantity: n }];
  };

  const resetFormFields = () => {
    setProductText("");
    setQty("");
    setReason("");
    setErrors({});
    setToId("");
  };

  const addActivityToCommit = (ev) => {
    ev.preventDefault();
    setDone(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      typeLabel: TYPES[type].label,
      tag: TYPES[type].tag,
      tagCls: TYPES[type].tagCls,
      product,
      fromWarehouse: warehouses.find((w) => w.id === fromId) ?? null,
      toWarehouse: type === "TRANSFER" ? warehouses.find((w) => w.id === toId) ?? null : null,
      quantity: n,
      reason: reason.trim(),
      impacts: impact.map((i) => ({ whId: i.w?.id, whName: i.w?.name, before: i.before, after: i.after })),
      payloadItems: buildPayloadForCurrent(),
    };

    setStagedEntries((prev) => [...prev, entry]);
    resetFormFields();
    toast.success("Aktivitas ditambahkan ke antrean commit.");
  };

  const removeStaged = (id) => {
    setStagedEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const allPayloadItems = useMemo(() => stagedEntries.flatMap((entry) => entry.payloadItems), [stagedEntries]);

  const mutation = useMutation({
    mutationFn: () =>
      createCommit({
        items: allPayloadItems,
        message: commitMessage.trim() || undefined,
        related_commit_id: relatedId,
      }),
    onSuccess: (commit) => {
      const count = stagedEntries.length;
      const msgText = commitMessage.trim();
      setConfirmOpen(false);
      setDone({ count, message: msgText, staff: commit.status === "SUBMITTED" });
      toast.success(`Commit berhasil disimpan (${count} aktivitas).`);
      setStagedEntries([]);
      setCommitMessage("");
      resetFormFields();
      ["products", "history", "activities", "notifications", "report"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (err) => {
      setConfirmOpen(false);
      const fe = getFieldErrors(err);
      if (fe.length) setErrors(Object.fromEntries(fe.map((f) => [f.field === "quantity" ? "qty" : f.field, f.message])));
      else toast.error(getErrorMessage(err, "Commit gagal dicatat. Coba lagi."));
    },
  });

  const whOptions = (withStock) => [
    { value: "", label: "Pilih gudang…" },
    ...warehouses.map((w) => ({
      value: w.id,
      label: withStock && product ? `${w.name} (stok: ${effectiveStockAt(product, w.id)})` : w.name,
    })),
  ];
  const clear = (k) => setErrors((e) => ({ ...e, [k]: undefined }));

  if (products.isLoading) return <LoadingState label="Memuat daftar barang…" />;
  if (products.isError) return <div className="rounded-card bg-surface shadow-card"><ErrorState message={getErrorMessage(products.error)} onRetry={products.refetch} /></div>;

  return (
    <>
      <PageHeader
        title="Input Transaksi & Commit Aktivitas"
        description="Tambahkan satu atau beberapa aktivitas ke daftar commit terlebih dahulu, lalu simpan sebagai satu commit dengan pesan commit opsional."
      />

      {relatedId && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-info/10 p-3 text-sm text-info-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Anda sedang menindaklanjuti aktivitas yang ditolak SPV. Isi penyesuaian dengan alasan yang jelas; aktivitas awal tetap tersimpan.
        </p>
      )}

      {done && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-success/10 p-3.5 text-sm text-success-ink">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          <span>
            <b>Commit dengan {done.count} aktivitas</b> berhasil dicatat
            {done.message ? ` — "${done.message}"` : ""}.
            {done.staff && " Aktivitas langsung berlaku dan dikirim ke SPV dengan status Diajukan."}
          </span>
          <Link to="/riwayat" className="font-semibold underline">Lihat Riwayat Aktivitas</Link>
        </div>
      )}

      <fieldset className="mb-5">
        <legend className="sr-only">Jenis transaksi</legend>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(TYPES).map(([key, t]) => (
            <label
              key={key}
              className={cn(
                "relative flex cursor-pointer flex-col gap-1.5 rounded-card bg-surface p-5 shadow-card ring-2 ring-transparent transition has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
              )}
            >
              <input
                type="radio"
                name="jenis"
                value={key}
                checked={type === key}
                onChange={() => {
                  setType(key);
                  setErrors({});
                  setDone(null);
                }}
                className="sr-only"
              />
              <span className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <t.Icon className="size-5" aria-hidden="true" />
                </span>
                <span className={cn("rounded px-2 py-0.5 text-[11px] font-bold", t.tagCls)}>{t.tag}</span>
              </span>
              <span className="font-display text-base font-semibold">{t.label}</span>
              <span className="text-xs text-ink-muted">{t.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <form onSubmit={addActivityToCommit} noValidate className="space-y-5 rounded-card bg-surface p-6 shadow-card" aria-label={`Form ${TYPES[type].label}`}>
          <h2 className="font-display text-lg font-semibold">Tambah Aktivitas — {TYPES[type].label}</h2>

          <FormField
            label="Barang *"
            list="daftar-barang"
            placeholder="Ketik kode atau nama barang…"
            autoComplete="off"
            value={productText}
            onChange={(e) => {
              setProductText(e.target.value);
              clear("product");
            }}
            error={errors.product}
            hint={product ? undefined : "Pilih dari daftar yang muncul saat Anda mengetik."}
          />
          <datalist id="daftar-barang">
            {list.map((p) => (
              <option key={p.id} value={labelOf(p)} />
            ))}
          </datalist>

          {product && (
            <ul className="flex flex-wrap gap-2 text-xs" aria-label={`Stok ${product.name} per gudang`}>
              {warehouses.map((w) => (
                <li key={w.id} className="rounded-full bg-canvas px-3 py-1">
                  {w.code}: <b className="tabular-nums">{effectiveStockAt(product, w.id)}</b>
                </li>
              ))}
              <li className="rounded-full bg-canvas px-3 py-1">
                Batas min.: <b className="tabular-nums">{product.min_stock}</b>
              </li>
            </ul>
          )}

          <div className={cn("grid gap-4", type === "TRANSFER" && "sm:grid-cols-2")}>
            <Select
              label={`${fromLabel} *`}
              value={fromId}
              onChange={(e) => {
                setFromId(e.target.value);
                clear("from");
                clear("qty");
              }}
              options={whOptions(type !== "IN")}
              error={errors.from}
            />
            {type === "TRANSFER" && (
              <Select
                label="Gudang tujuan *"
                value={toId}
                onChange={(e) => {
                  setToId(e.target.value);
                  clear("to");
                }}
                options={whOptions(false)}
                error={errors.to}
              />
            )}
          </div>

          <FormField
            label={type === "ADJUSTMENT" ? "Jumlah setelah penyesuaian *" : "Jumlah *"}
            type="number"
            inputMode="numeric"
            min={type === "ADJUSTMENT" ? 0 : 1}
            placeholder={type === "ADJUSTMENT" ? "Contoh: 10" : "Contoh: 5"}
            value={qty}
            onChange={(e) => {
              setQty(e.target.value);
              clear("qty");
            }}
            error={errors.qty}
            hint={isOut && product && fromId ? `Stok tersedia di gudang ini: ${effectiveStockAt(product, fromId)}` : undefined}
          />

          <div>
            <label htmlFor="alasan" className="mb-1.5 block text-sm font-medium">
              {type === "OUT" ? "Alasan *" : type === "ADJUSTMENT" ? "Alasan penyesuaian *" : "Catatan / referensi (opsional)"}
            </label>
            <textarea
              id="alasan"
              rows={3}
              value={reason}
              maxLength={300}
              onChange={(e) => {
                setReason(e.target.value);
                clear("reason");
              }}
              aria-invalid={errors.reason ? true : undefined}
              aria-describedby={errors.reason ? "alasan-error" : undefined}
              className={cn("w-full rounded-lg border bg-surface px-3 py-2.5 text-sm", errors.reason ? "border-danger" : "border-line")}
              placeholder={
                type === "OUT"
                  ? "Contoh: Penjualan toko / dikirim ke pelanggan"
                  : type === "ADJUSTMENT"
                    ? "Jelaskan penyebab koreksi stok"
                    : "Contoh: Restock dari supplier, no. referensi…"
              }
            />
            {errors.reason && (
              <p id="alasan-error" className="mt-1.5 text-[13px] font-medium text-danger-ink">
                {errors.reason}
              </p>
            )}
          </div>

          {type === "ADJUSTMENT" && (
            <p className="flex items-start gap-2 rounded-lg bg-warning/15 p-3 text-[13px] text-warning-ink">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Penyesuaian akan mengubah stok saat commit disimpan. Pastikan jumlah dan alasan sudah benar.
            </p>
          )}

          <Button type="submit" className="h-12 w-full sm:w-auto sm:px-6">
            <Plus className="size-4" aria-hidden="true" /> Masukkan ke Commit
          </Button>
        </form>

        {/* Panel Draft Commit (kumpulan aktivitas + commit message opsional) */}
        <aside className="self-start space-y-5 rounded-card bg-surface p-6 shadow-card lg:sticky lg:top-24" aria-labelledby="draft-commit-judul">
          <div className="flex items-center justify-between gap-2">
            <h2 id="draft-commit-judul" className="flex items-center gap-2 font-display text-lg font-semibold">
              <GitCommitHorizontal className="size-5 text-primary" aria-hidden="true" />
              Draft Commit
            </h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
              {stagedEntries.length} aktivitas
            </span>
          </div>

          {impact.length > 0 && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary">Pratinjau aktivitas yang sedang diisi ({product.name})</p>
              <ul className="mt-2 space-y-1.5">
                {impact.map((i) => (
                  <li key={i.w?.id} className="flex items-center justify-between text-xs">
                    <span>{i.w?.name}</span>
                    <span className="font-semibold tabular-nums">
                      {i.before} → <span className={i.after < 0 ? "text-danger-ink" : undefined}>{i.after}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stagedEntries.length === 0 ? (
            <p className="rounded-lg bg-canvas p-4 text-sm text-ink-muted">
              Belum ada aktivitas di daftar commit. Tambahkan satu atau beberapa aktivitas dari form di samping, lalu simpan sebagai satu commit.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1" aria-label="Daftar aktivitas dalam commit">
              {stagedEntries.map((entry, idx) => (
                <li key={entry.id} className="rounded-lg border border-line bg-canvas p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-ink-muted">#{idx + 1}</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", entry.tagCls)}>{entry.typeLabel}</span>
                        <span className="text-xs font-semibold text-ink">{entry.product.code}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium">{entry.product.name}</p>
                      <p className="text-xs text-ink-muted">
                        {entry.type === "TRANSFER"
                          ? `${entry.fromWarehouse?.name} → ${entry.toWarehouse?.name} (${entry.quantity} unit)`
                          : `${entry.fromWarehouse?.name}: ${entry.impacts.map((x) => `${x.before} → ${x.after}`).join(", ")}`}
                      </p>
                      {entry.reason && <p className="mt-1 text-xs italic text-ink-muted">Catatan: {entry.reason}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStaged(entry.id)}
                      aria-label={`Hapus aktivitas ${entry.product.name}`}
                      title="Hapus dari commit"
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface hover:text-danger-ink"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div>
            <label htmlFor="commit-message" className="mb-1.5 block text-sm font-medium">
              Commit message <span className="font-normal text-ink-muted">(opsional)</span>
            </label>
            <input
              id="commit-message"
              type="text"
              maxLength={160}
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Contoh: Restock pagi & mutasi barang ke Gudang 2…"
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm"
            />
            <p className="mt-1 text-xs text-ink-muted">Keterangan singkat untuk merangkum seluruh aktivitas dalam commit ini.</p>
          </div>

          <Button
            type="button"
            disabled={stagedEntries.length === 0}
            loading={mutation.isPending}
            onClick={() => setConfirmOpen(true)}
            className="h-12 w-full"
          >
            <GitCommitHorizontal className="size-4" aria-hidden="true" />
            Simpan Commit ({stagedEntries.length} aktivitas)
          </Button>

          <p className="flex items-start gap-2 text-[13px] text-ink-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Semua aktivitas dalam commit dicatat bersama ke Riwayat Aktivitas dan dilaporkan ke SPV untuk diperiksa.
          </p>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Simpan commit (${stagedEntries.length} aktivitas)?`}
        description={`${stagedEntries.length} aktivitas akan dirangkum menjadi satu commit${commitMessage.trim() ? ` dengan pesan "${commitMessage.trim()}"` : ""}. Perubahan stok akan tercatat ke Riwayat Aktivitas.`}
        confirmLabel="Ya, simpan commit"
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}