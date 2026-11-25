import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bell, CalendarClock, CheckCheck, ClipboardCheck, Clock, FileWarning, Info, Mail, RotateCcw, Search, TriangleAlert } from "lucide-react";
import StatusBadge from "@/components/common/StatusBadge";
import Pagination from "@/components/common/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useAuth } from "@/features/auth/AuthContext";
import { ROLES } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { cn, timeAgo } from "@/lib/utils";
import { getErrorMessage } from "@/services/api/client";
import { ACTIONABLE, listNotifications, markAllNotificationsRead, markNotificationRead } from "@/services/api/notifications.api";

const PAGE_SIZE = 10;
const TABS = [["all", "Semua"], ["activity", "Aktivitas Staff"], ["discrepancy", "Selisih Stok"], ["schedule", "Pengingat Pemeriksaan"], ["stock", "Stok Menipis"]];

const TYPE = {
  ACTIVITY_SUBMITTED: { tag: "Aktivitas Staff · Validasi Baru", title: "Laporan aktivitas Staff menunggu validasi", Icon: ClipboardCheck, border: "border-l-primary", tagCls: "bg-primary/10 text-primary", iconCls: "bg-primary/10 text-primary" },
  ACTIVITY_REVIEWED: { tag: "Keputusan Pemeriksaan", title: "Keputusan pemeriksaan aktivitas", Icon: CheckCheck, border: "border-l-success", tagCls: "bg-success/12 text-success-ink", iconCls: "bg-success/12 text-success-ink" },
  DISCREPANCY_NEW: { tag: "Selisih Stok", title: "Selisih stok baru terdeteksi", Icon: FileWarning, border: "border-l-danger", tagCls: "bg-danger/12 text-danger-ink", iconCls: "bg-danger/12 text-danger-ink" },
  CHECK_SCHEDULE: { tag: "Pengingat Pemeriksaan", title: "Pengingat pemeriksaan stok", Icon: CalendarClock, border: "border-l-warning", tagCls: "bg-warning/18 text-warning-ink", iconCls: "bg-warning/18 text-warning-ink" },
  LOW_STOCK: { tag: "Stok Menipis", title: "Peringatan stok menipis", Icon: AlertTriangle, border: "border-l-warning", tagCls: "bg-warning/18 text-warning-ink", iconCls: "bg-warning/18 text-warning-ink" },
};

/** Tujuan + label tombol per jenis notifikasi, menyesuaikan role. */
function action(type, role) {
  const staff = role === ROLES.STAFF;
  if (type === "ACTIVITY_SUBMITTED") return { to: "/aktivitas-staff", label: "Tinjau di Validasi" };
  if (type === "ACTIVITY_REVIEWED") return staff ? { to: "/status-pelaporan", label: "Lihat Status Pelaporan" } : { to: "/riwayat", label: "Lihat Riwayat Aktivitas" };
  if (type === "DISCREPANCY_NEW") return role === ROLES.SPV ? { to: "/selisih", label: "Buka Monitoring Selisih" } : { to: "/riwayat", label: "Lihat Riwayat Aktivitas" };
  if (type === "CHECK_SCHEDULE") return staff ? { to: "/opname", label: "Mulai Stok Opname" } : null;
  if (type === "LOW_STOCK") return { to: staff ? "/manajemen-stok" : "/barang", label: "Buka Data Barang" };
  return null;
}

const dayKey = (iso) => new Date(iso).toLocaleDateString("sv-SE");
function groupLabel(iso) {
  const d = dayKey(iso);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d === today.toLocaleDateString("sv-SE")) return "Hari ini";
  if (d === yest.toLocaleDateString("sv-SE")) return "Kemarin";
  return "Sebelumnya";
}
const dateFrom = (v) => (v === "all" ? "" : new Date(Date.now() - (v === "today" ? 0 : v === "7d" ? 6 : 29) * 86400000).toLocaleDateString("sv-SE"));
const fmtClock = (iso) => new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) + " WIB";

export default function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(query);
  const params = { category: tab, search, date_from: dateFrom(when), is_read: readFilter === "all" ? undefined : readFilter === "read" };
  const key = JSON.stringify(params);

  const list = useQuery({ queryKey: ["notifications", "list", key, page], queryFn: () => listNotifications({ page, limit: PAGE_SIZE, ...params }), placeholderData: keepPreviousData });
  const totals = useQueries({
    queries: [
      { queryKey: ["notifications", "count", "all"], queryFn: () => listNotifications({ page: 1, limit: 1 }) },
      ...TABS.map(([k]) => ({ queryKey: ["notifications", "count", "unread", k], queryFn: () => listNotifications({ page: 1, limit: 1, category: k, is_read: false }) })),
      { queryKey: ["notifications", "count", "unread-items"], queryFn: () => listNotifications({ page: 1, limit: 50, is_read: false }) },
    ],
  });
  const total = totals[0].data?.meta.total;
  const unreadBy = Object.fromEntries(TABS.map(([k], i) => [k, totals[i + 1].data?.meta.total ?? 0]));
  const needAction = (totals[TABS.length + 1].data?.data ?? []).filter((n) => ACTIONABLE.includes(n.type)).length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const readOne = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });

  const meta = list.data?.meta;
  const rows = list.data?.data ?? [];
  const groups = useMemo(() => {
    const g = [];
    rows.forEach((n) => {
      const label = groupLabel(n.created_at);
      const last = g[g.length - 1];
      if (last?.label === label) last.items.push(n); else g.push({ label, items: [n] });
    });
    return g;
  }, [rows]);
  const hasFilter = tab !== "all" || query || when !== "all" || readFilter !== "all";
  const reset = () => { setTab("all"); setQuery(""); setWhen("all"); setReadFilter("all"); setPage(1); };
  const f = (fn) => (e) => { fn(e.target.value); setPage(1); };

  const kpi = (label, value, unit, caption, Icon, cls) => (
    <section className="rounded-card bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between"><h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</h2><span className={cn("grid size-10 place-items-center rounded-xl", cls)}><Icon className="size-5" aria-hidden="true" /></span></div>
      <p className="mt-2 font-display text-[32px] font-semibold leading-tight tabular-nums">{value ?? "—"} <span className={cn("text-sm font-semibold", cls.replace(/bg-\S+/g, ""))}>{unit}</span></p>
      <p className="mt-1 text-xs text-ink-muted">{caption}</p>
    </section>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-semibold tracking-tight">
            Notifikasi & Pengingat
            {unreadBy.all > 0 && <StatusBadge tone="info">{unreadBy.all} Belum Dibaca</StatusBadge>}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{user.role === ROLES.STAFF ? "Pantau keputusan pemeriksaan SPV, jadwal pemeriksaan, dan kondisi persediaan." : "Pantau aktivitas terbaru, kondisi persediaan, dan pemberitahuan yang membutuhkan perhatian Anda."}</p>
        </div>
        <Button variant="secondary" className="ml-auto" onClick={() => readAll.mutate()} loading={readAll.isPending} disabled={!unreadBy.all}><CheckCheck className="size-4" aria-hidden="true" /> Tandai Semua Sudah Dibaca</Button>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {kpi("Total notifikasi", total, "Tercatat", "Seluruh notifikasi pada akun Anda", Bell, "bg-primary/10 text-primary")}
        {kpi("Belum dibaca", unreadBy.all, "Perlu dicek", "Belum dibuka (butuh dilihat)", Mail, "bg-warning/25 text-warning-ink")}
        {kpi("Perlu tindakan", needAction, "Prioritas", "Memerlukan validasi, pemeriksaan, atau restock", TriangleAlert, "bg-danger/12 text-danger-ink")}
      </div>
      <p className="mb-5 mt-2 flex items-center gap-2 text-xs text-ink-muted"><Info className="size-3.5" aria-hidden="true" /> Notifikasi belum dibaca tidak otomatis memerlukan tindakan operasional.</p>

      <section className="mb-5 rounded-card bg-surface p-5 shadow-card" aria-label="Filter notifikasi">
        <div role="tablist" aria-label="Kategori notifikasi" className="flex flex-wrap gap-1 border-b border-line pb-3">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPage(1); }} className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold", tab === k ? "bg-primary text-white" : "text-ink-muted hover:bg-canvas hover:text-ink")}>
              {label}
              <span className={cn("rounded-full px-2 py-0.5 text-xs", tab === k ? "bg-white/20" : "bg-canvas")}>{k === "all" ? `${unreadBy[k]} belum dibaca` : unreadBy[k]}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <label htmlFor="cari-notif" className="sr-only">Cari berdasarkan isi pesan</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input id="cari-notif" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Cari berdasarkan isi pesan, nama barang, atau staff…" className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm" />
          </div>
          <Select label="Waktu" hideLabel value={when} onChange={f(setWhen)} options={[{ value: "all", label: "Waktu: Semua waktu" }, { value: "today", label: "Hari ini" }, { value: "7d", label: "7 hari terakhir" }, { value: "30d", label: "30 hari terakhir" }]} className="w-48" selectClassName="bg-canvas" />
          <Select label="Status" hideLabel value={readFilter} onChange={f(setReadFilter)} options={[{ value: "all", label: "Status: Semua" }, { value: "unread", label: "Belum dibaca" }, { value: "read", label: "Sudah dibaca" }]} className="w-44" selectClassName="bg-canvas" />
          <Button variant="secondary" onClick={reset} disabled={!hasFilter}><RotateCcw className="size-4" aria-hidden="true" /> Reset Filter</Button>
        </div>
      </section>

      {list.isLoading ? <LoadingState label="Memuat notifikasi…" /> : list.isError ? (
        <div className="rounded-card bg-surface shadow-card"><ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card"><EmptyState title="Tidak ada notifikasi yang cocok" description="Ubah kategori atau filter. Pemberitahuan baru akan muncul di sini." /></div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{g.label}{g.items.some((n) => !n.is_read) && <span className="inline-flex items-center gap-1 text-primary"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /> {g.items.filter((n) => !n.is_read).length} baru</span>}</h2>
              <ul className="space-y-3">
                {g.items.map((n) => {
                  const t = TYPE[n.type] ?? TYPE.LOW_STOCK;
                  const act = action(n.type, user.role);
                  const must = !n.is_read && ACTIONABLE.includes(n.type);
                  return (
                    <li key={n.id} className={cn("rounded-card border-l-4 bg-surface p-5 shadow-card", t.border, n.is_read && "opacity-80")}>
                      <div className="flex items-start gap-4">
                        <span aria-hidden="true" className={cn("grid size-11 shrink-0 place-items-center rounded-xl", t.iconCls)}><t.Icon className="size-5" /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="flex items-center gap-2"><span className={cn("rounded px-2 py-0.5 text-[11px] font-semibold", t.tagCls)}>{t.tag}</span>{!n.is_read && <span className="size-2 rounded-full bg-primary" role="img" aria-label="Belum dibaca" />}</p>
                            <p className="flex items-center gap-1.5 text-xs text-ink-muted"><Clock className="size-3.5" aria-hidden="true" /> {timeAgo(n.created_at)} · {fmtClock(n.created_at)}</p>
                          </div>
                          <h3 className={cn("mt-1.5 font-display text-base", n.is_read ? "font-medium" : "font-semibold")}>{t.title}</h3>
                          <p className="mt-0.5 text-sm text-ink-muted">{n.message}</p>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {must && <span className="rounded bg-warning/18 px-2 py-0.5 font-semibold text-warning-ink">Perlu Tindakan</span>}
                              {n.ref_id && <span title={String(n.ref_id)} className="max-w-40 truncate rounded bg-canvas px-2 py-0.5 text-ink-muted">Ref: {String(n.ref_id).toUpperCase()}</span>}
                              {!n.is_read && <button type="button" onClick={() => readOne.mutate(n.id)} className="font-semibold text-primary hover:underline">Tandai dibaca</button>}
                            </div>
                            {act && (
                              <Link to={act.to} onClick={() => !n.is_read && readOne.mutate(n.id)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark">
                                {act.label} <ArrowRight className="size-4" aria-hidden="true" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-start gap-3 rounded-card border border-info/30 bg-info/8 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-info-ink" aria-hidden="true" />
        <span><b>Ketentuan notifikasi:</b> membaca atau menandai notifikasi tidak mengubah data stok maupun menghapus riwayat aktivitas. Tindak lanjut dilakukan lewat menu terkait (validasi aktivitas, monitoring selisih, atau data barang).</span>
      </p>
      <div className="mt-5 rounded-card bg-surface p-4 shadow-card">
        <Pagination page={meta?.page ?? 1} pageCount={meta?.totalPages ?? 1} onChange={(p) => setPage(Math.min(Math.max(1, p), meta?.totalPages ?? 1))} summary={`Menampilkan ${meta?.total ? (meta.page - 1) * meta.limit + 1 : 0} - ${meta ? Math.min(meta.page * meta.limit, meta.total) : 0} dari ${meta?.total ?? 0} notifikasi`} />
      </div>
    </>
  );
}
