import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Eye, Search } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/common/DataTable";
import Pagination from "@/components/common/Pagination";
import { LoadingState, ErrorState } from "@/components/common/states";
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

const PAGE_SIZE = 10;

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

  // Filter berubah (termasuk gudang di header) → kembali ke halaman 1
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

  const reset = () => { setQuery(""); setType("all"); setStatus("all"); setFrom(""); setTo(""); };

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

  const columns = [
    {
      key: "time",
      header: "Waktu & Pengguna",
      cell: (r) => (
        <div>
          <p className="whitespace-nowrap font-medium">{fmtDateTime(r.created_at)}</p>
          <p className="text-xs text-ink-muted">{r.user.name}</p>
        </div>
      ),
    },
    { key: "type", header: "Jenis", cell: (r) => <ActivityTypeBadge type={r.activity_type} /> },
    {
      key: "product",
      header: "Barang",
      className: "min-w-44",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.product.name}</p>
          <p className="text-xs text-ink-muted">{r.product.code}</p>
        </div>
      ),
    },
    { key: "warehouse", header: "Gudang", cell: (r) => <span className="whitespace-nowrap">{r.warehouse.name}</span> },
    {
      key: "qty",
      header: "Sebelum → Sesudah",
      align: "right",
      cell: (r) => (
        <span className="whitespace-nowrap tabular-nums">
          {r.qty_before} → <b>{r.qty_after}</b>{" "}
          <span className={cn("text-xs font-semibold", r.qty_after >= r.qty_before ? "text-success-ink" : "text-danger-ink")}>({deltaText(r.qty_before, r.qty_after)})</span>
        </span>
      ),
    },
    { key: "reason", header: "Alasan", className: "min-w-40", cell: (r) => <span className="line-clamp-2">{r.reason || "—"}</span> },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (r) => (r.status ? <StatusBadge tone={ACTIVITY_STATUS[r.status].tone}>{ACTIVITY_STATUS[r.status].label}</StatusBadge> : <span className="text-ink-muted" aria-label="Tidak perlu dilaporkan">—</span>),
    },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      cell: (r) => (
        <button type="button" onClick={() => setDetail(r)} aria-label={`Lihat detail aktivitas ${r.product.name}`} title="Lihat detail" className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink">
          <Eye className="size-[18px]" />
        </button>
      ),
    },
  ];

  const dateInput = "h-11 rounded-lg border border-line bg-canvas px-3 text-sm";

  return (
    <>
      <PageHeader
        title="Riwayat Aktivitas"
        description="Jejak setiap perubahan stok: siapa, kapan, di gudang mana, dan berapa jumlah sebelum serta sesudahnya. Catatan tidak dapat diubah atau dihapus."
        actions={<StatusBadge tone="warning">Data contoh</StatusBadge>}
      />

      <section className="rounded-card bg-surface p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-end gap-2">
          <div className="relative min-w-56 flex-1">
            <label htmlFor="cari-riwayat" className="sr-only">Cari barang, pengguna, atau alasan</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input id="cari-riwayat" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari barang, pengguna, atau alasan…" className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm" />
          </div>
          <Select label="Jenis aktivitas" hideLabel value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "all", label: "Semua jenis" }, ...Object.entries(ACTIVITY_TYPE).map(([value, label]) => ({ value, label }))]} className="w-44" selectClassName="bg-canvas" />
          <Select label="Status pelaporan" hideLabel value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: "all", label: "Semua status" }, ...Object.entries(ACTIVITY_STATUS).map(([value, s]) => ({ value, label: s.label }))]} className="w-40" selectClassName="bg-canvas" />
          <div>
            <label htmlFor="tgl-dari" className="mb-1 block text-xs text-ink-muted">Dari tanggal</label>
            <input id="tgl-dari" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={dateInput} />
          </div>
          <div>
            <label htmlFor="tgl-sampai" className="mb-1 block text-xs text-ink-muted">Sampai tanggal</label>
            <input id="tgl-sampai" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={dateInput} />
          </div>
          {hasFilter && <Button variant="ghost" onClick={reset}>Reset filter</Button>}
          <Button variant="ghost" onClick={exportCsv} loading={exporting} disabled={!meta?.total} className="text-primary">
            <Download className="size-4" aria-hidden="true" /> Ekspor CSV
          </Button>
        </div>
        {warehouseId !== "all" && <p className="mb-3 text-[13px] text-ink-muted">Menampilkan aktivitas pada gudang yang dipilih di bagian atas.</p>}

        {isLoading ? (
          <LoadingState label="Memuat riwayat…" />
        ) : isError ? (
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        ) : (
          <>
            <DataTable dense caption="Riwayat aktivitas stok" columns={columns} rows={rows} emptyTitle="Belum ada aktivitas yang cocok" emptyDescription="Ubah kata kunci atau filter. Aktivitas stok akan muncul di sini setelah dicatat." />
            <Pagination page={meta?.page ?? 1} pageCount={meta?.totalPages ?? 1} onChange={(p) => setPage(Math.min(Math.max(1, p), meta?.totalPages ?? 1))} summary={`Menampilkan ${first} - ${last} dari ${meta?.total ?? 0} aktivitas`} />
          </>
        )}
      </section>

      <HistoryDetailDrawer row={detail} onClose={() => setDetail(null)} />
    </>
  );
}
