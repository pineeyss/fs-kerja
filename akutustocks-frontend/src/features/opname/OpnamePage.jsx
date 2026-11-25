import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, Search } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/common/DataTable";
import Pagination from "@/components/common/Pagination";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { LoadingState, ErrorState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useWarehouse } from "@/app/providers/WarehouseContext";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/api/client";
import { listProducts } from "@/services/api/products.api";
import { createCommit } from "@/services/api/transactions.api";

const PAGE_SIZE = 10;
const stockAt = (p, wid) => p.stocks?.find((s) => s.warehouse_id === wid)?.quantity ?? 0;

export default function OpnamePage() {
  const qc = useQueryClient();
  const { warehouses, warehouseId: globalWh } = useWarehouse();
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const [whId, setWhId] = useState(globalWh !== "all" ? globalWh : "");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState({}); // { "<gudang>:<produk>": "12" }
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const wh = warehouses.find((w) => w.id === whId);
  const key = (p) => `${whId}:${p.id}`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products.data ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [products.data, query]);

  const entries = useMemo(
    () =>
      (products.data ?? [])
        .map((p) => ({ p, raw: counts[`${whId}:${p.id}`] }))
        .filter(({ raw }) => raw !== undefined && raw !== "")
        .map(({ p, raw }) => ({ p, counted: Number(raw), system: stockAt(p, whId) })),
    [products.data, counts, whId]
  );
  const invalid = entries.filter((e) => !Number.isInteger(e.counted) || e.counted < 0);
  const diffs = entries.filter((e) => Number.isInteger(e.counted) && e.counted >= 0 && e.counted !== e.system);

  const mutation = useMutation({
    mutationFn: () =>
      createCommit({
        message: note.trim() || undefined,
        items: entries.map((e) => ({ activity_type: "PHYSICAL_COUNT", product_id: e.p.id, warehouse_id: whId, quantity: e.counted, reason: note.trim() || undefined })),
      }),
    onSuccess: (commit) => {
      setConfirmOpen(false);
      toast.success(
        commit.discrepancies_created
          ? `Hasil hitung disimpan. ${commit.discrepancies_created} barang berselisih dicatat sebagai kasus selisih.`
          : "Hasil hitung disimpan. Semua jumlah sesuai dengan stok sistem."
      );
      setCounts((c) => Object.fromEntries(Object.entries(c).filter(([k]) => !k.startsWith(`${whId}:`))));
      setNote("");
      ["products", "history", "activities", "notifications", "report"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (err) => {
      setConfirmOpen(false);
      toast.error(getErrorMessage(err, "Hasil hitung gagal disimpan. Coba lagi."));
    },
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const columns = [
    {
      key: "name",
      header: "Barang",
      className: "min-w-56",
      cell: (p) => (
        <div>
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-ink-muted">{p.code} · {p.category}</p>
        </div>
      ),
    },
    { key: "system", header: "Stok sistem", align: "right", cell: (p) => <span className="tabular-nums">{stockAt(p, whId)}</span> },
    {
      key: "count",
      header: "Hasil hitung fisik",
      align: "right",
      cell: (p) => (
        <>
          <label htmlFor={`hitung-${p.id}`} className="sr-only">Hasil hitung fisik {p.name}</label>
          <input
            id={`hitung-${p.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            value={counts[key(p)] ?? ""}
            onChange={(e) => setCounts((c) => ({ ...c, [key(p)]: e.target.value }))}
            placeholder="—"
            className="h-10 w-28 rounded-lg border border-line bg-surface px-3 text-right text-sm tabular-nums"
          />
        </>
      ),
    },
    {
      key: "diff",
      header: "Selisih",
      align: "center",
      cell: (p) => {
        const raw = counts[key(p)];
        if (raw === undefined || raw === "") return <span className="text-ink-muted" aria-label="Belum dihitung">—</span>;
        const c = Number(raw);
        if (!Number.isInteger(c) || c < 0) return <StatusBadge tone="danger">Tidak valid</StatusBadge>;
        const d = c - stockAt(p, whId);
        return d === 0 ? <StatusBadge tone="success">Sesuai</StatusBadge> : <StatusBadge tone="warning">Selisih {d > 0 ? "+" : ""}{d}</StatusBadge>;
      },
    },
  ];

  if (products.isLoading) return <LoadingState label="Memuat daftar barang…" />;
  if (products.isError) return <div className="rounded-card bg-surface shadow-card"><ErrorState message={getErrorMessage(products.error)} onRetry={products.refetch} /></div>;

  return (
    <>
      <PageHeader title="Stok Opname" description="Hitung stok fisik per gudang, lalu bandingkan dengan stok sistem. Hasil hitung disimpan sebagai pembanding, bukan langsung mengubah stok." />

      <p className="mb-4 flex items-start gap-2 rounded-lg bg-info/10 p-3 text-sm text-info-ink">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Isi hanya barang yang sudah Anda hitung. Barang yang berbeda dari stok sistem dicatat sebagai kasus selisih untuk ditindaklanjuti SPV. Jika stok sistem perlu dikoreksi, buat transaksi Penyesuaian.
      </p>

      <section className="rounded-card bg-surface p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <Select label="Gudang yang dihitung *" value={whId} onChange={(e) => { setWhId(e.target.value); setPage(1); }} options={[{ value: "", label: "Pilih gudang…" }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))]} className="w-56" />
          <div className="relative min-w-56 flex-1">
            <label htmlFor="cari-opname" className="sr-only">Cari nama barang atau kode</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input id="cari-opname" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Cari nama barang atau kode…" className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm" />
          </div>
        </div>

        {!wh ? (
          <p className="rounded-lg bg-canvas p-8 text-center text-sm text-ink-muted">Pilih gudang yang akan dihitung untuk menampilkan lembar hitung.</p>
        ) : (
          <>
            <DataTable dense caption={`Lembar hitung stok ${wh.name}`} columns={columns} rows={rows} emptyTitle="Tidak ada barang yang cocok" emptyDescription="Ubah kata kunci pencarian." rowClassName={(p) => (diffs.some((d) => d.p.id === p.id) ? "bg-warning/5" : undefined)} />
            <Pagination page={safePage} pageCount={pageCount} onChange={(p) => setPage(Math.min(Math.max(1, p), pageCount))} summary={`Menampilkan ${filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} - ${Math.min(safePage * PAGE_SIZE, filtered.length)} dari ${filtered.length} barang`} />

            <div className="mt-5 grid gap-4 border-t border-line pt-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <label htmlFor="catatan-opname" className="mb-1.5 block text-sm font-medium">Catatan pemeriksaan (opsional)</label>
                <textarea id="catatan-opname" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: Hitung ulang rak depan, pemeriksaan rutin bulanan" className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm" />
              </div>
              <div className="flex flex-col gap-2 lg:items-end">
                <p className={cn("text-sm", invalid.length ? "font-medium text-danger-ink" : "text-ink-muted")} aria-live="polite">
                  {invalid.length ? `${invalid.length} isian tidak valid (harus bilangan bulat ≥ 0)` : `${entries.length} barang dihitung · ${diffs.length} berselisih`}
                </p>
                <Button onClick={() => setConfirmOpen(true)} disabled={entries.length === 0 || invalid.length > 0} loading={mutation.isPending} className="h-12 px-8">Simpan Hasil Hitung</Button>
              </div>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Simpan hasil hitung fisik?"
        description={`${entries.length} barang di ${wh?.name ?? ""} akan disimpan sebagai pembanding stok sistem. ${diffs.length ? `${diffs.length} barang berselisih akan dicatat sebagai kasus selisih. ` : "Semua jumlah sesuai. "}Stok sistem tidak berubah otomatis.`}
        confirmLabel="Ya, simpan hasil hitung"
        loading={mutation.isPending}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
