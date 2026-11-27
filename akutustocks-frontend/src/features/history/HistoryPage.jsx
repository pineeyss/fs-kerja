import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Eye, GitCommitHorizontal, Search } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import Pagination from "@/components/common/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useWarehouse } from "@/app/providers/WarehouseContext";
import { ACTIVITY_STATUS, ACTIVITY_TYPE } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/api/client";
import * as historyApi from "@/services/api/history.api";
import ActivityTypeBadge from "./ActivityTypeBadge";
import HistoryDetailDrawer from "./HistoryDetailDrawer";
import { deltaText, downloadHistoryCsv, fmtDateTime } from "./historyUtils";

const PAGE_SIZE = 20;
const shortHash = (id) => String(id || "").replace(/^c-/, "").slice(0, 7) || "commit";

export default function HistoryPage() {
  const { warehouseId } = useWarehouse();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [exporting, setExporting] = useState(false);

  const search = useDebouncedValue(query);
  const filters = { search, activity_type: type, status, warehouse_id: warehouseId, date_from: from, date_to: to };
  const filtersKey = JSON.stringify(filters);

  useEffect(() => setPage(1), [filtersKey]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["history", page, filtersKey],
    queryFn: () => historyApi.listHistory({ page, limit: PAGE_SIZE, ...filters }),
    placeholderData: keepPreviousData,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const first = meta?.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const last = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;
  const hasFilter = query || type !== "all" || status !== "all" || from || to;

  // Kelompokkan baris riwayat per commit_id mempertahankan urutan kemunculan
  const commitGroups = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.commit_id || r.id;
      if (!map.has(key)) {
        map.set(key, {
          commit_id: key,
          commit_message: r.commit_message || null,
          created_at: r.created_at,
          user: r.user,
          status: r.status ?? null,
          items: [],
        });
      }
      map.get(key).items.push(r);
    }
    return [...map.values()];
  }, [rows]);

  const reset = () => {
    setQuery("");
    setType("all");
    setStatus("all");
    setFrom("");
    setTo("");
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadHistoryCsv(await historyApi.fetchAllHistory(filters));
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal mengekspor data."));
    } finally {
      setExporting(false);
    }
  };

  const dateInput = "h-11 rounded-lg border border-line bg-canvas px-3 text-sm";

  return (
    <>
      <PageHeader
        title="Riwayat Aktivitas"
        description="Riwayat aktivitas terangkum per commit: satu commit dapat memuat lebih dari satu aktivitas dengan pesan commit opsional. Catatan tidak dapat diubah atau dihapus."
        actions={<StatusBadge tone="warning">Data contoh</StatusBadge>}
      />

      <section className="rounded-card bg-surface p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-end gap-2">
          <div className="relative min-w-56 flex-1">
            <label htmlFor="cari-riwayat" className="sr-only">Cari barang, pengguna, pesan commit, atau alasan</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              id="cari-riwayat"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari barang, pengguna, pesan commit, atau alasan…"
              className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm"
            />
          </div>
          <Select
            label="Jenis aktivitas"
            hideLabel
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={[{ value: "all", label: "Semua jenis" }, ...Object.entries(ACTIVITY_TYPE).map(([value, label]) => ({ value, label }))]}
            className="w-44"
            selectClassName="bg-canvas"
          />
          <Select
            label="Status pelaporan"
            hideLabel
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[{ value: "all", label: "Semua status" }, ...Object.entries(ACTIVITY_STATUS).map(([value, s]) => ({ value, label: s.label }))]}
            className="w-40"
            selectClassName="bg-canvas"
          />
          <div>
            <label htmlFor="tgl-dari" className="mb-1 block text-xs text-ink-muted">Dari tanggal</label>
            <input id="tgl-dari" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
          </div>
          <div>
            <label htmlFor="tgl-sampai" className="mb-1 block text-xs text-ink-muted">Sampai tanggal</label>
            <input id="tgl-sampai" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={dateInput} />
          </div>
          {hasFilter && (
            <Button variant="ghost" onClick={reset}>
              Reset filter
            </Button>
          )}
          <Button variant="ghost" onClick={exportCsv} loading={exporting} disabled={!meta?.total} className="text-primary">
            <Download className="size-4" aria-hidden="true" /> Ekspor CSV
          </Button>
        </div>

        {warehouseId !== "all" && <p className="mb-3 text-[13px] text-ink-muted">Menampilkan aktivitas pada gudang yang dipilih di bagian atas.</p>}

        {isLoading ? (
          <LoadingState label="Memuat riwayat commit…" />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : commitGroups.length === 0 ? (
          <EmptyState
            title="Belum ada aktivitas yang cocok"
            description="Ubah kata kunci atau filter. Commit aktivitas stok akan muncul di sini setelah dicatat."
          />
        ) : (
          <>
            <div className="space-y-4" role="feed" aria-label="Daftar commit riwayat aktivitas">
              {commitGroups.map((grp) => (
                <article key={grp.commit_id} className="overflow-hidden rounded-xl border border-line bg-canvas/50">
                  {/* Header Commit ala GitHub */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 font-mono text-xs font-semibold text-primary">
                        <GitCommitHorizontal className="size-3.5" aria-hidden="true" />
                        {shortHash(grp.commit_id)}
                      </span>
                      <p className="text-sm font-semibold text-ink">
                        {grp.commit_message || <span className="font-normal italic text-ink-muted">Tanpa pesan commit</span>}
                      </p>
                      <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                        {grp.items.length} aktivitas
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-ink-muted">
                      <span>
                        <b className="font-medium text-ink">{grp.user?.name}</b> · {fmtDateTime(grp.created_at)}
                      </span>
                      {grp.status ? (
                        <StatusBadge tone={ACTIVITY_STATUS[grp.status].tone}>{ACTIVITY_STATUS[grp.status].label}</StatusBadge>
                      ) : null}
                    </div>
                  </div>

                  {/* Daftar aktivitas di dalam commit */}
                  <ul className="divide-y divide-line bg-surface">
                    {grp.items.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-canvas/40">
                        <div className="flex min-w-56 flex-1 flex-wrap items-center gap-3">
                          <ActivityTypeBadge type={r.activity_type} />
                          <div>
                            <p className="font-medium">
                              {r.product.name}{" "}
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{r.product.code}</span>
                            </p>
                            <p className="text-xs text-ink-muted">
                              {r.warehouse.name}
                              {r.reason ? ` · Alasan: ${r.reason}` : ""}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="whitespace-nowrap text-right tabular-nums">
                            {r.qty_before} → <b>{r.qty_after}</b>{" "}
                            <span className={cn("text-xs font-semibold", r.qty_after >= r.qty_before ? "text-success-ink" : "text-danger-ink")}>
                              ({deltaText(r.qty_before, r.qty_after)})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setDetail(r)}
                            aria-label={`Lihat detail aktivitas ${r.product.name}`}
                            title="Lihat detail"
                            className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
                          >
                            <Eye className="size-[18px]" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <Pagination
              page={meta?.page ?? 1}
              pageCount={meta?.totalPages ?? 1}
              onChange={(p) => setPage(Math.min(Math.max(1, p), meta?.totalPages ?? 1))}
              summary={`Menampilkan ${first} - ${last} dari ${meta?.total ?? 0} aktivitas (${commitGroups.length} commit pada halaman ini)`}
            />
          </>
        )}
      </section>

      <HistoryDetailDrawer row={detail} onClose={() => setDetail(null)} />
    </>
  );
}