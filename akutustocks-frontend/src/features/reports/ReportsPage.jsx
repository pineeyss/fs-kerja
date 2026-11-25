import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Download, Package, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import StatusBadge from "@/components/common/StatusBadge";
import StockStatusBadge from "@/components/common/StockStatusBadge";
import DataTable from "@/components/common/DataTable";
import { LoadingState, ErrorState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useWarehouse } from "@/app/providers/WarehouseContext";
import { MATCH_STATUS } from "@/lib/constants";
import { downloadCsv } from "@/lib/csv";
import { summarizeProduct } from "@/lib/stock";
import { cn, formatNumber } from "@/lib/utils";
import { getErrorMessage } from "@/services/api/client";
import { listProducts } from "@/services/api/products.api";
import { getReportSummary } from "@/services/api/reports.api";
import AnalysisTab from "./AnalysisTab";

const BAR_COLORS = ["#00224f", "#004aad", "#5585c8"];
const DONUT_COLORS = ["#004aad", "#2fb5a8", "#8b5cf6", "#f59e0b", "#3b82f6", "#94a3b8"];
const fmtShort = (iso) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(`${iso}T00:00:00`));
const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "Belum pernah");
const daysAgo = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);

function Card({ title, subtitle, right, children, className }) {
  return (
    <section className={cn("rounded-card bg-surface p-6 shadow-card", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Change({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-xs text-ink-muted">Belum ada pembanding</span>;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold", up ? "text-success-ink" : "text-danger-ink")}>
      <Icon className="size-4" aria-hidden="true" /> {up ? "+" : ""}{pct}%
    </span>
  );
}

/** Saran sederhana berbasis aturan jelas (bukan rekomendasi otomatis): hanya dari jumlah stok. */
function suggestion(p, warehouses) {
  if (p.status === "OUT") return "Restock segera (stok kosong di semua gudang)";
  const empties = warehouses.filter((w) => (p.byWarehouse[w.id] ?? 0) === 0).map((w) => w.code);
  return empties.length ? `Restock · kosong di ${empties.join(", ")}` : "Restock";
}

export default function ReportsPage() {
  const { warehouseId, warehouses } = useWarehouse();
  const [tab, setTab] = useState("laporan");
  const [days, setDays] = useState("30");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  const summary = useQuery({
    queryKey: ["report", { days, warehouseId, category }],
    queryFn: () => getReportSummary({ days: Number(days), warehouse_id: warehouseId, category }),
  });
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const categories = useMemo(() => [...new Set((products.data ?? []).map((p) => p.category).filter(Boolean))].sort(), [products.data]);

  const attention = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products.data ?? [])
      .map(summarizeProduct)
      .filter((p) => p.status !== "OK" && (category === "all" || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)))
      .sort((a, b) => a.total - b.total);
  }, [products.data, category, query]);

  const refresh = () => { summary.refetch(); products.refetch(); };

  const exportCsv = () =>
    downloadCsv(
      "barang-stok-rendah.csv",
      ["Kode", "Nama", "Kategori", ...warehouses.map((w) => w.name), "Total", "Batas Minimum", "Pengecekan Terakhir", "Status", "Saran"],
      attention.map((p) => [p.code, p.name, p.category, ...warehouses.map((w) => p.byWarehouse[w.id] ?? 0), p.total, p.min_stock, fmtDate(p.lastChecked), p.status === "OUT" ? "Stok Habis" : "Stok Menipis", suggestion(p, warehouses)])
    );

  const d = summary.data;
  const grand = d ? d.by_warehouse.reduce((s, w) => s + w.units, 0) : 0;
  const share = (u) => (grand ? Math.round((u / grand) * 1000) / 10 : 0);
  const net = d ? d.totals.in_units - d.totals.out_units : 0;
  const donut = useMemo(() => {
    if (!d) return [];
    const top = d.by_category.slice(0, 5);
    const rest = d.by_category.slice(5).reduce((s, c) => s + c.units, 0);
    return rest ? [...top, { category: "Lainnya", units: rest }] : top;
  }, [d]);
  const donutTotal = donut.reduce((s, c) => s + c.units, 0);
  const maxMoved = d?.top_moved?.[0]?.moved_units ?? 1;

  const attentionColumns = [
    {
      key: "name",
      header: "Produk & SKU",
      className: "min-w-48",
      cell: (p) => (
        <div>
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-ink-muted">{p.code}</p>
        </div>
      ),
    },
    { key: "category", header: "Kategori" },
    {
      key: "dist",
      header: `Distribusi (${warehouses.map((w) => w.code).join(" / ")})`,
      cell: (p) => <span className="whitespace-nowrap tabular-nums">{warehouses.map((w) => p.byWarehouse[w.id] ?? 0).join(" / ")}</span>,
    },
    { key: "total", header: "Total", align: "right", cell: (p) => <b className={cn("tabular-nums", p.total === 0 ? "text-danger-ink" : "text-warning-ink")}>{p.total}</b> },
    { key: "min", header: "Min.", align: "right", cell: (p) => <span className="tabular-nums">{p.min_stock}</span> },
    {
      key: "checked",
      header: "Pengecekan terakhir",
      cell: (p) => (
        <div className="whitespace-nowrap">
          <p>{fmtDate(p.lastChecked)}</p>
          {p.lastChecked && <p className="text-xs text-ink-muted">{daysAgo(p.lastChecked)} hari lalu</p>}
        </div>
      ),
    },
    { key: "status", header: "Status", align: "center", cell: (p) => <StockStatusBadge status={p.status} /> },
    { key: "suggest", header: "Saran tindakan", className: "min-w-44", cell: (p) => <span className="text-[13px]">{suggestion(p, warehouses)}</span> },
  ];

  const tabBtn = (id, label) => (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={tab === id}
      aria-controls={`panel-${id}`}
      onClick={() => setTab(id)}
      className={cn("rounded-md px-4 py-2 text-sm font-semibold transition-colors", tab === id ? "bg-primary text-white" : "text-ink-muted hover:text-ink")}
    >
      {label}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Laporan & Analisis Stok"
        description="Analisis distribusi stok antar gudang, pergerakan barang masuk dan keluar, serta barang yang perlu ditangani."
        actions={<StatusBadge tone="warning">Data contoh</StatusBadge>}
      />

      <div role="tablist" aria-label="Bagian laporan" className="mb-5 inline-flex gap-1 rounded-lg bg-surface p-1 shadow-card">
        {tabBtn("laporan", "Laporan")}
        {tabBtn("analisis", "Analisis")}
      </div>

      {tab === "analisis" ? (
        <div role="tabpanel" id="panel-analisis" aria-labelledby="tab-analisis"><AnalysisTab /></div>
      ) : (
        <div role="tabpanel" id="panel-laporan" aria-labelledby="tab-laporan">
          <section className="mb-5 flex flex-wrap items-center gap-2 rounded-card bg-surface p-4 shadow-card" aria-label="Filter laporan">
            <div className="relative min-w-56 flex-1">
              <label htmlFor="cari-laporan" className="sr-only">Cari nama barang atau kode pada tabel</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input id="cari-laporan" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari barang pada tabel…" className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm" />
            </div>
            <Select label="Kategori" hideLabel value={category} onChange={(e) => setCategory(e.target.value)} options={[{ value: "all", label: "Semua kategori" }, ...categories.map((c) => ({ value: c, label: c }))]} className="w-44" selectClassName="bg-canvas" />
            <Select label="Periode" hideLabel value={days} onChange={(e) => setDays(e.target.value)} options={[{ value: "7", label: "7 hari terakhir" }, { value: "30", label: "30 hari terakhir" }, { value: "90", label: "90 hari terakhir" }]} className="w-44" selectClassName="bg-canvas" />
            <Button variant="ghost" onClick={refresh} className="text-primary">
              <RefreshCw className={cn("size-4", (summary.isFetching || products.isFetching) && "animate-spin")} aria-hidden="true" /> Refresh
            </Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!attention.length}>
              <Download className="size-4" aria-hidden="true" /> Unduh CSV
            </Button>
            {warehouseId !== "all" && <p className="w-full text-[13px] text-ink-muted">Grafik dan ringkasan mengikuti gudang yang dipilih di bagian atas.</p>}
          </section>

          {summary.isLoading ? (
            <LoadingState label="Menyusun laporan…" />
          ) : summary.isError ? (
            <div className="rounded-card bg-surface shadow-card"><ErrorState message={getErrorMessage(summary.error)} onRetry={summary.refetch} /></div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-3">
                <StatCard label="Total Barang" value={d.totals.skus} unit="SKU" caption={`${formatNumber(d.totals.units)} unit`} icon={Package} tone="info" />
                <StatCard
                  label="Barang Masuk"
                  value={formatNumber(d.totals.in_units)}
                  unit="Unit"
                  caption="Total mutasi masuk pada periode"
                  icon={ArrowDownToLine}
                  tone="success"
                  footer={<><Change pct={d.totals.in_change_pct} /><span className="text-ink-muted">vs periode lalu</span></>}
                />
                <StatCard
                  label="Barang Keluar"
                  value={formatNumber(d.totals.out_units)}
                  unit="Unit"
                  caption="Total mutasi keluar pada periode"
                  icon={ArrowUpFromLine}
                  tone="warning"
                  footer={<><Change pct={d.totals.out_change_pct} /><span className="text-ink-muted">vs periode lalu</span></>}
                />
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-5">
                <Card title="Distribusi Stok per Gudang" subtitle="Posisi stok saat ini" right={<span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{formatNumber(grand)} unit</span>} className="lg:col-span-2">
                  <div role="img" aria-label="Diagram batang stok per gudang">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={d.by_warehouse} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e7ec" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} width={38} />
                        <Tooltip formatter={(v) => [`${v} unit`, "Stok"]} cursor={{ fill: "#f7f8fa" }} />
                        <Bar dataKey="units" radius={[6, 6, 0, 0]} maxBarSize={56}>
                          {d.by_warehouse.map((w, i) => <Cell key={w.warehouse_id} fill={BAR_COLORS[i % 3]} />)}
                          <LabelList dataKey="units" position="top" fontSize={12} fontWeight={600} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    {d.by_warehouse.map((w) => (
                      <li key={w.warehouse_id} className="rounded-lg border border-line p-2">
                        <p className="text-ink-muted">{w.name}</p>
                        <p className="mt-0.5 text-base font-semibold tabular-nums">{share(w.units)}%</p>
                        <p className="text-ink-muted">{w.empty_skus} SKU kosong</p>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card title="Tren Barang Masuk vs Keluar" subtitle={`${days} hari terakhir${Number(days) > 31 ? " (per minggu)" : ""}`} className="lg:col-span-3">
                  <p className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[#29a8e0]" aria-hidden="true" /> Masuk ({formatNumber(d.totals.in_units)})</span>
                    <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-ink" aria-hidden="true" /> Keluar ({formatNumber(d.totals.out_units)})</span>
                    <span className="font-semibold text-ink">Selisih bersih: {net > 0 ? "+" : ""}{formatNumber(net)} unit</span>
                  </p>
                  <div role="img" aria-label={`Grafik area barang masuk ${d.totals.in_units} unit dan keluar ${d.totals.out_units} unit`}>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={d.flow} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#29a8e0" stopOpacity={0.35} /><stop offset="100%" stopColor="#29a8e0" stopOpacity={0.02} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e7ec" />
                        <XAxis dataKey="date" tickFormatter={fmtShort} tickLine={false} axisLine={false} fontSize={12} minTickGap={24} />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} width={38} allowDecimals={false} />
                        <Tooltip labelFormatter={fmtShort} formatter={(v, n) => [`${v} unit`, n]} />
                        <Area type="monotone" dataKey="in" name="Masuk" stroke="#29a8e0" strokeWidth={2.5} fill="url(#gIn)" dot={false} />
                        <Area type="monotone" dataKey="out" name="Keluar" stroke="#172033" strokeWidth={2.5} strokeDasharray="6 4" fill="none" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                <Card title="Barang Paling Banyak Bergerak" subtitle={`Total mutasi masuk + keluar, ${days} hari terakhir`}>
                  {d.top_moved.length === 0 ? (
                    <p className="py-8 text-center text-sm text-ink-muted">Belum ada mutasi pada periode ini.</p>
                  ) : (
                    <ol className="space-y-4">
                      {d.top_moved.map((p, i) => (
                        <li key={p.product.code}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="grid size-5 shrink-0 place-items-center rounded bg-accent text-xs font-bold">{i + 1}</span>
                              <span className="truncate">{p.product.name}</span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">{p.moved_units} unit</span>
                          </div>
                          <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-line" aria-hidden="true">
                            <div className={i === 0 ? "h-full bg-primary" : "h-full bg-ink-muted/50"} style={{ width: `${Math.round((p.moved_units / maxMoved) * 100)}%` }} />
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>

                <Card title="Ringkasan Stok Barang" subtitle={`${d.totals.skus} SKU · ${formatNumber(d.totals.units)} unit, per kategori`}>
                  <div className="relative" role="img" aria-label="Diagram donat stok per kategori">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={donut} dataKey="units" nameKey="category" innerRadius={55} outerRadius={80} paddingAngle={2} stroke="none">
                          {donut.map((c, i) => <Cell key={c.category} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [`${v} unit`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                      <div><p className="font-display text-xl font-semibold leading-none">{d.totals.skus}</p><p className="text-xs text-ink-muted">SKU</p></div>
                    </div>
                  </div>
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    {donut.map((c, i) => (
                      <li key={c.category} className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} aria-hidden="true" />
                        <span className="truncate">{c.category}</span>
                        <span className="ml-auto shrink-0 tabular-nums text-ink-muted">{donutTotal ? Math.round((c.units / donutTotal) * 1000) / 10 : 0}%</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <div className="grid gap-5">
                  <Card title="Perpindahan Antar Gudang" right={<span className="rounded-full bg-info/12 px-3 py-1 text-xs font-semibold text-info-ink">{d.transfers.reduce((s, t) => s + t.count, 0)} aktivitas</span>}>
                    {d.transfers.length === 0 ? (
                      <p className="py-3 text-sm text-ink-muted">Belum ada perpindahan pada periode ini.</p>
                    ) : (
                      <ul className="space-y-2">
                        {d.transfers.slice(0, 4).map((t) => (
                          <li key={`${t.from.code}-${t.to.code}`} className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2 text-sm">
                            <span className="inline-flex items-center gap-1.5 font-medium">{t.from.code} <ArrowRight className="size-3.5 text-ink-muted" aria-label="ke" /> {t.to.code}</span>
                            <span className="text-xs text-ink-muted">{t.count} transaksi · {t.units} unit</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  <Card title="Rekonsiliasi Kasir Pintar" right={<span className="text-xs text-ink-muted">Sumber: Kasir Pintar</span>}>
                    {d.reconciliation ? (
                      <>
                        <dl className="grid grid-cols-3 gap-2 text-center">
                          {[["matched", MATCH_STATUS.MATCHED.label, "bg-success/12 text-success-ink"], ["different", MATCH_STATUS.DIFFERENT.label, "bg-warning/18 text-warning-ink"], ["not_found", MATCH_STATUS.UNMATCHED.label, "bg-danger/12 text-danger-ink"]].map(([k, label, cls]) => (
                            <div key={k} className={cn("rounded-lg px-1 py-2", cls)}>
                              <dd className="text-xl font-semibold tabular-nums">{d.reconciliation[k]}</dd>
                              <dt className="text-[11px] font-medium leading-tight">{label}</dt>
                            </div>
                          ))}
                        </dl>
                        {d.reconciliation.differences.length > 0 && (
                          <p className="mt-3 text-xs text-ink-muted">Selisih: {d.reconciliation.differences.map((x) => `${x.name} (${x.diff > 0 ? "+" : ""}${x.diff})`).join(", ")}</p>
                        )}
                        <p className="mt-2 text-xs text-ink-muted">Terakhir diaudit: {fmtDate(d.reconciliation.last_audited_at)}</p>
                      </>
                    ) : (
                      <p className="py-3 text-sm text-ink-muted">Belum ada file Kasir Pintar yang diimpor.</p>
                    )}
                  </Card>
                </div>
              </div>
            </>
          )}

          <section className="mt-5 rounded-card bg-surface p-6 shadow-card">
            <div className="mb-5">
              <h2 className="font-display text-xl font-semibold">Barang Stok Rendah</h2>
              <p className="mt-1 text-sm text-ink-muted">Barang berstatus Menipis atau Habis yang perlu restock atau pengecekan fisik. Tabel mencakup semua gudang.</p>
            </div>
            {products.isLoading ? (
              <LoadingState label="Memuat barang…" />
            ) : products.isError ? (
              <ErrorState message={getErrorMessage(products.error)} onRetry={products.refetch} />
            ) : (
              <>
                <DataTable dense caption="Barang dengan stok menipis atau habis" columns={attentionColumns} rows={attention} emptyTitle="Tidak ada barang stok rendah" emptyDescription="Semua barang di atas batas minimum, atau tidak ada yang cocok dengan pencarian dan filter." />
                <p className="mt-4 border-t border-line pt-4 text-[13px] text-ink-muted">Menampilkan {attention.length} barang yang membutuhkan penanganan.</p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
