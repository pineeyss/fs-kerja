import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, Info, RotateCcw, ShieldCheck, TriangleAlert, UploadCloud } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/common/DataTable";
import Pagination from "@/components/common/Pagination";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { ErrorState, LoadingState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import { IMPORT_ROW_STATUS } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { getErrorMessage, USE_MOCK } from "@/services/api/client";
import { confirmImport, listImports, previewImport } from "@/services/api/imports.api";
import { fmtDateTime } from "@/features/history/historyUtils";

const MAX_MB = 2;
const ACCEPT = USE_MOCK ? [".csv"] : [".csv", ".xlsx"];
const PAGE_SIZE = 10;
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const STEPS = ["Unggah file", "Validasi & pratinjau", "Pencocokan", "Simpan"];

/** Terapkan pilihan SPV pada baris kandidat. Kandidat yang belum dikonfirmasi tetap "Perlu Konfirmasi". */
function resolve(it, mapping) {
  if (it.status !== "CANDIDATE") return it;
  const c = it.candidates.find((x) => x.product.id === mapping[it.row]);
  if (!c) return it;
  const diff = it.qty - c.system_qty;
  return { ...it, product: c.product, system_qty: c.system_qty, difference: diff, status: diff === 0 ? "SAME" : "DIFFERENT", confirmed: true };
}

function Stepper({ current }) {
  return (
    <ol className="mb-5 flex flex-wrap gap-2" aria-label="Tahapan import">
      {STEPS.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className={cn("flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold", i === current ? "bg-primary text-white" : i < current ? "bg-success/12 text-success-ink" : "bg-surface text-ink-muted shadow-card")}>
          <span className="grid size-5 place-items-center rounded-full bg-white/25 text-xs">{i < current ? "✓" : i + 1}</span>{s}
        </li>
      ))}
    </ol>
  );
}

export default function ImportPage() {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [fileError, setFileError] = useState("");
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saved, setSaved] = useState(null);

  const history = useQuery({ queryKey: ["imports"], queryFn: () => listImports({ page: 1, limit: 5 }) });

  const previewM = useMutation({
    mutationFn: previewImport,
    onSuccess: (r) => { setPreview(r); setMapping({}); setFilter("all"); setPage(1); setSaved(null); },
    onError: (e) => { setPreview(null); setFileError(getErrorMessage(e, "File gagal dibaca.")); },
  });
  const saveM = useMutation({
    mutationFn: () => confirmImport(preview.import_id, mapping),
    onSuccess: (r) => {
      setSaved(r); setPreview(null); setConfirmOpen(false);
      toast.success("Hasil import disimpan. Stok sistem tidak diubah.");
      ["imports", "discrepancies", "notifications", "report"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => { setConfirmOpen(false); toast.error(getErrorMessage(e, "Hasil import gagal disimpan.")); },
  });

  const pick = (file) => {
    if (!file) return;
    setFileError("");
    const ext = `.${file.name.split(".").pop().toLowerCase()}`;
    if (!ACCEPT.includes(ext)) return setFileError(`Format file harus ${ACCEPT.join(" atau ")}.`);
    if (file.size > MAX_MB * 1024 * 1024) return setFileError(`Ukuran file maksimal ${MAX_MB} MB.`);
    previewM.mutate(file);
  };

  const items = useMemo(() => (preview?.items ?? []).map((it) => resolve(it, mapping)), [preview, mapping]);
  const counts = useMemo(() => {
    const c = { SAME: 0, DIFFERENT: 0, UNMATCHED: 0, CANDIDATE: 0 };
    items.forEach((i) => (c[i.status] += 1));
    return c;
  }, [items]);
  const shown = filter === "all" ? items : items.filter((i) => i.status === filter);
  const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  useEffect(() => setPage(1), [filter]);

  const step = saved ? 3 : !preview ? 0 : !preview.columns_ok ? 1 : 2;

  const downloadSample = () =>
    USE_MOCK
      ? downloadCsv("contoh-ekspor-kasir-pintar.csv", ["kode_barang", "nama_barang", "stok"], [["ACT-001", "Funko Pop! Spider-Man", 25], ["PRF-001", "HMNS Eau de Parfum Orion 30ml", 45], ["TMB-001", "Stanley Quencher H2.0 40oz", 12], ["ACT-0O4", "Funko Pop! Iron Man", 23], ["XYZ-999", "Produk Tidak Dikenal", 5]])
      : downloadCsv("format-import-kasir-pintar.csv", ["kode_barang", "nama_barang", "gudang", "stok"], [["CONTOH-001", "Nama barang contoh", "G1", 10]]);

  const columns = [
    { key: "row", header: "Baris", align: "right", cell: (i) => <span className="tabular-nums text-ink-muted">{i.row}</span> },
    { key: "file", header: "Data di file", className: "min-w-44", cell: (i) => <div><p className="font-medium">{i.code || "—"}</p><p className="text-xs text-ink-muted">{i.name || "(tanpa nama)"}</p></div> },
    { key: "sys", header: "Barang di sistem", className: "min-w-44", cell: (i) => (i.product ? <div><p className="font-medium">{i.product.name}</p><p className="text-xs text-ink-muted">{i.product.code}{i.confirmed ? " · dikonfirmasi" : ""}</p></div> : <span className="text-ink-muted">—</span>) },
    ...(items.some((i) => i.scope) ? [{ key: "scope", header: "Cakupan", cell: (i) => (i.scope ? i.scope.name : <span className="text-ink-muted">Total</span>) }] : []),
    { key: "q1", header: "Stok sistem", align: "right", cell: (i) => <span className="tabular-nums">{i.system_qty ?? "—"}</span> },
    { key: "q2", header: "Stok Kasir", align: "right", cell: (i) => <span className="tabular-nums">{i.qty ?? "—"}</span> },
    { key: "diff", header: "Selisih", align: "right", cell: (i) => (i.difference === null ? "—" : <b className={cn("tabular-nums", i.difference === 0 ? "text-success-ink" : i.difference < 0 ? "text-danger-ink" : "text-warning-ink")}>{signed(i.difference)}</b>) },
    { key: "status", header: "Status", align: "center", cell: (i) => <StatusBadge tone={IMPORT_ROW_STATUS[i.status].tone}>{IMPORT_ROW_STATUS[i.status].label}</StatusBadge> },
    {
      key: "act", header: "Keterangan / Konfirmasi", className: "min-w-52",
      cell: (i) =>
        i.status === "CANDIDATE" ? (
          <div>
            <label htmlFor={`map-${i.row}`} className="sr-only">Pilih barang untuk baris {i.row}</label>
            <select id={`map-${i.row}`} value={mapping[i.row] ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [i.row]: e.target.value }))} className="h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm">
              <option value="">Pilih barang yang dimaksud…</option>
              {i.candidates.map((c) => <option key={c.product.id} value={c.product.id}>{c.product.code} — {c.product.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-ink-muted">Nama mirip, kode tidak cocok. Tidak dicocokkan otomatis.</p>
          </div>
        ) : <span className="text-[13px] text-ink-muted">{i.issue || (i.status === "SAME" ? "Jumlah sesuai." : "")}</span>,
    },
  ];

  const unconfirmed = counts.CANDIDATE;

  return (
    <>
      <PageHeader title="Import Kasir Pintar" description="Unggah file ekspor Kasir Pintar secara manual untuk dibandingkan dengan stok sistem." actions={<StatusBadge tone="warning">Data contoh</StatusBadge>} />
      <Stepper current={step} />

      <p className="mb-5 flex items-start gap-3 rounded-card border border-info/30 bg-info/8 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info-ink" aria-hidden="true" />
        <span><b>Import tidak mengubah stok sistem.</b> Hasilnya hanya dibandingkan dan perbedaannya dicatat sebagai kasus selisih. Barang dicocokkan lewat <b>kode barang</b>; kecocokan berdasarkan nama harus Anda konfirmasi satu per satu.</span>
      </p>

      {!saved && (
        <section className="rounded-card bg-surface p-6 shadow-card" aria-labelledby="unggah">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="unggah" className="font-display text-lg font-semibold">1. Unggah file ekspor</h2>
              <p className="mt-1 text-sm text-ink-muted">Format {ACCEPT.join(" / ")}, maksimal {MAX_MB} MB. Kolom wajib: <b>kode_barang</b> dan <b>stok</b>. Opsional: <b>nama_barang</b> dan <b>gudang</b> (kode atau nama gudang).</p>
              <p className="mt-1 text-[13px] text-ink-muted">Tanpa kolom gudang, perbandingan dilakukan pada tingkat total semua gudang.</p>
            </div>
            <Button variant="secondary" onClick={downloadSample}><Download className="size-4" aria-hidden="true" /> {USE_MOCK ? "Unduh contoh file (data contoh)" : "Unduh format kosong"}</Button>
          </div>

          <input ref={inputRef} type="file" accept={ACCEPT.join(",")} className="sr-only" tabIndex={-1} aria-label="Pilih file ekspor Kasir Pintar" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            className={cn("mt-5 flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center", drag ? "border-primary bg-primary/5" : "border-line")}
          >
            {previewM.isPending ? <LoadingState label="Membaca dan mencocokkan data…" /> : (
              <>
                <UploadCloud className="size-9 text-ink-muted" aria-hidden="true" />
                <p className="text-sm">Tarik dan lepas file di sini, atau</p>
                <Button onClick={() => inputRef.current?.click()}><FileSpreadsheet className="size-4" aria-hidden="true" /> Pilih file</Button>
              </>
            )}
          </div>
          {fileError && <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm font-medium text-danger-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{fileError}</p>}
        </section>
      )}

      {preview && !preview.columns_ok && (
        <section className="mt-5 rounded-card bg-surface p-6 shadow-card" role="alert">
          <h2 className="font-display text-lg font-semibold text-danger-ink">2. File tidak dapat diproses</h2>
          <p className="mt-1 text-sm text-ink-muted">{preview.filename}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{preview.column_errors.map((e) => <li key={e}>{e}</li>)}</ul>
          <p className="mt-3 text-sm text-ink-muted">Kolom yang ditemukan: {preview.found_columns.join(", ") || "—"}</p>
          <Button variant="secondary" className="mt-4" onClick={() => { setPreview(null); setFileError(""); }}><RotateCcw className="size-4" aria-hidden="true" /> Unggah file lain</Button>
        </section>
      )}

      {preview?.columns_ok && (
        <>
          <section className="mt-5 rounded-card bg-surface p-6 shadow-card" aria-labelledby="valid">
            <h2 id="valid" className="flex flex-wrap items-center gap-3 font-display text-lg font-semibold">2. Validasi & pratinjau <StatusBadge tone="success">File valid · {preview.total_rows} baris</StatusBadge></h2>
            <p className="mt-1 text-sm text-ink-muted">{preview.filename} — lima baris pertama:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <caption className="sr-only">Pratinjau lima baris pertama</caption>
                <thead><tr className="text-ink-muted"><th scope="col" className="py-2 pr-4 font-medium">Baris</th><th scope="col" className="py-2 pr-4 font-medium">Kode</th><th scope="col" className="py-2 pr-4 font-medium">Nama</th><th scope="col" className="py-2 pr-4 font-medium">Gudang</th><th scope="col" className="py-2 text-right font-medium">Stok</th></tr></thead>
                <tbody>{preview.preview.map((p) => <tr key={p.row} className="border-t border-line"><td className="py-2 pr-4 tabular-nums text-ink-muted">{p.row}</td><td className="py-2 pr-4">{p.code || "—"}</td><td className="py-2 pr-4">{p.name || "—"}</td><td className="py-2 pr-4">{p.warehouse || "Total"}</td><td className="py-2 text-right tabular-nums">{p.qty ?? "—"}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="mt-5 rounded-card bg-surface p-6 shadow-card" aria-labelledby="cocok">
            <h2 id="cocok" className="font-display text-lg font-semibold">3. Hasil pencocokan</h2>
            <p className="mt-1 text-sm text-ink-muted">{unconfirmed > 0 ? `${unconfirmed} baris perlu diperiksa sebelum hasil import disimpan.` : "Semua baris sudah jelas."}</p>
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter hasil pencocokan">
              {[["all", "Semua", items.length], ...Object.entries(IMPORT_ROW_STATUS).map(([k, v]) => [k, v.label, counts[k]])].map(([k, label, n]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold", filter === k ? "bg-primary text-white" : "bg-canvas text-ink-muted hover:text-ink")}>
                  {label}<span className={cn("rounded-full px-2 text-xs", filter === k ? "bg-white/20" : "bg-surface")}>{n}</span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <DataTable dense caption="Hasil pencocokan data import" columns={columns} rows={shown.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)} rowKey="row" emptyTitle="Tidak ada baris pada filter ini" />
              <Pagination page={safePage} pageCount={pageCount} onChange={(p) => setPage(Math.min(Math.max(1, p), pageCount))} summary={`Menampilkan ${shown.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} - ${Math.min(safePage * PAGE_SIZE, shown.length)} dari ${shown.length} baris`} />
            </div>
          </section>

          <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-card bg-surface p-6 shadow-card" aria-labelledby="simpan">
            <div>
              <h2 id="simpan" className="font-display text-lg font-semibold">4. Simpan hasil import</h2>
              <p className="mt-1 text-sm text-ink-muted">{counts.SAME} sesuai · {counts.DIFFERENT} berbeda jumlah · {counts.UNMATCHED + counts.CANDIDATE} tidak ditemukan{unconfirmed ? ` (termasuk ${unconfirmed} belum dikonfirmasi)` : ""}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setPreview(null); setMapping({}); }}>Batalkan</Button>
              <Button onClick={() => setConfirmOpen(true)} loading={saveM.isPending} className="h-12 px-6">Simpan Hasil Import</Button>
            </div>
          </section>
        </>
      )}

      {saved && (
        <section className="rounded-card bg-surface p-8 text-center shadow-card" role="status">
          <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
          <h2 className="mt-3 font-display text-xl font-semibold">Hasil import tersimpan</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{saved.batch.filename}: {saved.batch.matched_count} sesuai, {saved.batch.mismatch_count} berbeda jumlah, {saved.batch.not_found_count} tidak ditemukan. {saved.discrepancies_created} kasus selisih baru dibuat dan {saved.discrepancies_updated} diperbarui. Stok sistem tidak diubah.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/selisih" className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">Buka Monitoring Selisih</Link>
            <Button variant="secondary" onClick={() => setSaved(null)}>Import file lain</Button>
          </div>
        </section>
      )}

      <section className="mt-5 rounded-card bg-surface p-6 shadow-card" aria-labelledby="riwayat-import">
        <h2 id="riwayat-import" className="mb-3 font-display text-lg font-semibold">Riwayat Import</h2>
        {history.isLoading ? <LoadingState /> : history.isError ? <ErrorState message={getErrorMessage(history.error)} onRetry={history.refetch} /> : (
          <DataTable dense caption="Riwayat import Kasir Pintar" rows={history.data.data} emptyTitle="Belum ada import" emptyDescription="Hasil import yang disimpan akan tercatat di sini."
            columns={[
              { key: "filename", header: "File", cell: (b) => <span className="font-medium">{b.filename}</span> },
              { key: "by", header: "Diunggah oleh", cell: (b) => b.uploaded_by },
              { key: "at", header: "Waktu", cell: (b) => <span className="whitespace-nowrap">{fmtDateTime(b.created_at)}</span> },
              { key: "tot", header: "Baris", align: "right", cell: (b) => <span className="tabular-nums">{b.total_rows}</span> },
              { key: "ok", header: "Sesuai", align: "right", cell: (b) => <span className="tabular-nums text-success-ink">{b.matched_count}</span> },
              { key: "mm", header: "Berbeda", align: "right", cell: (b) => <span className="tabular-nums text-warning-ink">{b.mismatch_count}</span> },
              { key: "nf", header: "Tidak ditemukan", align: "right", cell: (b) => <span className="tabular-nums text-danger-ink">{b.not_found_count}</span> },
            ]}
          />
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Simpan hasil import?"
        description={`${counts.DIFFERENT} baris berbeda jumlah akan dicatat sebagai kasus selisih.${unconfirmed ? ` ${unconfirmed} baris yang belum dikonfirmasi akan disimpan sebagai Tidak Ditemukan (tidak dicocokkan otomatis).` : ""} Stok sistem tidak diubah.`}
        confirmLabel="Ya, simpan hasil import"
        loading={saveM.isPending}
        onConfirm={() => saveM.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted"><Info className="size-3.5" aria-hidden="true" /> Struktur kolom ekspor Kasir Pintar masih menunggu konfirmasi PIC; parser akan disesuaikan.</p>
    </>
  );
}
