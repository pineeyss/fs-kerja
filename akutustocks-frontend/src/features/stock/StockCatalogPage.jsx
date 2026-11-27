import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Copy, Download, Package, PlusSquare, Search, Store, X } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import StockStatusBadge from "@/components/common/StockStatusBadge";
import DataTable from "@/components/common/DataTable";
import Pagination from "@/components/common/Pagination";
import { LoadingState, ErrorState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useWarehouse } from "@/app/providers/WarehouseContext";
import { useAuth } from "@/features/auth/AuthContext";
import ProductDetailDrawer from "@/features/products/ProductDetailDrawer";
import { ROLES } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { summarizeProduct } from "@/lib/stock";
import { cn, formatNumber } from "@/lib/utils";
import { getErrorMessage } from "@/services/api/client";
import { listProducts } from "@/services/api/products.api";

const PAGE_SIZE = 8;
const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "Belum pernah");
const STATUS_LABEL = { OK: "Tersedia", LOW: "Stok Menipis", OUT: "Stok Habis" };
const SORTS = {
  name: { label: "Nama barang (A–Z)", cmp: (a, b) => a.name.localeCompare(b.name, "id") },
  total_asc: { label: "Stok terendah", cmp: (a, b) => a.total - b.total || a.name.localeCompare(b.name, "id") },
  checked_asc: { label: "Pemeriksaan terlama", cmp: (a, b) => (a.lastChecked ? new Date(a.lastChecked).getTime() : 0) - (b.lastChecked ? new Date(b.lastChecked).getTime() : 0) },
};

export default function StockCatalogPage() {
  const { warehouseId, setWarehouseId, warehouses } = useWarehouse();
  const { user } = useAuth();
  const canRecord = user.role === ROLES.STAFF;
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);

  const reset1 = (fn) => (e) => { fn(e.target.value); setPage(1); };

  const products = useMemo(() => (data ?? []).map(summarizeProduct), [data]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);
  const countIn = (wid) => products.filter((p) => (p.byWarehouse[wid] ?? 0) > 0).length;

  const visibleWarehouses = useMemo(() => {
    if (warehouseId === "all") return warehouses;
    return warehouses.filter((w) => String(w.id) === String(warehouseId));
  }, [warehouses, warehouseId]);

  const stats = useMemo(
    () => ({
      units: products.reduce((s, p) => s + p.total, 0),
      low: products.filter((p) => p.status === "LOW").length,
      out: products.filter((p) => p.status === "OUT").length,
    }),
    [products]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          (warehouseId === "all" || (p.byWarehouse[warehouseId] ?? 0) > 0) &&
          (category === "all" || p.category === category) &&
          (status === "all" || p.status === status) &&
          (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      )
      .sort(SORTS[sort].cmp);
  }, [products, warehouseId, category, status, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);
  const wName = warehouses.find((w) => String(w.id) === String(warehouseId))?.name;

  const chips = [
    warehouseId !== "all" && wName && { label: `Gudang: ${wName}`, clear: () => { setWarehouseId("all"); setPage(1); } },
    category !== "all" && { label: `Kategori: ${category}`, clear: () => { setCategory("all"); setPage(1); } },
    status !== "all" && { label: `Status: ${STATUS_LABEL[status]}`, clear: () => { setStatus("all"); setPage(1); } },
    query.trim() && { label: `Cari: ${query.trim()}`, clear: () => { setQuery(""); setPage(1); } },
  ].filter(Boolean);

  const resetAll = () => {
    setWarehouseId("all");
    setCategory("all");
    setStatus("all");
    setQuery("");
    setPage(1);
  };

  const copy = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Kode ${code} disalin.`);
    } catch {
      toast.error("Tidak dapat menyalin kode.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Produk & Kategori",
      className: "min-w-56",
      cell: (p) => (
        <button type="button" onClick={() => setDetail(p)} className="flex items-center gap-3 text-left hover:text-primary" aria-label={`Lihat detail ${p.name}`}>
          {p.image_url ? (
            <img src={p.image_url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Package className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-ink-muted">{p.category}</p>
          </div>
        </button>
      ),
    },
    {
      key: "code",
      header: "Kode SKU",
      cell: (p) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-primary/10 py-0.5 pl-2 pr-1 text-xs font-semibold text-primary">
          {p.code}
          <button type="button" onClick={() => copy(p.code)} aria-label={`Salin kode ${p.code}`} className="grid size-6 place-items-center rounded hover:bg-primary/10">
            <Copy className="size-3.5" />
          </button>
        </span>
      ),
    },
    ...visibleWarehouses.map((w) => ({
      key: `wh-${w.id}`,
      header: w.code,
      align: "right",
      className: cn(String(warehouseId) === String(w.id) && "bg-primary/5"),
      cell: (p) => <span className={cn("tabular-nums", (p.byWarehouse[w.id] ?? 0) === 0 && "text-danger-ink")}>{p.byWarehouse[w.id] ?? 0}</span>,
    })),
    { key: "total", header: "Total", align: "right", cell: (p) => <b className="tabular-nums text-primary">{formatNumber(p.total)}</b> },
    { key: "min", header: "Min.", align: "right", cell: (p) => <span className="tabular-nums">{p.min_stock}</span> },
    { key: "checked", header: "Pengecekan terakhir", cell: (p) => <span className={cn("whitespace-nowrap", p.status === "OUT" && "font-medium text-danger-ink")}>{fmtDate(p.lastChecked)}</span> },
    { key: "status", header: "Status", align: "center", cell: (p) => <StockStatusBadge status={p.status} /> },
    ...(!canRecord
      ? []
      : [
          {
            key: "act",
            header: "Aksi",
            align: "right",
            cell: (p) => (
              <Link
                to={`/transaksi?produk=${p.id}${warehouseId !== "all" ? `&gudang=${warehouseId}` : ""}`}
                aria-label={`Catat transaksi ${p.name}`}
                title="Catat transaksi"
                className="inline-grid size-9 place-items-center rounded-lg text-primary hover:bg-primary/10"
              >
                <PlusSquare className="size-[18px]" />
              </Link>
            ),
          },
        ]),
  ];

  const exportCsv = () =>
    downloadCsv(
      "manajemen-stok.csv",
      ["Kode", "Nama", "Kategori", ...visibleWarehouses.map((w) => w.name), "Total", "Batas Minimum", "Pengecekan Terakhir", "Status"],
      filtered.map((p) => [
        p.code,
        p.name,
        p.category,
        ...visibleWarehouses.map((w) => p.byWarehouse[w.id] ?? 0),
        p.total,
        p.min_stock,
        fmtDate(p.lastChecked),
        STATUS_LABEL[p.status],
      ])
    );

  const tab = (id, label, count, Icon) => {
    const active = String(warehouseId) === String(id);
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => {
          setWarehouseId(id);
          setPage(1);
        }}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
          active ? "bg-primary text-white" : "text-ink-muted hover:bg-canvas hover:text-ink"
        )}
      >
        <Icon className="size-4" aria-hidden="true" /> {label}
        <span className={cn("rounded-full px-2 py-0.5 text-xs tabular-nums", active ? "bg-white/20 text-white" : "bg-canvas text-ink-muted")}>{count}</span>
      </button>
    );
  };

  return (
    <>
      <PageHeader
        title="Manajemen Stok"
        description={`Pantau katalog stok, batas minimum, dan ketersediaan barang di ${warehouses.length || 3} gudang. Untuk mengubah jumlah, catat transaksi lewat Input Transaksi.`}
      />

      {isLoading ? (
        <LoadingState label="Memuat data stok…" />
      ) : isError ? (
        <div className="rounded-card bg-surface shadow-card">
          <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
        </div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-3">
            <StatCard label="Total Barang" value={products.length} unit="SKU" icon={Package} tone="info" caption={`${formatNumber(stats.units)} unit`} />
            <StatCard
              label={`Total Unit di ${warehouses.length || 3} Gudang`}
              value={formatNumber(stats.units)}
              unit="Unit"
              icon={Store}
              tone="success"
              footer={<span className="text-xs text-ink-muted">Terdistribusi di {warehouses.map((w) => w.code).join(", ")}</span>}
            />
            <StatCard
              label="Status Menipis & Habis"
              value={
                <>
                  {stats.low} <span className="text-base font-semibold text-warning-ink">Menipis</span> <span className="text-ink-muted">•</span> {stats.out}{" "}
                  <span className="text-base font-semibold text-danger-ink">Habis</span>
                </>
              }
              icon={Package}
              tone="warning"
              footer={<span className="text-xs font-medium text-warning-ink">Pantau stok kritis untuk pengajuan restock</span>}
            />
          </div>

          <div className="mt-5 mb-4 flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Pilih gudang" className="inline-flex flex-wrap gap-1 rounded-card bg-surface p-1.5 shadow-card">
              {tab("all", "Semua Gudang", products.length, Building2)}
              {warehouses.map((w) => tab(w.id, w.name, countIn(w.id), Building2))}
            </div>
            <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="size-4" aria-hidden="true" /> Ekspor CSV
            </Button>
          </div>

          <section className="rounded-card bg-surface p-6 shadow-card">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <label htmlFor="cari-katalog" className="sr-only">Cari nama barang atau kode SKU</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <input
                  id="cari-katalog"
                  value={query}
                  onChange={reset1(setQuery)}
                  placeholder="Cari nama barang atau kode SKU…"
                  className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm"
                />
              </div>
              <Select
                label="Kategori"
                hideLabel
                value={category}
                onChange={reset1(setCategory)}
                options={[{ value: "all", label: "Semua kategori" }, ...categories.map((c) => ({ value: c, label: c }))]}
                className="w-44"
                selectClassName="bg-canvas"
              />
              <Select
                label="Status stok"
                hideLabel
                value={status}
                onChange={reset1(setStatus)}
                options={[{ value: "all", label: "Semua status" }, ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))]}
                className="w-40"
                selectClassName="bg-canvas"
              />
              <Select
                label="Urutkan"
                hideLabel
                value={sort}
                onChange={reset1(setSort)}
                options={Object.entries(SORTS).map(([value, s]) => ({ value, label: s.label }))}
                className="w-48"
                selectClassName="bg-canvas"
              />
            </div>

            {chips.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold uppercase tracking-wider text-ink-muted">Filter aktif:</span>
                {chips.map((c) => (
                  <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-3 pr-1 font-semibold text-primary">
                    {c.label}
                    <button type="button" onClick={c.clear} aria-label={`Hapus filter ${c.label}`} className="grid size-5 place-items-center rounded-full hover:bg-primary/10">
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={resetAll} className="font-semibold text-primary underline">
                  Reset filter
                </button>
              </div>
            )}

            {warehouseId !== "all" && (
              <p className="mb-3 text-[13px] text-ink-muted">
                Menampilkan barang yang tersedia di gudang terpilih saja; kolom gudang lain disembunyikan. Total dan status tetap dihitung dari semua gudang.
              </p>
            )}

            <DataTable
              dense
              caption="Katalog stok per gudang"
              columns={columns}
              rows={rows}
              emptyTitle="Tidak ada barang yang cocok"
              emptyDescription="Ubah kata kunci atau filter, atau pilih Semua Gudang."
              rowClassName={(p) => (p.status === "OUT" ? "bg-danger/5" : p.status === "LOW" ? "bg-warning/5" : undefined)}
            />

            <Pagination
              page={safePage}
              pageCount={pageCount}
              onChange={(p) => setPage(Math.min(Math.max(1, p), pageCount))}
              summary={`Menampilkan ${from} - ${to} dari ${filtered.length} barang`}
            />
          </section>
        </>
      )}

      <ProductDetailDrawer product={detail} warehouses={warehouses} onClose={() => setDetail(null)} />
    </>
  );
}