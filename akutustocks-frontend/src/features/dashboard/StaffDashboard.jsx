import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowLeftRight, ArrowRight, ArrowUpFromLine, ClipboardCheck, Hourglass, Package, Receipt, TriangleAlert } from "lucide-react";
import StatCard from "@/components/common/StatCard";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/states";
import { useAuth } from "@/features/auth/AuthContext";
import ActivityTypeBadge from "@/features/history/ActivityTypeBadge";
import { deltaText, fmtDateTime } from "@/features/history/historyUtils";
import { ACTIVITY_STATUS } from "@/lib/constants";
import { summarizeProduct } from "@/lib/stock";
import { cn } from "@/lib/utils";
import { listActivities } from "@/services/api/activities.api";
import { listHistory } from "@/services/api/history.api";
import { listProducts } from "@/services/api/products.api";

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Selamat Pagi" : h < 15 ? "Selamat Siang" : h < 18 ? "Selamat Sore" : "Selamat Malam";
}

const QUICK = [
  { to: "/transaksi?jenis=IN", title: "Input Barang Masuk", tag: "+ STOK", tagCls: "bg-success/12 text-success-ink", desc: "Catat penerimaan barang ke gudang tujuan.", cta: "Buka Form Penerimaan", Icon: ArrowDownToLine },
  { to: "/transaksi?jenis=OUT", title: "Input Barang Keluar", tag: "− STOK", tagCls: "bg-danger/12 text-danger-ink", desc: "Catat pengeluaran barang dari gudang asal.", cta: "Proses Pengeluaran", Icon: ArrowUpFromLine },
  { to: "/transaksi?jenis=TRANSFER", title: "Perpindahan Gudang", tag: "MUTASI", tagCls: "bg-info/12 text-info-ink", desc: "Pindahkan stok dari satu gudang ke gudang lain.", cta: "Mulai Perpindahan", Icon: ArrowLeftRight },
  { to: "/opname", title: "Stok Opname Fisik", tag: "AUDIT", tagCls: "bg-primary/10 text-primary", desc: "Cocokkan hasil hitung fisik dengan stok sistem.", cta: "Isi Lembar Hitung", Icon: ClipboardCheck },
];

export default function StaffDashboard() {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString("sv-SE");
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });
  const todayQ = useQuery({ queryKey: ["history", "today", today], queryFn: () => listHistory({ page: 1, limit: 1, date_from: today }) });
  const pending = useQuery({ queryKey: ["activities", "count", "SUBMITTED"], queryFn: () => listActivities({ page: 1, limit: 1, status: "SUBMITTED" }) });
  const action = useQuery({ queryKey: ["activities", "count", "needs_action"], queryFn: () => listActivities({ page: 1, limit: 1, needs_action: true }) });
  const recent = useQuery({ queryKey: ["history", "recent"], queryFn: () => listHistory({ page: 1, limit: 5 }) });

  const list = (products.data ?? []).map(summarizeProduct);
  const low = list.filter((p) => p.status !== "OK").length;
  const out = list.filter((p) => p.status === "OUT").length;
  const needsAction = action.data?.meta.total ?? 0;

  const columns = [
    {
      key: "product",
      header: "Informasi Barang",
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Package className="size-5" /></span>
          <div className="min-w-0"><p className="font-medium">{r.product.name}</p><p className="text-xs text-ink-muted">{r.product.code} · {r.warehouse.name}</p></div>
        </div>
      ),
    },
    { key: "type", header: "Tipe", cell: (r) => <span className="inline-flex flex-wrap items-center gap-2"><ActivityTypeBadge type={r.activity_type} /><b className="text-xs tabular-nums">{deltaText(r.qty_before, r.qty_after)}</b></span> },
    { key: "status", header: "Status", align: "center", cell: (r) => (r.status ? <StatusBadge tone={ACTIVITY_STATUS[r.status].tone}>{ACTIVITY_STATUS[r.status].label}</StatusBadge> : <span className="text-ink-muted">—</span>) },
    { key: "time", header: "Waktu", align: "right", cell: (r) => <span className="whitespace-nowrap text-ink-muted">{fmtDateTime(r.created_at)}</span> },
  ];

  return (
    <>
      <section className="mb-5 rounded-card bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">STAFF GUDANG</span>
          <StatusBadge tone="warning">Data contoh</StatusBadge>
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-primary">{greeting()}, {user.name}</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">Pantau ringkasan stok, catat transaksi gudang, dan lihat hasil pemeriksaan SPV atas aktivitas Anda.</p>
        {needsAction > 0 && (
          <Link to="/status-pelaporan" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-danger/10 px-4 py-2 text-sm font-semibold text-danger-ink hover:bg-danger/15">
            <TriangleAlert className="size-4" aria-hidden="true" /> {needsAction} aktivitas ditolak SPV perlu ditindaklanjuti <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </section>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Barang" value={list.length} unit="SKU" icon={Package} tone="info" caption={`${list.reduce((s, p) => s + p.total, 0)} unit di semua gudang`} />
        <StatCard label="Transaksi Saya Hari Ini" value={todayQ.data?.meta.total ?? "—"} unit="Transaksi" icon={Receipt} tone="success" caption="Aktivitas yang Anda catat hari ini" />
        <StatCard label="Stok Kritis & Menipis" value={low} unit="Item" icon={TriangleAlert} tone="danger" footer={<span className="text-xs font-semibold text-danger-ink">{out} barang habis</span>} />
        <StatCard label="Menunggu Validasi" value={pending.data?.meta.total ?? "—"} unit="Pengajuan" icon={Hourglass} tone="warning" footer={<Link to="/status-pelaporan" className="text-xs font-semibold text-primary underline">Lihat status</Link>} />
      </div>

      <h2 className="mb-3 mt-8 flex items-center gap-2 font-display text-lg font-semibold"><span className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" /> Aksi Cepat</h2>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {QUICK.map(({ to, title, tag, tagCls, desc, cta, Icon }) => (
          <Link key={title} to={to} className="group flex flex-col gap-2 rounded-card bg-surface p-5 shadow-card transition hover:ring-2 hover:ring-primary/40">
            <span className="flex items-center justify-between">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></span>
              <span className={cn("rounded px-2 py-0.5 text-[11px] font-bold", tagCls)}>{tag}</span>
            </span>
            <span className="font-display text-base font-semibold">{title}</span>
            <span className="text-sm text-ink-muted">{desc}</span>
            <span className="mt-2 inline-flex items-center gap-1.5 border-t border-line pt-3 text-sm font-semibold text-primary">{cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-card bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><span className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" /> Transaksi Terkini</h2>
          <Link to="/riwayat" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Lihat Semua <ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
        {recent.data?.data.length === 0 ? <EmptyState title="Belum ada transaksi" description="Mulai dengan Aksi Cepat di atas." /> : <DataTable dense caption="Transaksi terbaru Anda" columns={columns} rows={recent.data?.data ?? []} emptyTitle="Memuat…" />}
      </section>
    </>
  );
}
