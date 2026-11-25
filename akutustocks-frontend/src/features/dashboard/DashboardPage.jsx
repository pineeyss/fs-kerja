import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Boxes, Search, TrendingUp, TriangleAlert, FileWarning, Package } from "lucide-react";
import StatCard from "@/components/common/StatCard";
import StatusBadge from "@/components/common/StatusBadge";
import StockStatusBadge from "@/components/common/StockStatusBadge";
import DataTable from "@/components/common/DataTable";
import Select from "@/components/ui/Select";
import { useWarehouse } from "@/app/providers/WarehouseContext";
import { ATTENTION_ROWS, FLOW, NEAR_MIN, STOCK_BY_WAREHOUSE } from "./sampleData";

const BAR_COLORS = ["#004aad", "#5585c8", "#8fb0dd"];
const fmtDate = (iso) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

function Card({ title, right, children, className = "" }) {
  return (
    <section className={`rounded-card bg-surface p-6 shadow-card ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { warehouseId } = useWarehouse();
  const [period, setPeriod] = useState("7");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const flow = FLOW[period];
  const totalIn = flow.reduce((s, d) => s + d.masuk, 0);
  const totalOut = flow.reduce((s, d) => s + d.keluar, 0);

  const rows = useMemo(
    () =>
      ATTENTION_ROWS.filter(
        (r) =>
          (warehouseId === "all" || r.warehouseId === warehouseId) &&
          (statusFilter === "all" || r.status === statusFilter) &&
          `${r.name} ${r.code}`.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [warehouseId, statusFilter, query]
  );

  const columns = [
    {
      key: "name",
      header: "Nama Produk",
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Package className="size-4" />
          </span>
          <span className="font-medium">{r.name}</span>
        </div>
      ),
    },
    { key: "code", header: "Kode", cell: (r) => <span className="tabular-nums">{r.code}</span> },
    { key: "warehouse", header: "Gudang" },
    { key: "checkedAt", header: "Tanggal Pengecekan", cell: (r) => fmtDate(r.checkedAt) },
    { key: "qty", header: "Stok", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{r.qty}</span> },
    { key: "min", header: "Min.", align: "right", cell: (r) => <span className="tabular-nums">{r.min}</span> },
    { key: "status", header: "Status", align: "center", cell: (r) => <StockStatusBadge status={r.status} /> },
  ];

  return (
    <>
      <h1 className="sr-only">Dashboard</h1>
      <div className="mb-4 flex justify-end">
        <StatusBadge tone="warning">Data contoh</StatusBadge>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Total Barang"
          value="40"
          unit="SKU"
          caption="1.200 unit"
          icon={Package}
          tone="info"
          footer={
            <>
              <span className="inline-flex items-center gap-1.5 font-semibold text-success-ink">
                <TrendingUp className="size-4" aria-hidden="true" /> 8,5%
              </span>
              <span className="text-ink-muted">Minggu lalu</span>
            </>
          }
        />
        <StatCard
          label="Stok Menipis"
          value="4"
          unit="Barang"
          caption="1 SKU habis"
          icon={Boxes}
          tone="warning"
          footer={
            <span className="inline-flex items-center gap-1.5 font-semibold text-warning-ink">
              <TriangleAlert className="size-4" aria-hidden="true" /> Perlu restok
            </span>
          }
        />
        <StatCard
          label="Selisih Stok"
          value="3"
          unit="Kasus"
          caption="Periksa kembali unit"
          icon={FileWarning}
          tone="danger"
          footer={
            <span className="inline-flex items-center gap-1.5 font-semibold text-danger-ink">
              <TriangleAlert className="size-4" aria-hidden="true" /> Tindak lanjut
            </span>
          }
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Stok per Gudang" right={<span className="rounded-lg bg-canvas px-3 py-1.5 text-xs text-ink-muted">Posisi saat ini</span>}>
          <div role="img" aria-label="Diagram batang stok per gudang">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={STOCK_BY_WAREHOUSE} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e7ec" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={38} />
                <Tooltip formatter={(v) => [`${v} unit`, "Stok"]} cursor={{ fill: "#f7f8fa" }} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={52}>
                  {STOCK_BY_WAREHOUSE.map((d, i) => (
                    <Cell key={d.id} fill={BAR_COLORS[i]} />
                  ))}
                  <LabelList dataKey="total" position="top" fontSize={12} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Satuan: unit. Ringkasan: Gudang 1 memiliki stok terbanyak (476), Gudang 3 paling sedikit (234).</p>
        </Card>

        <Card
          title="Barang Masuk & Keluar"
          right={
            <Select
              label="Periode"
              hideLabel
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={[
                { value: "7", label: "7 Hari Terakhir" },
                { value: "30", label: "30 Hari Terakhir" },
              ]}
              className="w-40"
              selectClassName="h-9 bg-canvas text-xs"
            />
          }
        >
          <p className="mb-2 flex flex-wrap gap-x-4 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#e8456b]" aria-hidden="true" /> {totalIn} unit masuk</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-[#4a3df0]" aria-hidden="true" /> {totalOut} unit keluar</span>
          </p>
          <div role="img" aria-label={`Grafik garis barang masuk ${totalIn} unit dan keluar ${totalOut} unit`}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={flow} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e7ec" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} width={38} />
                <Tooltip />
                <Line type="monotone" dataKey="masuk" name="Masuk" stroke="#e8456b" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="keluar" name="Keluar" stroke="#4a3df0" strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Stok Mendekati Batas Minimum" className="lg:col-span-2 xl:col-span-1">
          <ul className="space-y-3.5">
            {NEAR_MIN.map((p) => {
              const pct = Math.min(100, Math.round((p.qty / p.min) * 100));
              return (
                <li key={p.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">
                      {p.qty} / {p.min}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-sm bg-line" role="img" aria-label={`${pct}% dari batas minimum`}>
                    <div className={pct < 50 ? "h-full bg-danger" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">Stok saat ini dibanding batas minimum. Penuh = sudah mencapai batas.</p>
        </Card>
      </div>

      <section className="mt-5 rounded-card bg-surface p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Barang Perlu Perhatian</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <label htmlFor="cari-perhatian" className="sr-only">Cari nama barang atau kode</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                id="cari-perhatian"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama barang atau kode…"
                className="h-11 w-64 rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm"
              />
            </div>
            <Select
              label="Filter status"
              hideLabel
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "Semua status" },
                { value: "LOW", label: "Stok Menipis" },
                { value: "OUT", label: "Stok Habis" },
              ]}
              className="w-44"
              selectClassName="bg-canvas"
            />
          </div>
        </div>
        <DataTable
          caption="Barang yang stoknya menipis atau habis"
          columns={columns}
          rows={rows}
          emptyTitle="Tidak ada barang yang perlu perhatian"
          emptyDescription="Coba ubah kata kunci, filter status, atau pilihan gudang."
        />
      </section>
    </>
  );
}
