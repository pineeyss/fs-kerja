import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  FileUp,
  Info,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/common/DataTable";
import Pagination from "@/components/common/Pagination";
import { ErrorState, LoadingState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { IMPORT_ROW_STATUS } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { getErrorMessage, USE_MOCK } from "@/services/api/client";
import { confirmImport, listImports, previewImport } from "@/services/api/imports.api";
import { fmtDateTime } from "@/features/history/historyUtils";

const MAX_MB = 2;
const ACCEPT = USE_MOCK ? [".csv"] : [".csv", ".xlsx"];
const PAGE_SIZE = 8;
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
    <ol className="mb-5 flex flex-wrap gap-2 border-b border-line pb-4" aria-label="Tahapan import">
      {STEPS.map((s, i) => (
        <li
          key={s}
          aria-current={i === current ? "step" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold sm:text-sm",
            i === current ? "bg-primary text-white" : i < current ? "bg-success/12 text-success-ink" : "bg-canvas text-ink-muted"
          )}
        >
          <span className={cn("grid size-5 place-items-center rounded-full text-xs", i === current ? "bg-white/25 text-white" : "bg-surface text-ink")}>
            {i < current ? "✓" : i + 1}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

export default function ImportPage() {
  const qc = useQueryClient();
  const inputRef = useRef(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedImport, setSelectedImport] = useState(null);
  const [step, setStep] = useState(0); // 0: Unggah, 1: Validasi & pratinjau, 2: Pencocokan, 3: Simpan
  const [drag, setDrag] = useState(false);
  const [fileError, setFileError] = useState("");
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);

  const history = useQuery({ queryKey: ["imports"], queryFn: () => listImports({ page: 1, limit: 8 }) });

  const resetWizardState = () => {
    setStep(0);
    setDrag(false);
    setFileError("");
    setPreview(null);
    setMapping({});
    setFilter("all");
    setPage(1);
  };

  const openWizard = () => {
    resetWizardState();
    setWizardOpen(true);
  };

  const closeWizard = () => {
    if (previewM.isPending || saveM.isPending) return;
    setWizardOpen(false);
    resetWizardState();
  };

  const previewM = useMutation({
    mutationFn: previewImport,
    onSuccess: (r) => {
      setPreview(r);
      setMapping({});
      setFilter("all");
      setPage(1);
      setStep(r.columns_ok ? 1 : 0);
    },
    onError: (e) => {
      setPreview(null);
      setFileError(getErrorMessage(e, "File gagal dibaca."));
      setStep(0);
    },
  });

  const saveM = useMutation({
    mutationFn: () => confirmImport(preview.import_id, mapping),
    onSuccess: (r) => {
      toast.success(
        `Hasil import ${r.batch?.filename ?? ""} disimpan (${r.discrepancies_created ?? 0} selisih baru). Stok sistem tidak diubah.`
      );
      ["imports", "discrepancies", "notifications", "report"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      setWizardOpen(false);
      resetWizardState();
    },
    onError: (e) => {
      toast.error(getErrorMessage(e, "Hasil import gagal disimpan."));
    },
  });

  const pick = (file) => {
    if (!file) return;
    setFileError("");
    setPreview(null);
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

  const downloadSample = () =>
    USE_MOCK
      ? downloadCsv(
          "contoh-ekspor-kasir-pintar.csv",
          ["kode_barang", "nama_barang", "stok"],
          [
            ["ACT-001", "Funko Pop! Spider-Man", 25],
            ["PRF-001", "HMNS Eau de Parfum Orion 30ml", 45],
            ["TMB-001", "Stanley Quencher H2.0 40oz", 12],
            ["ACT-0O4", "Funko Pop! Iron Man", 23],
            ["XYZ-999", "Produk Tidak Dikenal", 5],
          ]
        )
      : downloadCsv("format-import-kasir-pintar.csv", ["kode_barang", "nama_barang", "gudang", "stok"], [["CONTOH-001", "Nama barang contoh", "G1", 10]]);

  const columns = [
    { key: "row", header: "Baris", align: "right", cell: (i) => <span className="tabular-nums text-ink-muted">{i.row}</span> },
    {
      key: "file",
      header: "Data di file",
      className: "min-w-40",
      cell: (i) => (
        <div>
          <p className="font-medium">{i.code || "—"}</p>
          <p className="text-xs text-ink-muted">{i.name || "(tanpa nama)"}</p>
        </div>
      ),
    },
    {
      key: "sys",
      header: "Barang di sistem",
      className: "min-w-44",
      cell: (i) =>
        i.product ? (
          <div>
            <p className="font-medium">{i.product.name}</p>
            <p className="text-xs text-ink-muted">
              {i.product.code}
              {i.confirmed ? " · dikonfirmasi" : ""}
            </p>
          </div>
        ) : (
          <span className="text-ink-muted">—</span>
        ),
    },
    ...(items.some((i) => i.scope)
      ? [{ key: "scope", header: "Cakupan", cell: (i) => (i.scope ? i.scope.name : <span className="text-ink-muted">Total</span>) }]
      : []),
    { key: "q1", header: "Stok sistem", align: "right", cell: (i) => <span className="tabular-nums">{i.system_qty ?? "—"}</span> },
    { key: "q2", header: "Stok Kasir", align: "right", cell: (i) => <span className="tabular-nums">{i.qty ?? "—"}</span> },
    {
      key: "diff",
      header: "Selisih",
      align: "right",
      cell: (i) =>
        i.difference === null ? (
          "—"
        ) : (
          <b className={cn("tabular-nums", i.difference === 0 ? "text-success-ink" : i.difference < 0 ? "text-danger-ink" : "text-warning-ink")}>
            {signed(i.difference)}
          </b>
        ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (i) => <StatusBadge tone={IMPORT_ROW_STATUS[i.status].tone}>{IMPORT_ROW_STATUS[i.status].label}</StatusBadge>,
    },
    {
      key: "act",
      header: "Keterangan / Konfirmasi",
      className: "min-w-52",
      cell: (i) =>
        i.status === "CANDIDATE" ? (
          <div>
            <label htmlFor={`map-${i.row}`} className="sr-only">
              Pilih barang untuk baris {i.row}
            </label>
            <select
              id={`map-${i.row}`}
              value={mapping[i.row] ?? ""}
              onChange={(e) => setMapping((m) => ({ ...m, [i.row]: e.target.value }))}
              className="h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm"
            >
              <option value="">Pilih barang yang dimaksud…</option>
              {i.candidates.map((c) => (
                <option key={c.product.id} value={c.product.id}>
                  {c.product.code} — {c.product.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-muted">Nama mirip, kode tidak cocok. Tidak dicocokkan otomatis.</p>
          </div>
        ) : (
          <span className="text-[13px] text-ink-muted">{i.issue || (i.status === "SAME" ? "Jumlah sesuai." : "")}</span>
        ),
    },
  ];

  const unconfirmed = counts.CANDIDATE;

  return (
    <>
      <PageHeader
        title="Import Kasir Pintar"
        description="Unggah file ekspor Kasir Pintar secara manual untuk dibandingkan dengan stok sistem."
        actions={
          <>
            <StatusBadge tone="warning">Data contoh</StatusBadge>
            <Button onClick={openWizard} className="h-12 px-5">
              <FileUp className="size-5" aria-hidden="true" /> Mulai Import File
            </Button>
          </>
        }
      />

      <p className="mb-5 flex items-start gap-3 rounded-card border border-info/30 bg-info/8 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-info-ink" aria-hidden="true" />
        <span>
          <b>Import tidak mengubah stok sistem.</b> Hasilnya hanya dibandingkan dan perbedaannya dicatat sebagai kasus selisih. Barang dicocokkan lewat{" "}
          <b>kode barang</b>; kecocokan berdasarkan nama harus Anda konfirmasi satu per satu.
        </span>
      </p>

      <section className="rounded-card bg-surface p-6 shadow-card" aria-labelledby="riwayat-import">
        <h2 id="riwayat-import" className="mb-3 font-display text-lg font-semibold">
          Riwayat Import
        </h2>
        {history.isLoading ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorState message={getErrorMessage(history.error)} onRetry={history.refetch} />
        ) : (
          <DataTable
            dense
            caption="Riwayat import Kasir Pintar"
            rows={history.data.data}
            emptyTitle="Belum ada import"
            emptyDescription="Klik Mulai Import File untuk membandingkan data Kasir Pintar. Hasil yang disimpan akan tercatat di sini."
            columns={[
              { key: "filename", header: "File", cell: (b) => <span className="font-medium">{b.filename}</span> },
              { key: "by", header: "Diunggah oleh", cell: (b) => b.uploaded_by },
              { key: "at", header: "Waktu", cell: (b) => <span className="whitespace-nowrap">{fmtDateTime(b.created_at)}</span> },
              { key: "tot", header: "Baris", align: "right", cell: (b) => <span className="tabular-nums">{b.total_rows}</span> },
              { key: "ok", header: "Sesuai", align: "right", cell: (b) => <span className="tabular-nums text-success-ink">{b.matched_count}</span> },
              { key: "mm", header: "Berbeda", align: "right", cell: (b) => <span className="tabular-nums text-warning-ink">{b.mismatch_count}</span> },
              { key: "nf", header: "Tidak ditemukan", align: "right", cell: (b) => <span className="tabular-nums text-danger-ink">{b.not_found_count}</span> },
              {
                key: "detail",
                header: "Aksi",
                align: "right",
                cell: (b) => (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedImport(b)}
                    className="h-8 px-3 text-xs"
                  >
                    <Eye className="size-3.5" aria-hidden="true" /> Detail
                  </Button>
                ),
              },
            ]}
          />
        )}
      </section>

      {/* Modal Detail Riwayat Import */}
      <Modal
        open={Boolean(selectedImport)}
        onClose={() => setSelectedImport(null)}
        title="Detail Riwayat Import"
        description={selectedImport?.filename ? `Rincian file ${selectedImport.filename}` : "Rincian file import"}
        className="max-w-4xl"
      >
        {selectedImport && (
          <div className="space-y-4">
            <dl className="grid gap-3 rounded-lg bg-canvas p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-muted">Nama File</dt>
                <dd className="mt-0.5 break-all font-medium">{selectedImport.filename || "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Diunggah oleh</dt>
                <dd className="mt-0.5 font-medium">{selectedImport.uploaded_by || "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Waktu Import</dt>
                <dd className="mt-0.5 font-medium">{selectedImport.created_at ? fmtDateTime(selectedImport.created_at) : "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Total Baris Diproses</dt>
                <dd className="mt-0.5 font-medium tabular-nums">{selectedImport.total_rows ?? 0} baris</dd>
              </div>
            </dl>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line bg-surface p-3">
                <p className="text-xs text-ink-muted">Sesuai</p>
                <p className="mt-1 font-display text-lg font-semibold text-success-ink tabular-nums">
                  {selectedImport.matched_count ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-3">
                <p className="text-xs text-ink-muted">Berbeda Jumlah</p>
                <p className="mt-1 font-display text-lg font-semibold text-warning-ink tabular-nums">
                  {selectedImport.mismatch_count ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-line bg-surface p-3">
                <p className="text-xs text-ink-muted">Tidak Ditemukan</p>
                <p className="mt-1 font-display text-lg font-semibold text-danger-ink tabular-nums">
                  {selectedImport.not_found_count ?? 0}
                </p>
              </div>
            </div>

            {Array.isArray(selectedImport.items) && selectedImport.items.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-canvas">
                    <tr className="text-ink-muted">
                      <th scope="col" className="px-3 py-2 text-right font-medium">Baris</th>
                      <th scope="col" className="px-3 py-2 font-medium">Kode</th>
                      <th scope="col" className="px-3 py-2 font-medium">Nama di File</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Stok Sistem</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Stok Kasir</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Selisih</th>
                      <th scope="col" className="px-3 py-2 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedImport.items.map((row, idx) => (
                      <tr key={row.id ?? row.row ?? idx} className="border-t border-line">
                        <td className="px-3 py-2 text-right tabular-nums text-ink-muted">{row.row ?? idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{row.code || "—"}</td>
                        <td className="px-3 py-2">{row.name || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.system_qty ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.qty ?? "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.difference === null || row.difference === undefined ? (
                            "—"
                          ) : (
                            <b className={cn(row.difference === 0 ? "text-success-ink" : row.difference < 0 ? "text-danger-ink" : "text-warning-ink")}>
                              {signed(row.difference)}
                            </b>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {IMPORT_ROW_STATUS[row.status] ? (
                            <StatusBadge tone={IMPORT_ROW_STATUS[row.status].tone}>{IMPORT_ROW_STATUS[row.status].label}</StatusBadge>
                          ) : (
                            <span className="text-xs text-ink-muted">{row.status || "—"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="rounded-lg bg-canvas p-3 text-xs text-ink-muted">
                Rincian per baris tidak tersimpan pada batch riwayat lama ini; hanya ringkasan jumlah baris yang tersedia.
              </p>
            )}

            <div className="flex justify-end border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setSelectedImport(null)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Pop-up Wizard 4 Tahapan Terpisah */}
      <Modal
        open={wizardOpen}
        onClose={closeWizard}
        busy={previewM.isPending || saveM.isPending}
        title="Import File Kasir Pintar"
        description={`Langkah ${step + 1} dari ${STEPS.length}: ${STEPS[step]}`}
        className="max-w-5xl"
      >
        <Stepper current={step} />

        {/* TAHAP 1: UNGGAH FILE */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-canvas p-4">
              <div>
                <h3 className="font-display text-base font-semibold">1. Unggah file ekspor</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  Format {ACCEPT.join(" / ")}, maksimal {MAX_MB} MB. Kolom wajib: <b>kode_barang</b> dan <b>stok</b>. Opsional: <b>nama_barang</b> dan{" "}
                  <b>gudang</b> (kode atau nama gudang).
                </p>
                <p className="mt-1 text-xs text-ink-muted">Tanpa kolom gudang, perbandingan dilakukan pada tingkat total semua gudang.</p>
              </div>
              <Button variant="secondary" onClick={downloadSample}>
                <Download className="size-4" aria-hidden="true" /> {USE_MOCK ? "Unduh contoh file" : "Unduh format kosong"}
              </Button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-label="Pilih file ekspor Kasir Pintar"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                pick(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-12 text-center transition-colors",
                drag ? "border-primary bg-primary/5" : "border-line"
              )}
            >
              {previewM.isPending ? (
                <LoadingState label="Membaca dan memvalidasi file…" />
              ) : (
                <>
                  <UploadCloud className="size-10 text-ink-muted" aria-hidden="true" />
                  <p className="text-sm font-medium">Tarik dan lepas file di sini, atau</p>
                  <Button onClick={() => inputRef.current?.click()}>
                    <FileSpreadsheet className="size-4" aria-hidden="true" /> Pilih file
                  </Button>
                </>
              )}
            </div>

            {fileError && (
              <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm font-medium text-danger-ink">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {fileError}
              </p>
            )}

            {preview && !preview.columns_ok && (
              <div className="rounded-lg border border-danger/30 bg-danger/5 p-4" role="alert">
                <h4 className="font-display text-base font-semibold text-danger-ink">File tidak dapat diproses ({preview.filename})</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {preview.column_errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-muted">Kolom yang ditemukan: {preview.found_columns.join(", ") || "—"}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={closeWizard} disabled={previewM.isPending}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {/* TAHAP 2: VALIDASI & PRATINJAU */}
        {step === 1 && preview?.columns_ok && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="flex flex-wrap items-center gap-2 font-display text-base font-semibold">
                  2. Validasi & pratinjau
                  <StatusBadge tone="success">File valid · {preview.total_rows} baris</StatusBadge>
                </h3>
                <p className="mt-1 text-sm text-ink-muted">{preview.filename} — pratinjau lima baris pertama sebelum pencocokan:</p>
              </div>
              <Button variant="secondary" onClick={resetWizardState}>
                <RotateCcw className="size-4" aria-hidden="true" /> Ganti File
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[420px] text-left text-sm">
                <caption className="sr-only">Pratinjau lima baris pertama</caption>
                <thead className="bg-canvas">
                  <tr className="text-ink-muted">
                    <th scope="col" className="px-4 py-2.5 font-medium">Baris</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Kode</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Nama</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Gudang</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((p) => (
                    <tr key={p.row} className="border-t border-line">
                      <td className="px-4 py-2.5 tabular-nums text-ink-muted">{p.row}</td>
                      <td className="px-4 py-2.5 font-medium">{p.code || "—"}</td>
                      <td className="px-4 py-2.5">{p.name || "—"}</td>
                      <td className="px-4 py-2.5">{p.warehouse || "Total"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.qty ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={resetWizardState}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke Unggah
              </Button>
              <Button onClick={() => setStep(2)}>
                Lanjut ke Pencocokan <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* TAHAP 3: PENCOCOKAN */}
        {step === 2 && preview?.columns_ok && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-base font-semibold">3. Pencocokan data</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {unconfirmed > 0
                  ? `${unconfirmed} baris kandidat perlu dikonfirmasi manual (tidak dicocokkan otomatis).`
                  : "Semua baris sudah memiliki status kecocokan yang jelas."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter hasil pencocokan">
              {[["all", "Semua", items.length], ...Object.entries(IMPORT_ROW_STATUS).map(([k, v]) => [k, v.label, counts[k]])].map(
                ([k, label, n]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={filter === k}
                    onClick={() => setFilter(k)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold sm:text-sm",
                      filter === k ? "bg-primary text-white" : "bg-canvas text-ink-muted hover:text-ink"
                    )}
                  >
                    {label}
                    <span className={cn("rounded-full px-2 text-xs", filter === k ? "bg-white/20 text-white" : "bg-surface")}>{n}</span>
                  </button>
                )
              )}
            </div>

            <DataTable
              dense
              caption="Hasil pencocokan data import"
              columns={columns}
              rows={shown.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)}
              rowKey="row"
              emptyTitle="Tidak ada baris pada filter ini"
            />
            <Pagination
              page={safePage}
              pageCount={pageCount}
              onChange={(p) => setPage(Math.min(Math.max(1, p), pageCount))}
              summary={`Menampilkan ${shown.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} - ${Math.min(safePage * PAGE_SIZE, shown.length)} dari ${shown.length} baris`}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke Pratinjau
              </Button>
              <Button onClick={() => setStep(3)}>
                Lanjut ke Simpan <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* TAHAP 4: SIMPAN */}
        {step === 3 && preview?.columns_ok && (
          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-canvas p-5">
              <h3 className="font-display text-base font-semibold">4. Konfirmasi & simpan hasil import</h3>
              <p className="mt-1 text-sm text-ink-muted">
                File: <b>{preview.filename}</b> ({preview.total_rows} baris)
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-surface p-3 shadow-card">
                  <p className="text-xs text-ink-muted">Jumlah Sesuai</p>
                  <p className="mt-1 font-display text-xl font-semibold text-success-ink tabular-nums">{counts.SAME} baris</p>
                </div>
                <div className="rounded-lg bg-surface p-3 shadow-card">
                  <p className="text-xs text-ink-muted">Berbeda Jumlah (Kasus Selisih)</p>
                  <p className="mt-1 font-display text-xl font-semibold text-warning-ink tabular-nums">{counts.DIFFERENT} baris</p>
                </div>
                <div className="rounded-lg bg-surface p-3 shadow-card">
                  <p className="text-xs text-ink-muted">Tidak Ditemukan</p>
                  <p className="mt-1 font-display text-xl font-semibold text-danger-ink tabular-nums">
                    {counts.UNMATCHED + counts.CANDIDATE} baris
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-sm text-ink-muted">
                <p>
                  • Sebanyak <b>{counts.DIFFERENT}</b> baris berbeda jumlah akan dicatat sebagai kasus selisih di menu Monitoring Selisih.
                </p>
                {unconfirmed > 0 && (
                  <p className="text-warning-ink">
                    • <b>{unconfirmed}</b> baris kandidat yang belum dikonfirmasi akan disimpan sebagai <b>Tidak Ditemukan</b> (tidak dicocokkan otomatis).
                  </p>
                )}
                <p>
                  • <b>Stok sistem tidak diubah.</b> Setelah disimpan, Anda akan kembali ke halaman awal Import Kasir Pintar.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setStep(2)} disabled={saveM.isPending}>
                <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke Pencocokan
              </Button>
              <Button onClick={() => saveM.mutate()} loading={saveM.isPending} className="h-11 px-6">
                <CheckCircle2 className="size-4" aria-hidden="true" /> Simpan Hasil Import
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
        <Info className="size-3.5" aria-hidden="true" /> Struktur kolom ekspor Kasir Pintar masih menunggu konfirmasi PIC; parser akan disesuaikan.
      </p>
    </>
  );
}