import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Package, PlusCircle, Search, Pencil, Trash2, Store } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import StatusBadge from "@/components/common/StatusBadge";
import StockStatusBadge from "@/components/common/StockStatusBadge";
import DataTable from "@/components/common/DataTable";
import Pagination from "@/components/common/Pagination";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { LoadingState, ErrorState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useWarehouse } from "@/app/providers/WarehouseContext";
import { downloadCsv } from "@/lib/csv";
import { summarizeProduct } from "@/lib/stock";
import { cn, formatNumber } from "@/lib/utils";
import { getErrorMessage } from "@/services/api/client";
import * as productsApi from "@/services/api/products.api";
import ProductFormDrawer from "./ProductFormDrawer";
import ProductDetailDrawer from "./ProductDetailDrawer";

const PAGE_SIZE = 8;
const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "—");

export default function ProductsPage() {
  const qc = useQueryClient();
  const { warehouseId, warehouses } = useWarehouse();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["products"], queryFn: productsApi.listProducts });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const products = useMemo(() => (data ?? []).map(summarizeProduct), [data]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);

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
    return products.filter(
      (p) =>
        (warehouseId === "all" || (p.byWarehouse[warehouseId] ?? 0) > 0) &&
        (category === "all" || p.category === category) &&
        (status === "all" || p.status === status) &&
        (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
    );
  }, [products, warehouseId, category, status, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);
  const resetPage = (fn) => (e) => { fn(e.target.value); setPage(1); };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["products"] });

  const saveMutation = useMutation({
    mutationFn: (values) => (editing ? productsApi.updateProduct(editing.id, values) : productsApi.createProduct(values)),
    onSuccess: () => {
      toast.success(editing ? "Data barang berhasil diperbarui." : "Barang berhasil ditambahkan ke katalog.");
      setFormOpen(false);
      setDetail(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (p) => productsApi.deleteProduct(p.id),
    onSuccess: () => { toast.success("Barang dinonaktifkan. Riwayat stoknya tetap tersimpan."); invalidate(); },
    onError: (err) => toast.error(getErrorMessage(err)),
    onSettled: () => setToDelete(null),
  });

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p) => { setEditing(p); setDetail(null); setFormOpen(true); };

  const iconBtn = "grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink";

  const columns = [
    {
      key: "name",
      header: "Produk",
      className: "min-w-52",
      cell: (p) => (
        <button type="button" onClick={() => setDetail(p)} className="flex items-center gap-3 text-left hover:text-primary" aria-label={`Lihat detail ${p.name}`}>
          {p.image_url ? (
            <img src={p.image_url} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
          ) : (
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Package className="size-5" />
            </span>
          )}
          <span className="font-medium">{p.name}</span>
        </button>
      ),
    },
    { key: "code", header: "Kode SKU", cell: (p) => <span className="whitespace-nowrap rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{p.code}</span> },
    { key: "category", header: "Kategori" },
    ...warehouses.map((w) => ({
      key: `wh-${w.id}`,
      header: w.code,
      align: "right",
      className: cn(warehouseId === w.id && "bg-primary/5"),
      cell: (p) => <span className={cn("tabular-nums", (p.byWarehouse[w.id] ?? 0) === 0 && "text-danger-ink")}>{p.byWarehouse[w.id] ?? 0}</span>,
    })),
    { key: "total", header: "Total", align: "right", cell: (p) => <span className="font-semibold tabular-nums text-primary">{formatNumber(p.total)}</span> },
    { key: "min_stock", header: "Min.", align: "right", cell: (p) => <span className="tabular-nums">{p.min_stock}</span> },
    { key: "lastChecked", header: "Tgl Pengecekan", cell: (p) => <span className="whitespace-nowrap">{fmtDate(p.lastChecked)}</span> },
    { key: "status", header: "Status", align: "center", cell: (p) => <StockStatusBadge status={p.status} /> },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <button type="button" className={iconBtn} aria-label={`Ubah ${p.name}`} title="Ubah" onClick={() => openEdit(p)}>
            <Pencil className="size-[18px]" />
          </button>
          <button type="button" className={iconBtn} aria-label={`Nonaktifkan ${p.name}`} title="Nonaktifkan" onClick={() => setToDelete(p)}>
            <Trash2 className="size-[18px]" />
          </button>
        </div>
      ),
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      "data-barang.csv",
      ["Kode", "Nama", "Kategori", ...warehouses.map((w) => w.name), "Total", "Batas Minimum", "Pengecekan Terakhir", "Status"],
      filtered.map((p) => [p.code, p.name, p.category, ...warehouses.map((w) => p.byWarehouse[w.id] ?? 0), p.total, p.min_stock, fmtDate(p.lastChecked), { OK: "Tersedia", LOW: "Stok Menipis", OUT: "Stok Habis" }[p.status]])
    );

  return (
    <>
      <PageHeader
        title="Manajemen Data Barang"
        description={`Kelola katalog master produk, batas minimum stok, dan pantau ketersediaan barang di ${warehouses.length || 3} gudang.`}
        actions={
          <>
            <StatusBadge tone="warning">Data contoh</StatusBadge>
            <Button onClick={openCreate} className="h-12 px-5">
              <PlusCircle className="size-5" aria-hidden="true" /> Tambah Barang
            </Button>
          </>
        }
      />

      {isLoading ? (
        <LoadingState label="Memuat data barang…" />
      ) : isError ? (
        <div className="rounded-card bg-surface shadow-card"><ErrorState message={getErrorMessage(error)} onRetry={refetch} /></div>
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
              value={<>{stats.low} <span className="text-base font-semibold text-warning-ink">Menipis</span> <span className="text-ink-muted">•</span> {stats.out} <span className="text-base font-semibold text-danger-ink">Habis</span></>}
              icon={Package}
              tone="warning"
              footer={<span className="text-xs font-medium text-warning-ink">Segera buat pengajuan restock</span>}
            />
          </div>

          <section className="mt-5 rounded-card bg-surface p-6 shadow-card">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <label htmlFor="cari-barang" className="sr-only">Cari nama barang atau kode</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <input id="cari-barang" value={query} onChange={resetPage(setQuery)} placeholder="Cari nama barang atau kode…" className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm" />
              </div>
              <Select label="Filter kategori" hideLabel value={category} onChange={resetPage(setCategory)} options={[{ value: "all", label: "Semua kategori" }, ...categories.map((c) => ({ value: c, label: c }))]} className="w-44" selectClassName="bg-canvas" />
              <Select
                label="Filter status"
                hideLabel
                value={status}
                onChange={resetPage(setStatus)}
                options={[{ value: "all", label: "Semua status" }, { value: "OK", label: "Tersedia" }, { value: "LOW", label: "Stok Menipis" }, { value: "OUT", label: "Stok Habis" }]}
                className="w-40"
                selectClassName="bg-canvas"
              />
              <Button variant="ghost" onClick={exportCsv} disabled={!filtered.length} className="text-primary">
                <Download className="size-4" aria-hidden="true" /> Ekspor CSV
              </Button>
            </div>
            {warehouseId !== "all" && (
              <p className="mb-3 text-[13px] text-ink-muted">Menampilkan barang yang tersedia di gudang terpilih (kolom gudang disorot). Total dan status tetap dihitung dari semua gudang.</p>
            )}

            <DataTable
              dense
              caption="Daftar barang dan stok per gudang"
              columns={columns}
              rows={pageRows}
              emptyTitle="Tidak ada barang yang cocok"
              emptyDescription="Ubah kata kunci atau filter, atau tambahkan barang baru ke katalog."
            />
            <Pagination page={safePage} pageCount={pageCount} onChange={(p) => setPage(Math.min(Math.max(1, p), pageCount))} summary={`Menampilkan ${from} - ${to} dari ${filtered.length} barang`} />
          </section>
        </>
      )}

      <ProductFormDrawer open={formOpen} product={editing} categories={categories} onClose={() => setFormOpen(false)} onSubmit={(v) => saveMutation.mutateAsync(v)} />
      <ProductDetailDrawer product={detail} warehouses={warehouses} onClose={() => setDetail(null)} onEdit={openEdit} />
      <ConfirmDialog
        open={Boolean(toDelete)}
        tone="danger"
        title="Nonaktifkan barang ini?"
        description={toDelete ? `${toDelete.name} tidak akan muncul di katalog. Riwayat aktivitas stoknya tetap tersimpan.` : ""}
        confirmLabel="Nonaktifkan"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
