import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileUp, FileWarning, Hourglass, TriangleAlert } from "lucide-react";
import StatCard from "@/components/common/StatCard";
import StatusBadge from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/states";
import { useAuth } from "@/features/auth/AuthContext";
import ActivityTypeBadge from "@/features/history/ActivityTypeBadge";
import { fmtDateTime } from "@/features/history/historyUtils";
import { DISCREPANCY_SOURCE } from "@/lib/constants";
import { summarizeProduct } from "@/lib/stock";
import { timeAgo } from "@/lib/utils";
import { activityCode, listActivities } from "@/services/api/activities.api";
import { listDiscrepancies } from "@/services/api/discrepancies.api";
import { listImports } from "@/services/api/imports.api";
import { listProducts } from "@/services/api/products.api";

const signed = (n) => (n > 0 ? `+${n}` : String(n));

function Panel({ title, to, cta, children }) {
  return (
    <section className="rounded-card bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><span className="h-5 w-1 rounded-full bg-primary" aria-hidden="true" /> {title}</h2>
        <Link to={to} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">{cta} <ArrowRight className="size-4" aria-hidden="true" /></Link>
      </div>
      {children}
    </section>
  );
}

export default function SpvDashboard() {
  const { user } = useAuth();
  const queue = useQuery({ queryKey: ["activities", "list", "dash"], queryFn: () => listActivities({ page: 1, limit: 5, status: "SUBMITTED" }) });
  const open = useQuery({ queryKey: ["discrepancies", "dash"], queryFn: () => listDiscrepancies({ page: 1, limit: 5, status: "OPEN" }) });
  const prog = useQuery({ queryKey: ["discrepancies", "count", "IN_PROGRESS"], queryFn: () => listDiscrepancies({ page: 1, limit: 1, status: "IN_PROGRESS" }) });
  const imports = useQuery({ queryKey: ["imports", "last"], queryFn: () => listImports({ page: 1, limit: 1 }) });
  const products = useQuery({ queryKey: ["products"], queryFn: listProducts });

  const list = (products.data ?? []).map(summarizeProduct);
  const low = list.filter((p) => p.status !== "OK").length;
  const last = imports.data?.data?.[0];
  const hour = new Date().getHours();

  return (
    <>
      <section className="mb-5 rounded-card bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold"><span className="rounded-full bg-primary/10 px-3 py-1 text-primary">SUPERVISOR</span><StatusBadge tone="warning">Data contoh</StatusBadge></div>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-primary">{hour < 11 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam"}, {user.name}</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">Periksa aktivitas Staff, tindak lanjuti selisih stok, dan pantau hasil import Kasir Pintar.</p>
      </section>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Menunggu Validasi" value={queue.data?.meta.total ?? "—"} unit="Laporan" icon={Hourglass} tone="warning" footer={<Link to="/aktivitas-staff" className="text-xs font-semibold text-primary underline">Buka antrean</Link>} />
        <StatCard label="Selisih Terbuka" value={open.data?.meta.total ?? "—"} unit="Kasus" icon={FileWarning} tone="danger" caption={`${prog.data?.meta.total ?? 0} kasus dalam proses`} footer={<Link to="/selisih" className="text-xs font-semibold text-primary underline">Monitoring selisih</Link>} />
        <StatCard label="Stok Kritis & Menipis" value={low} unit="Item" icon={TriangleAlert} tone="warning" footer={<Link to="/barang" className="text-xs font-semibold text-primary underline">Data barang</Link>} />
        <StatCard label="Import Terakhir" value={last ? timeAgo(last.created_at) : "—"} icon={FileUp} tone="info" caption={last ? `${last.filename} · ${last.mismatch_count} selisih` : "Belum ada import"} footer={<Link to="/import" className="text-xs font-semibold text-primary underline">Import Kasir Pintar</Link>} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Antrean Validasi" to="/aktivitas-staff" cta="Lihat semua">
          {queue.data?.data.length === 0 ? <EmptyState title="Tidak ada laporan menunggu" description="Semua aktivitas Staff sudah diperiksa." /> : (
            <ul className="divide-y divide-line">
              {(queue.data?.data ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-primary">{activityCode(c.id)}</span><ActivityTypeBadge type={c.items[0].activity_type} /></p>
                    <p className="mt-1 truncate text-sm font-medium">{c.items[0].product.name}</p>
                    <p className="text-xs text-ink-muted">{c.user.name} · {fmtDateTime(c.created_at)}</p>
                  </div>
                  <Link to="/aktivitas-staff" className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark">Tinjau</Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Selisih Terbaru" to="/selisih" cta="Lihat semua">
          {open.data?.data.length === 0 ? <EmptyState title="Tidak ada selisih terbuka" description="Selisih baru muncul dari import atau stok opname." /> : (
            <ul className="divide-y divide-line">
              {(open.data?.data ?? []).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.product.name}</p>
                    <p className="text-xs text-ink-muted">{d.warehouse ? d.warehouse.name : "Total"} · {DISCREPANCY_SOURCE[d.source]} · {timeAgo(d.created_at)}</p>
                  </div>
                  <b className={d.difference < 0 ? "tabular-nums text-danger-ink" : "tabular-nums text-warning-ink"}>{signed(d.difference)} unit</b>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
