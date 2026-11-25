import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpFromLine, CircleCheck, Info, SlidersHorizontal, TriangleAlert } from "lucide-react";
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
  const [type, setType] = useState(initialType);
  const [productText, setProductText] = useState("");
  const [fromId, setFromId] = useState(params.get("gudang") ?? "");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(null);

  const list = products.data ?? [];
  const product = useMemo(() => {
    const t = productText.trim().toLowerCase();
    return t ? list.find((p) => labelOf(p).toLowerCase() === t || p.code.toLowerCase() === t) ?? null : null;
  }, [list, productText]);

  // Prefill dari tautan (mis. dari Manajemen Stok atau Status Pelaporan)
  useEffect(() => {
    const id = params.get("produk");
    if (id && list.length && !productText) {
      const p = list.find((x) => x.id === id);
      if (p) setProductText(labelOf(p));
    }
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = qty.trim() === "" ? NaN : Number(qty);
  const nValid = Number.isInteger(n) && n >= (type === "ADJUSTMENT" ? 0 : 1);
  const isOut = type === "OUT" || type === "TRANSFER";
  const fromLabel = type === "IN" ? "Gudang tujuan" : type === "OUT" ? "Gudang asal" : type === "TRANSFER" ? "Gudang asal" : "Gudang";

  // Ringkasan dampak stok
  const impact = useMemo(() => {
    if (!product || !nValid || !fromId) return [];
    const w = (id) => warehouses.find((x) => x.id === id);
    const b = stockAt(product, fromId);
    if (type === "IN") return [{ w: w(fromId), before: b, after: b + n }];
    if (type === "OUT") return [{ w: w(fromId), before: b, after: b - n }];
    if (type === "ADJUSTMENT") return [{ w: w(fromId), before: b, after: n }];
    if (type === "TRANSFER" && toId && toId !== fromId) return [{ w: w(fromId), before: b, after: b - n }, { w: w(toId), before: stockAt(product, toId), after: stockAt(product, toId) + n }];
    return [];
  }, [product, nValid, n, fromId, toId, type, warehouses]);

  const validate = () => {
    const e = {};
    if (!product) e.product = "Pilih barang dari daftar.";
    if (!fromId) e.from = type === "IN" ? "Pilih gudang tujuan." : "Pilih gudang asal.";
    if (type === "TRANSFER") {
      if (!toId) e.to = "Pilih gudang tujuan.";
      else if (toId === fromId) e.to = "Gudang asal dan tujuan tidak boleh sama.";
    }
    if (!nValid) e.qty = type === "ADJUSTMENT" ? "Masukkan jumlah setelah penyesuaian (bilangan bulat, minimal 0)." : "Masukkan jumlah (bilangan bulat, minimal 1).";
    else if (isOut && product && fromId && n > stockAt(product, fromId)) e.qty = type === "OUT" ? "Jumlah barang keluar melebihi stok tersedia di gudang ini." : "Jumlah perpindahan melebihi stok tersedia di gudang asal.";
    const r = reason.trim();
    if (type === "OUT" && r.length < 3) e.reason = "Alasan pengeluaran wajib diisi.";
    if (type === "ADJUSTMENT" && r.length < 5) e.reason = "Alasan penyesuaian wajib diisi (minimal 5 karakter).";
    return e;
  };

  const buildItems = () => {
    const base = { product_id: product.id, reason: reason.trim() || undefined };
    if (type === "TRANSFER")
      return [{ ...base, activity_type: "TRANSFER_OUT", warehouse_id: fromId, quantity: n }, { ...base, activity_type: "TRANSFER_IN", warehouse_id: toId, quantity: n }];
    return [{ ...base, activity_type: type, warehouse_id: fromId, quantity: n }];
  };

  const mutation = useMutation({
    mutationFn: () => createCommit({ items: buildItems(), related_commit_id: type === "ADJUSTMENT" ? relatedId : null }),
    onSuccess: (commit) => {
      setConfirmOpen(false);
      setDone({ label: TYPES[type].label, name: product.name, staff: commit.status === "SUBMITTED" });
      toast.success(`Transaksi ${TYPES[type].label.toLowerCase()} berhasil dicatat.`);
      setProductText(""); setQty(""); setReason(""); setErrors({}); setToId("");
      ["products", "history", "activities", "notifications", "report"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (err) => {
      setConfirmOpen(false);
      const fe = getFieldErrors(err);
      if (fe.length) setErrors(Object.fromEntries(fe.map((f) => [f.field === "quantity" ? "qty" : f.field, f.message])));
      else toast.error(getErrorMessage(err, "Transaksi gagal dicatat. Coba lagi."));
    },
  });

  const submit = (ev) => {
    ev.preventDefault();
    setDone(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length === 0) setConfirmOpen(true);
  };

  const whOptions = (withStock) => [
    { value: "", label: "Pilih gudang…" },
    ...warehouses.map((w) => ({ value: w.id, label: withStock && product ? `${w.name} (stok: ${stockAt(product, w.id)})` : w.name })),
  ];
  const clear = (k) => setErrors((e) => ({ ...e, [k]: undefined }));
  const summaryText = impact.map((i) => `${i.w?.name}: ${i.before} → ${i.after}`).join("; ");

  if (products.isLoading) return <LoadingState label="Memuat daftar barang…" />;
  if (products.isError) return <div className="rounded-card bg-surface shadow-card"><ErrorState message={getErrorMessage(products.error)} onRetry={products.refetch} /></div>;

  return (
    <>
      <PageHeader title="Input Transaksi" description="Catat barang masuk, barang keluar, perpindahan antar gudang, atau penyesuaian stok. Jumlah stok hanya berubah lewat transaksi." />

      {relatedId && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-info/10 p-3 text-sm text-info-ink">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Anda sedang menindaklanjuti aktivitas yang ditolak SPV. Isi penyesuaian dengan alasan yang jelas; aktivitas awal tetap tersimpan.
        </p>
      )}

      {done && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-success/10 p-3 text-sm text-success-ink">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          <span>
            <b>{done.label}</b> untuk {done.name} berhasil dicatat.{done.staff && " Aktivitas langsung berlaku dan dikirim ke SPV dengan status Diajukan."}
          </span>
          <Link to="/status-pelaporan" className="font-semibold underline">Lihat Status Pelaporan</Link>
        </div>
      )}

      <fieldset className="mb-5">
        <legend className="sr-only">Jenis transaksi</legend>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(TYPES).map(([key, t]) => (
            <label key={key} className={cn("relative flex cursor-pointer flex-col gap-1.5 rounded-card bg-surface p-5 shadow-card ring-2 ring-transparent transition has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary")}>
              <input type="radio" name="jenis" value={key} checked={type === key} onChange={() => { setType(key); setErrors({}); setDone(null); }} className="sr-only" />
              <span className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><t.Icon className="size-5" aria-hidden="true" /></span>
                <span className={cn("rounded px-2 py-0.5 text-[11px] font-bold", t.tagCls)}>{t.tag}</span>
              </span>
              <span className="font-display text-base font-semibold">{t.label}</span>
              <span className="text-xs text-ink-muted">{t.desc}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <form onSubmit={submit} noValidate className="space-y-5 rounded-card bg-surface p-6 shadow-card" aria-label={`Form ${TYPES[type].label}`}>
          <h2 className="font-display text-lg font-semibold">{TYPES[type].label}</h2>

          <FormField
            label="Barang *"
            list="daftar-barang"
            placeholder="Ketik kode atau nama barang…"
            autoComplete="off"
            value={productText}
            onChange={(e) => { setProductText(e.target.value); clear("product"); }}
            error={errors.product}
            hint={product ? undefined : "Pilih dari daftar yang muncul saat Anda mengetik."}
          />
          <datalist id="daftar-barang">
            {list.map((p) => <option key={p.id} value={labelOf(p)} />)}
          </datalist>
          {product && (
            <ul className="flex flex-wrap gap-2 text-xs" aria-label={`Stok ${product.name} per gudang`}>
              {warehouses.map((w) => (
                <li key={w.id} className="rounded-full bg-canvas px-3 py-1">{w.code}: <b className="tabular-nums">{stockAt(product, w.id)}</b></li>
              ))}
              <li className="rounded-full bg-canvas px-3 py-1">Batas min.: <b className="tabular-nums">{product.min_stock}</b></li>
            </ul>
          )}

          <div className={cn("grid gap-4", type === "TRANSFER" && "sm:grid-cols-2")}>
            <Select label={`${fromLabel} *`} value={fromId} onChange={(e) => { setFromId(e.target.value); clear("from"); clear("qty"); }} options={whOptions(type !== "IN")} error={errors.from} />
            {type === "TRANSFER" && <Select label="Gudang tujuan *" value={toId} onChange={(e) => { setToId(e.target.value); clear("to"); }} options={whOptions(false)} error={errors.to} />}
          </div>

          <FormField
            label={type === "ADJUSTMENT" ? "Jumlah setelah penyesuaian *" : "Jumlah *"}
            type="number"
            inputMode="numeric"
            min={type === "ADJUSTMENT" ? 0 : 1}
            placeholder={type === "ADJUSTMENT" ? "Contoh: 10" : "Contoh: 5"}
            value={qty}
            onChange={(e) => { setQty(e.target.value); clear("qty"); }}
            error={errors.qty}
            hint={isOut && product && fromId ? `Stok tersedia di gudang ini: ${stockAt(product, fromId)}` : undefined}
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
              onChange={(e) => { setReason(e.target.value); clear("reason"); }}
              aria-invalid={errors.reason ? true : undefined}
              aria-describedby={errors.reason ? "alasan-error" : undefined}
              className={cn("w-full rounded-lg border bg-surface px-3 py-2.5 text-sm", errors.reason ? "border-danger" : "border-line")}
              placeholder={type === "OUT" ? "Contoh: Penjualan toko / dikirim ke pelanggan" : type === "ADJUSTMENT" ? "Jelaskan penyebab koreksi stok" : "Contoh: Restock dari supplier, no. referensi…"}
            />
            {errors.reason && <p id="alasan-error" className="mt-1.5 text-[13px] font-medium text-danger-ink">{errors.reason}</p>}
          </div>

          {type === "ADJUSTMENT" && (
            <p className="flex items-start gap-2 rounded-lg bg-warning/15 p-3 text-[13px] text-warning-ink">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Penyesuaian akan mengubah stok dan masuk ke riwayat aktivitas. Pastikan jumlah dan alasan sudah benar.
            </p>
          )}

          <Button type="submit" loading={mutation.isPending} className="h-12 w-full sm:w-auto sm:px-8">Catat {TYPES[type].label}</Button>
        </form>

        <aside className="self-start rounded-card bg-surface p-6 shadow-card lg:sticky lg:top-24" aria-labelledby="ringkasan-judul">
          <h2 id="ringkasan-judul" className="font-display text-lg font-semibold">Ringkasan Perubahan Stok</h2>
          {impact.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Pilih barang, gudang, dan jumlah untuk melihat dampaknya pada stok sebelum disimpan.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-muted">{product.name}</p>
              <ul className="mt-4 space-y-3">
                {impact.map((i) => (
                  <li key={i.w?.id} className="rounded-lg bg-canvas p-3">
                    <p className="text-xs text-ink-muted">{i.w?.name}</p>
                    <p className="mt-1 flex items-center gap-2 font-display text-xl font-semibold tabular-nums">
                      {i.before} <ArrowRight className="size-4 text-ink-muted" aria-label="menjadi" /> <span className={i.after < 0 ? "text-danger-ink" : undefined}>{i.after}</span>
                      <span className="text-sm font-semibold text-ink-muted">({i.after - i.before > 0 ? "+" : ""}{i.after - i.before})</span>
                    </p>
                    {i.after < 0 && <p className="mt-1 text-xs font-medium text-danger-ink">Stok tidak boleh negatif.</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-5 flex items-start gap-2 text-[13px] text-ink-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Setiap transaksi langsung berlaku, dicatat di Riwayat Aktivitas, dan dilaporkan ke SPV untuk diperiksa.
          </p>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Catat ${TYPES[type].label.toLowerCase()}?`}
        description={`Perubahan stok akan dicatat dalam riwayat aktivitas. ${product?.name ?? ""} — ${summaryText}.`}
        confirmLabel="Ya, catat transaksi"
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
