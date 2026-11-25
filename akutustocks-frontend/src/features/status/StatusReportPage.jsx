import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CircleCheck, ClipboardCheck, Clock, Info, Search, SlidersHorizontal } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import Pagination from "@/components/common/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { ACTIVITY_STATUS, ACTIVITY_TYPE } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/api/client";
import { listActivities } from "@/services/api/activities.api";
import { deltaText, fmtDateTime } from "@/features/history/historyUtils";

const PAGE_SIZE = 5;
const ICON = { IN: ArrowDownToLine, OUT: ArrowUpFromLine, TRANSFER_OUT: ArrowLeftRight, TRANSFER_IN: ArrowLeftRight, PHYSICAL_COUNT: ClipboardCheck, ADJUSTMENT: SlidersHorizontal };
const ICON_TONE = { ACCEPTED: "bg-success/12 text-success-ink", REJECTED: "bg-danger/12 text-danger-ink", SUBMITTED: "bg-info/12 text-info-ink" };
const shortId = (id) => `#${String(id).replace(/^c-/, "").slice(-6).toUpperCase()}`;
const TABS = [["all", "Semua"], ["SUBMITTED", "Diajukan"], ["ACCEPTED", "Diterima"], ["REJECTED", "Ditolak"]];

function title(c) {
  const [a, b] = c.items;
  if (c.items.length === 2 && a.activity_type === "TRANSFER_OUT" && b?.activity_type === "TRANSFER_IN") return `Perpindahan — ${a.product.name} (${a.warehouse.code} → ${b.warehouse.code})`;
  return `${ACTIVITY_TYPE[a.activity_type]} — ${a.product.name}${c.items.length > 1 ? ` +${c.items.length - 1} barang` : ""}`;
}

function amount(c) {
  const a = c.items[0];
  if (a.activity_type === "TRANSFER_OUT") return { label: "Kuantitas Ditransfer", text: `${Math.abs(a.qty_after - a.qty_before)} unit` };
  if (a.activity_type === "PHYSICAL_COUNT") return { label: "Hasil Hitung", text: `${a.qty_after} (selisih ${deltaText(a.qty_before, a.qty_after)})` };
  const d = a.qty_after - a.qty_before;
  return { label: d >= 0 ? "Kuantitas Masuk" : "Kuantitas Keluar", text: `${deltaText(a.qty_before, a.qty_after)} unit` };
}

function ActivityCard({ c }) {
  const first = c.items[0];
  const Icon = ICON[first.activity_type] ?? ClipboardCheck;
  const st = ACTIVITY_STATUS[c.status];
  const am = amount(c);
  const needsAction = c.status === "REJECTED" && !c.follow_up_commit_id;
  return (
    <article className="rounded-card bg-surface p-6 shadow-card" aria-label={title(c)}>
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className={cn("grid size-11 shrink-0 place-items-center rounded-xl", ICON_TONE[c.status])}><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-semibold">{title(c)}</h3>
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
            <span className="rounded bg-canvas px-1.5 py-0.5 font-medium">{shortId(c.id)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" /> Diajukan: {fmtDateTime(c.created_at)}</span>
            {c.reviewed_by && <span>Diperiksa oleh {c.reviewed_by}{c.reviewed_at ? ` · ${fmtDateTime(c.reviewed_at)}` : ""}</span>}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink-muted">{am.label}</p>
          <p className={cn("font-display text-lg font-semibold tabular-nums", c.status === "REJECTED" ? "text-danger-ink" : "text-ink")}>{am.text}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 rounded-lg bg-canvas p-4 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-ink-muted">Jenis aktivitas</dt><dd className="font-medium">{[...new Set(c.items.map((i) => ACTIVITY_TYPE[i.activity_type]))].join(", ")}</dd></div>
        <div><dt className="text-xs text-ink-muted">Gudang</dt><dd className="font-medium">{[...new Set(c.items.map((i) => i.warehouse.name))].join(", ")}</dd></div>
        <div><dt className="text-xs text-ink-muted">Jumlah sebelum → sesudah</dt><dd className="font-medium tabular-nums">{c.items.map((i) => `${i.qty_before} → ${i.qty_after}`).join(" · ")}</dd></div>
        {first.reason && <div className="sm:col-span-3"><dt className="text-xs text-ink-muted">Alasan / catatan</dt><dd className="font-medium">{first.reason}</dd></div>}
      </dl>

      {c.review_note && (
        <div className={cn("mt-3 rounded-lg p-4 text-sm", c.status === "REJECTED" ? "bg-danger/8 text-ink" : "bg-success/8 text-ink")}>
          <p className="text-xs font-semibold text-ink-muted">Catatan {c.reviewed_by ?? "SPV"} (Supervisor)</p>
          <p className="mt-1 italic">“{c.review_note}”</p>
        </div>
      )}

      {c.status === "SUBMITTED" && <p className="mt-3 flex items-center gap-2 text-sm text-info-ink"><Info className="size-4 shrink-0" aria-hidden="true" /> Menunggu pemeriksaan SPV. Aktivitas ini sudah berlaku pada stok.</p>}
      {c.status === "ACCEPTED" && <p className="mt-3 flex items-center gap-2 text-sm text-success-ink"><CircleCheck className="size-4 shrink-0" aria-hidden="true" /> Aktivitas telah diperiksa dan diterima SPV.</p>}
      {c.status === "REJECTED" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex max-w-xl items-start gap-2 text-[13px] text-ink-muted"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Penolakan tidak membatalkan perubahan stok. Koreksi dilakukan lewat aktivitas penyesuaian baru; aktivitas ini tetap tersimpan.</p>
          {needsAction ? (
            <Link to={`/transaksi?jenis=ADJUSTMENT&koreksi=${c.id}&produk=${first.product.id}&gudang=${first.warehouse.id}`} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
              <SlidersHorizontal className="size-4" aria-hidden="true" /> Buat Penyesuaian
            </Link>
          ) : (
            <StatusBadge tone="success">Sudah ditindaklanjuti</StatusBadge>
          )}
        </div>
      )}
    </article>
  );
}

export default function StatusReportPage() {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(query);

  const list = useQuery({ queryKey: ["activities", "list", { status, search, page }], queryFn: () => listActivities({ page, limit: PAGE_SIZE, status, search }), placeholderData: keepPreviousData });
  const countQueries = useQueries({
    queries: [
      ...TABS.map(([k]) => ({ queryKey: ["activities", "count", k], queryFn: () => listActivities({ page: 1, limit: 1, status: k }) })),
      { queryKey: ["activities", "count", "needs_action"], queryFn: () => listActivities({ page: 1, limit: 1, needs_action: true }) },
    ],
  });
  const counts = Object.fromEntries(TABS.map(([k], i) => [k, countQueries[i].data?.meta.total]));
  const action = countQueries[TABS.length].data?.meta.total ?? 0;

  const decided = (counts.ACCEPTED ?? 0) + (counts.REJECTED ?? 0);
  const rate = decided ? Math.round(((counts.ACCEPTED ?? 0) / decided) * 1000) / 10 : null;
  const meta = list.data?.meta;
  const rows = list.data?.data ?? [];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-card bg-surface p-6 shadow-card">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-semibold tracking-tight">
            Status Pelaporan & Validasi SPV
            {action > 0 && <StatusBadge tone="danger">{action} Perlu Tindakan</StatusBadge>}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">Pantau hasil pemeriksaan SPV atas aktivitas stok yang Anda catat: Diajukan, Diterima, atau Ditolak.</p>
        </div>
        <dl className="flex gap-6 text-right">
          <div><dt className="text-xs text-ink-muted">Tingkat diterima</dt><dd className="font-display text-2xl font-semibold text-primary">{rate === null ? "—" : `${rate}%`}</dd></div>
          <div className="border-l border-line pl-6"><dt className="text-xs text-ink-muted">Total aktivitas</dt><dd className="font-display text-2xl font-semibold">{counts.all ?? "—"}</dd></div>
        </dl>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-card bg-surface p-4 shadow-card">
        <div role="tablist" aria-label="Filter status" className="flex flex-wrap gap-1">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={status === k} onClick={() => { setStatus(k); setPage(1); }} className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold", status === k ? "bg-primary text-white" : "text-ink-muted hover:bg-canvas hover:text-ink")}>
              {label}<span className={cn("rounded-full px-2 py-0.5 text-xs", status === k ? "bg-white/20" : "bg-canvas")}>{counts[k] ?? "–"}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-56 flex-1">
          <label htmlFor="cari-pelaporan" className="sr-only">Cari barang atau alasan</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input id="cari-pelaporan" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Cari barang atau alasan…" className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm" />
        </div>
      </div>

      {list.isLoading ? (
        <LoadingState label="Memuat status pelaporan…" />
      ) : list.isError ? (
        <div className="rounded-card bg-surface shadow-card"><ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card"><EmptyState title="Belum ada aktivitas pada filter ini" description="Aktivitas yang Anda catat lewat Input Transaksi akan muncul di sini beserta keputusan SPV." /></div>
      ) : (
        <div className="space-y-4">{rows.map((c) => <ActivityCard key={c.id} c={c} />)}</div>
      )}

      <div className="mt-5 rounded-card bg-surface p-4 shadow-card">
        <Pagination page={meta?.page ?? 1} pageCount={meta?.totalPages ?? 1} onChange={(p) => setPage(Math.min(Math.max(1, p), meta?.totalPages ?? 1))} summary={`Menampilkan ${meta?.total ? (meta.page - 1) * meta.limit + 1 : 0} - ${meta ? Math.min(meta.page * meta.limit, meta.total) : 0} dari ${meta?.total ?? 0} aktivitas`} />
      </div>
    </>
  );
}
