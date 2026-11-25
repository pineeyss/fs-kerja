import { useState } from "react";
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpFromLine, CheckCircle2, ClipboardCheck, Clock, Download, Funnel, Hourglass, Package, RefreshCw, Search, SlidersHorizontal, XCircle } from "lucide-react";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/common/DataTable";
import Pagination from "@/components/common/Pagination";
import { ErrorState, LoadingState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import ActivityTypeBadge from "@/features/history/ActivityTypeBadge";
import { deltaText, fmtDateTime } from "@/features/history/historyUtils";
import { ACTIVITY_STATUS, ACTIVITY_TYPE, ROLE_LABEL } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { useDebouncedValue } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/api/client";
import { activityCode, listActivities, reviewActivity } from "@/services/api/activities.api";

const PAGE_SIZE = 6;
const TYPE_FILTER = { IN: "Barang Masuk", OUT: "Barang Keluar", TRANSFER: "Perpindahan", PHYSICAL_COUNT: "Stok Fisik", ADJUSTMENT: "Penyesuaian" };
const fmtDay = (iso) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
const fmtTime = (iso) => new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Perubahan bersih per aktivitas (perpindahan = jumlah yang dipindah). */
function change(c) {
  const a = c.items[0];
  if (a.activity_type === "TRANSFER_OUT") return { text: `${Math.abs(a.qty_after - a.qty_before)} unit`, tone: "bg-info/12 text-info-ink" };
  if (a.activity_type === "PHYSICAL_COUNT") return { text: `${a.qty_after} (hitung)`, tone: "bg-line text-ink" };
  const d = a.qty_after - a.qty_before;
  return { text: `${deltaText(a.qty_before, a.qty_after)} unit`, tone: d >= 0 ? "bg-success/12 text-success-ink" : "bg-danger/12 text-danger-ink" };
}

function Stat({ label, value, caption, Icon, tone, highlight }) {
  return (
    <section className={cn("rounded-card bg-surface p-5 shadow-card", highlight && "bg-accent/25 ring-1 ring-accent")}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</h2>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}><Icon className="size-5" aria-hidden="true" /></span>
      </div>
      <p className="mt-2 font-display text-[32px] font-semibold leading-tight tabular-nums">{value} <span className="text-xl">Laporan</span></p>
      <p className="mt-1 text-xs text-ink-muted">{caption}</p>
    </section>
  );
}

function ReviewDialog({ commit, decision, onClose, onDone }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const reject = decision === "REJECTED";
  const mutation = useMutation({
    mutationFn: () => reviewActivity(commit.id, { status: decision, review_note: note.trim() }),
    onSuccess: () => { toast.success(reject ? "Aktivitas ditolak. Staff akan diberi tahu." : "Aktivitas diterima."); onDone(); },
    onError: (e) => { setErr(getErrorMessage(e, "Keputusan gagal disimpan.")); },
  });
  const submit = (e) => {
    e.preventDefault();
    if (reject && note.trim().length < 5) return setErr("Catatan penolakan wajib diisi (minimal 5 karakter) agar Staff tahu apa yang perlu dikoreksi.");
    setErr("");
    mutation.mutate();
  };
  return (
    <Modal open={Boolean(commit && decision)} onClose={onClose} busy={mutation.isPending} title={reject ? "Tolak aktivitas?" : "Terima aktivitas?"} description={commit ? `${activityCode(commit.id)} · ${commit.user.name} · ${commit.items[0].product.name}` : ""}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className={cn("rounded-lg p-3 text-[13px]", reject ? "bg-warning/15 text-warning-ink" : "bg-canvas text-ink-muted")}>
          {reject ? "Penolakan TIDAK membatalkan perubahan stok. Staff perlu membuat aktivitas penyesuaian baru dengan alasan; aktivitas awal tetap tersimpan." : "Aktivitas ditandai telah diperiksa. Stok tidak berubah karena aktivitas sudah berlaku saat dicatat."}
        </p>
        <div>
          <label htmlFor="catatan-review" className="mb-1.5 block text-sm font-medium">Catatan {reject ? "penolakan *" : "(opsional)"}</label>
          <textarea id="catatan-review" rows={3} maxLength={300} value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} aria-invalid={err ? true : undefined} aria-describedby={err ? "catatan-review-error" : undefined} className={cn("w-full rounded-lg border bg-surface px-3 py-2.5 text-sm", err ? "border-danger" : "border-line")} placeholder={reject ? "Contoh: Jumlah tidak sesuai bukti, mohon hitung ulang." : "Contoh: Sudah sesuai dokumen penerimaan."} />
          {err && <p id="catatan-review-error" className="mt-1.5 text-[13px] font-medium text-danger-ink">{err}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Batal</Button>
          <Button type="submit" variant={reject ? "danger" : "primary"} loading={mutation.isPending}>{reject ? "Ya, tolak aktivitas" : "Ya, terima aktivitas"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function DetailDrawer({ commit, onClose, onDecide }) {
  const c = commit;
  const st = c ? ACTIVITY_STATUS[c.status] : null;
  return (
    <Drawer
      open={Boolean(c)}
      onClose={onClose}
      title="Detail Aktivitas Staff"
      description="Evaluasi laporan perubahan stok sebelum keputusan."
      footer={
        c?.status === "SUBMITTED" ? (
          <>
            <Button variant="secondary" onClick={onClose}>Tutup</Button>
            <Button variant="danger" onClick={() => onDecide("REJECTED")}><XCircle className="size-4" aria-hidden="true" /> Tolak</Button>
            <Button onClick={() => onDecide("ACCEPTED")}><CheckCircle2 className="size-4" aria-hidden="true" /> Terima</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>Tutup</Button>
        )
      }
    >
      {c && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{activityCode(c.id)}</span>
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          </div>

          <section aria-labelledby="pelaksana">
            <h3 id="pelaksana" className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Informasi pelaksana staff</h3>
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-canvas p-4 text-sm">
              <div><dt className="text-xs text-ink-muted">Nama staff</dt><dd className="font-semibold">{c.user.name}</dd></div>
              <div><dt className="text-xs text-ink-muted">Jabatan</dt><dd className="font-semibold">{ROLE_LABEL[c.user.role] ?? c.user.role}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-ink-muted">Waktu pengajuan</dt><dd className="font-semibold">{fmtDateTime(c.created_at)}</dd></div>
            </dl>
          </section>

          {c.items.map((it, i) => {
            const d = it.qty_after - it.qty_before;
            return (
              <section key={it.id} aria-labelledby={`item-${i}`} className="space-y-3">
                <h3 id={`item-${i}`} className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{c.items.length > 1 ? `Identitas produk & aktivitas (${i + 1}/${c.items.length})` : "Identitas produk & aktivitas"}</h3>
                <div className="flex gap-4 rounded-lg border border-line p-4">
                  <span aria-hidden="true" className="grid size-20 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Package className="size-8" /></span>
                  <div className="min-w-0">
                    <ActivityTypeBadge type={it.activity_type} />
                    <p className="mt-2 font-display font-semibold leading-snug">{it.product.name}</p>
                    <p className="text-sm text-ink-muted">Kode SKU: <b className="text-ink">{it.product.code}</b> · {it.product.category}</p>
                    <p className="text-sm text-ink-muted">Lokasi: <b className="text-ink">{it.warehouse.name}</b></p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center" role="group" aria-label="Komparasi stok">
                  <div className="rounded-lg border border-line p-3"><p className="text-xs text-ink-muted">Stok sebelum</p><p className="font-display text-xl font-semibold tabular-nums">{it.qty_before}</p></div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="text-xs text-primary">{it.activity_type === "PHYSICAL_COUNT" ? "Selisih hitung" : "Perubahan"}</p><p className="font-display text-xl font-semibold tabular-nums text-primary">{deltaText(it.qty_before, it.qty_after)}</p></div>
                  <div className="rounded-lg border border-line p-3"><p className="text-xs text-ink-muted">{it.activity_type === "PHYSICAL_COUNT" ? "Hasil hitung" : "Stok sesudah"}</p><p className={cn("font-display text-xl font-semibold tabular-nums", d < 0 ? "text-danger-ink" : "text-success-ink")}>{it.qty_after}</p></div>
                </div>
                {it.reason && <p className="rounded-lg bg-canvas p-3 text-sm"><span className="text-xs text-ink-muted">Alasan / catatan</span><br />{it.reason}</p>}
              </section>
            );
          })}

          {c.status !== "SUBMITTED" && (
            <section aria-labelledby="keputusan" className="space-y-2">
              <h3 id="keputusan" className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Keputusan</h3>
              <p className="text-sm">Diperiksa oleh <b>{c.reviewed_by ?? "SPV"}</b>{c.reviewed_at ? ` · ${fmtDateTime(c.reviewed_at)}` : ""}</p>
              {c.review_note && <p className={cn("rounded-lg p-3 text-sm italic", c.status === "REJECTED" ? "bg-danger/8" : "bg-success/8")}>“{c.review_note}”</p>}
              {c.status === "REJECTED" && <p className="text-[13px] text-ink-muted">Penolakan tidak membatalkan perubahan stok; Staff membuat penyesuaian baru.</p>}
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

export default function ActivityValidationPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("SUBMITTED");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [decision, setDecision] = useState(null);
  const [exporting, setExporting] = useState(false);
  const search = useDebouncedValue(query);
  const filters = { status, search, activity_type: type, date_from: from, date_to: to };
  const key = JSON.stringify(filters);
  const setF = (fn) => (e) => { fn(e.target.value); setPage(1); };

  const list = useQuery({ queryKey: ["activities", "list", key, page], queryFn: () => listActivities({ page, limit: PAGE_SIZE, ...filters }), placeholderData: keepPreviousData });
  const counts = useQueries({ queries: ["all", "SUBMITTED", "ACCEPTED", "REJECTED"].map((k) => ({ queryKey: ["activities", "count", k], queryFn: () => listActivities({ page: 1, limit: 1, status: k }) })) });
  const [total, pending, accepted, rejected] = counts.map((q) => q.data?.meta.total);
  const decided = (accepted ?? 0) + (rejected ?? 0);
  const pct = (n) => (decided ? `${Math.round(((n ?? 0) / decided) * 1000) / 10}%` : "—");
  const meta = list.data?.meta;
  const rows = list.data?.data ?? [];

  // jaga panel detail tetap segar setelah keputusan
  const done = () => { setDecision(null); setDetail(null); ["activities", "notifications", "history"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = []; let p = 1, tp = 1;
      do { const r = await listActivities({ ...filters, page: p, limit: 10 }); all.push(...r.data); tp = r.meta?.totalPages ?? 1; p += 1; } while (p <= tp && p <= 100);
      downloadCsv("validasi-aktivitas-staff.csv", ["ID", "Staff", "Jenis", "Kode", "Barang", "Gudang", "Sebelum", "Sesudah", "Perubahan", "Waktu", "Status", "Catatan SPV"], all.flatMap((c) => c.items.map((i) => [activityCode(c.id), c.user.name, ACTIVITY_TYPE[i.activity_type], i.product.code, i.product.name, i.warehouse.name, i.qty_before, i.qty_after, deltaText(i.qty_before, i.qty_after), fmtDateTime(c.created_at), ACTIVITY_STATUS[c.status]?.label, c.review_note ?? ""])));
    } catch (e) { toast.error(getErrorMessage(e, "Gagal mengekspor log.")); } finally { setExporting(false); }
  };

  const columns = [
    {
      key: "id", header: "ID Aktivitas",
      cell: (c) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); setDetail(c); }} className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-primary hover:underline" aria-label={`Buka detail ${activityCode(c.id)}`}>
          {c.status === "SUBMITTED" && <span className="size-2 rounded-full bg-warning" aria-hidden="true" />}{activityCode(c.id)}
        </button>
      ),
    },
    { key: "staff", header: "Nama Staff", cell: (c) => <div><p className="font-medium">{c.user.name}</p><p className="text-xs text-ink-muted">{ROLE_LABEL[c.user.role]}</p></div> },
    { key: "type", header: "Jenis Aktivitas", cell: (c) => <ActivityTypeBadge type={c.items[0].activity_type === "TRANSFER_OUT" ? "TRANSFER_OUT" : c.items[0].activity_type} /> },
    { key: "product", header: "Nama Barang & SKU", className: "min-w-44", cell: (c) => <div><p className="font-medium">{c.items[0].product.name}</p><p className="text-xs text-ink-muted">SKU: {c.items[0].product.code}{c.items.length > 2 ? ` · +${c.items.length - 1} item` : ""}</p></div> },
    {
      key: "wh", header: "Gudang",
      cell: (c) => c.items.length === 2 && c.items[0].activity_type === "TRANSFER_OUT"
        ? <span className="inline-flex items-center gap-1 whitespace-nowrap">{c.items[0].warehouse.code} <ArrowRight className="size-3.5 text-ink-muted" aria-label="ke" /> {c.items[1].warehouse.code}</span>
        : <span className="whitespace-nowrap">{c.items[0].warehouse.name}</span>,
    },
    { key: "chg", header: "Jumlah Perubahan", align: "center", cell: (c) => { const ch = change(c); return <span className={cn("inline-block whitespace-nowrap rounded-lg px-3 py-1 text-xs font-bold tabular-nums", ch.tone)}>{ch.text}</span>; } },
    { key: "time", header: "Tanggal/Waktu", cell: (c) => <div className="whitespace-nowrap"><p>{fmtDay(c.created_at)}</p><p className="text-xs text-ink-muted">{fmtTime(c.created_at)} WIB</p></div> },
    { key: "status", header: "Status Laporan", align: "center", cell: (c) => <StatusBadge tone={ACTIVITY_STATUS[c.status].tone}>{ACTIVITY_STATUS[c.status].label}</StatusBadge> },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-semibold tracking-tight">
            Validasi Aktivitas Staff
            {pending > 0 && <StatusBadge tone="warning">{pending} Laporan Menunggu Keputusan</StatusBadge>}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">Tinjau dan berikan keputusan terhadap laporan perubahan stok dari Staff.</p>
        </div>
        <StatusBadge tone="warning" className="ml-auto">Data contoh</StatusBadge>
      </div>

      <section className="mb-5 rounded-card bg-surface p-5 shadow-card" aria-label="Pencarian dan filter lanjutan">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"><Funnel className="size-4 text-primary" aria-hidden="true" /> Pencarian & filter lanjutan</h2>
          <p className="text-xs text-ink-muted">Menampilkan hasil sesuai parameter aktif</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-60 flex-1">
            <label htmlFor="cari-validasi" className="mb-1 block text-xs text-ink-muted">Cari laporan / barang / staff</label>
            <Search className="pointer-events-none absolute bottom-3.5 left-3 size-4 text-ink-muted" aria-hidden="true" />
            <input id="cari-validasi" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Cari ID, staf, kode, nama barang…" className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm" />
          </div>
          <Select label="Status laporan" value={status} onChange={setF(setStatus)} options={[{ value: "SUBMITTED", label: "Diajukan (Prioritas)" }, { value: "all", label: "Semua status" }, { value: "ACCEPTED", label: "Diterima" }, { value: "REJECTED", label: "Ditolak" }]} className="w-48" selectClassName="bg-canvas" />
          <Select label="Jenis aktivitas" value={type} onChange={setF(setType)} options={[{ value: "all", label: "Semua aktivitas" }, ...Object.entries(TYPE_FILTER).map(([value, label]) => ({ value, label }))]} className="w-44" selectClassName="bg-canvas" />
          <div><label htmlFor="v-dari" className="mb-1 block text-xs text-ink-muted">Dari tanggal</label><input id="v-dari" type="date" value={from} max={to || undefined} onChange={setF(setFrom)} className="h-11 rounded-lg border border-line bg-canvas px-3 text-sm" /></div>
          <div><label htmlFor="v-sampai" className="mb-1 block text-xs text-ink-muted">Sampai tanggal</label><input id="v-sampai" type="date" value={to} min={from || undefined} onChange={setF(setTo)} className="h-11 rounded-lg border border-line bg-canvas px-3 text-sm" /></div>
          <Button variant="secondary" onClick={() => { list.refetch(); counts.forEach((q) => q.refetch()); }} aria-label="Muat ulang data" title="Muat ulang"><RefreshCw className={cn("size-4", list.isFetching && "animate-spin")} /></Button>
        </div>
      </section>

      <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total laporan" value={total ?? "—"} caption="Seluruh aktivitas Staff yang tercatat" Icon={ClipboardCheck} tone="bg-primary/10 text-primary" />
        <Stat label="Menunggu pemeriksaan" value={pending ?? "—"} caption="Status Diajukan (wajib diperiksa SPV)" Icon={Hourglass} tone="bg-warning/25 text-warning-ink" highlight />
        <Stat label="Diterima" value={accepted ?? "—"} caption={`${pct(accepted)} dari laporan yang sudah diputuskan`} Icon={CheckCircle2} tone="bg-success/12 text-success-ink" />
        <Stat label="Ditolak" value={rejected ?? "—"} caption={`${pct(rejected)} memerlukan penyesuaian Staff`} Icon={XCircle} tone="bg-danger/12 text-danger-ink" />
      </div>

      <section className="rounded-card bg-surface p-6 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Daftar Laporan Aktivitas Perubahan Stok <span className="text-sm font-normal text-ink-muted">({status === "all" ? "Semua status" : `Status: ${ACTIVITY_STATUS[status].label}`})</span></h2>
            <p className="text-sm text-ink-muted">Aktivitas Staff langsung berlaku pada stok saat dicatat; di sini SPV memeriksanya.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <span>Menampilkan <b>{meta?.total ? (meta.page - 1) * meta.limit + 1 : 0}-{meta ? Math.min(meta.page * meta.limit, meta.total) : 0}</b> dari <b>{meta?.total ?? 0}</b> laporan</span>
            <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={!meta?.total}><Download className="size-4" aria-hidden="true" /> Ekspor Log</Button>
          </div>
        </div>
        {list.isLoading ? <LoadingState label="Memuat laporan…" /> : list.isError ? <ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} /> : (
          <>
            <DataTable dense caption="Daftar laporan aktivitas Staff" columns={columns} rows={rows} onRowClick={setDetail} rowClassName={(c) => (c.status === "SUBMITTED" ? "bg-warning/5" : undefined)} emptyTitle="Tidak ada laporan pada filter ini" emptyDescription="Ubah status, jenis aktivitas, atau rentang tanggal." />
            <Pagination page={meta?.page ?? 1} pageCount={meta?.totalPages ?? 1} onChange={(p) => setPage(Math.min(Math.max(1, p), meta?.totalPages ?? 1))} summary={`Menampilkan data laporan ${meta?.total ? (meta.page - 1) * meta.limit + 1 : 0} sampai ${meta ? Math.min(meta.page * meta.limit, meta.total) : 0} dari total ${meta?.total ?? 0} aktivitas`} />
          </>
        )}
      </section>

      <p className="mt-5 flex items-start gap-3 rounded-card border border-warning/40 bg-warning/10 p-4 text-sm">
        <Clock className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden="true" />
        <span><b>Ketentuan alur validasi:</b> aktivitas Staff sudah berlaku pada stok saat dicatat. Keputusan <b>Terima</b> menandai aktivitas telah diperiksa. Keputusan <b>Tolak</b> tidak membatalkan stok; Staff membuat aktivitas penyesuaian baru dengan alasan, dan aktivitas awal tetap tersimpan sebagai jejak.</span>
      </p>

      <DetailDrawer commit={detail} onClose={() => setDetail(null)} onDecide={setDecision} />
      <ReviewDialog commit={detail} decision={decision} onClose={() => setDecision(null)} onDone={done} />
    </>
  );
}
