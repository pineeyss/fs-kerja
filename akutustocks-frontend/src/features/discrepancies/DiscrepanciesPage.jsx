import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Eye, FileWarning, Hourglass, Info, Layers, Package, Search } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import StatusBadge from "@/components/common/StatusBadge";
import DataTable from "@/components/common/DataTable";
import Pagination from "@/components/common/Pagination";
import { ErrorState, LoadingState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { useAuth } from "@/features/auth/AuthContext";
import { fmtDateTime } from "@/features/history/historyUtils";
import { DISCREPANCY_SOURCE, DISCREPANCY_STATUS } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/api/client";
import { listDiscrepancies, updateDiscrepancy } from "@/services/api/discrepancies.api";

const PAGE_SIZE = 10;
const caseCode = (id) => `SEL-${String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase().padStart(4, "0")}`;
const signed = (n) => (n > 0 ? `+${n}` : String(n));
const fmtDay = (iso) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

const activeBtnCls = "bg-primary text-white shadow-card";
const inactiveBtnCls = "border border-line bg-surface text-ink-muted hover:bg-canvas hover:text-ink";

function CatalogSubNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  if (user?.role !== "spv" && user?.role !== "owner") return null;

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const isSelisihActive =
    normalizedPath === "/barang/selisih" ||
    normalizedPath.startsWith("/barang/selisih/") ||
    normalizedPath === "/selisih" ||
    normalizedPath.startsWith("/selisih/");
  const isBarangActive = normalizedPath === "/barang";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="navigation" aria-label="Halaman Manajemen Data Barang">
      <NavLink
        to="/barang"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
          isBarangActive ? activeBtnCls : inactiveBtnCls
        )}
      >
        <Package className="size-4" aria-hidden="true" />
        Data Barang
      </NavLink>
      <NavLink
        to="/barang/selisih"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
          isSelisihActive ? activeBtnCls : inactiveBtnCls
        )}
      >
        <AlertTriangle className="size-4" aria-hidden="true" />
        Monitoring Selisih
      </NavLink>
    </div>
  );
}

function StatusDialog({ item, target, onClose, onDone }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const resolve = target === "RESOLVED";
  const m = useMutation({
    mutationFn: () => updateDiscrepancy(item.id, { status: target, note: note.trim() || undefined }),
    onSuccess: () => {
      toast.success(resolve ? "Kasus selisih ditandai selesai." : "Kasus selisih mulai ditindaklanjuti.");
      onDone();
    },
    onError: (e) => setErr(getErrorMessage(e, "Status gagal diperbarui.")),
  });
  const submit = (e) => {
    e.preventDefault();
    if (resolve && note.trim().length < 5) {
      return setErr("Catatan penyelesaian wajib diisi (minimal 5 karakter): jelaskan penyebab dan tindakan yang dilakukan.");
    }
    setErr("");
    m.mutate();
  };
  return (
    <Modal
      open={Boolean(item && target)}
      onClose={onClose}
      busy={m.isPending}
      title={resolve ? "Tandai kasus selesai?" : "Mulai tindak lanjut?"}
      description={item ? `${caseCode(item.id)} · ${item.product.name}` : ""}
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="rounded-lg bg-canvas p-3 text-[13px] text-ink-muted">
          {resolve
            ? "Status Selesai tidak mengubah stok sistem. Bila stok sistem perlu dikoreksi, minta Staff membuat aktivitas Penyesuaian."
            : "Status berubah menjadi Dalam Proses dan Staff dapat melakukan hitung ulang."}
        </p>
        <div>
          <label htmlFor="catatan-selisih" className="mb-1.5 block text-sm font-medium">
            Catatan {resolve ? "penyelesaian *" : "(opsional)"}
          </label>
          <textarea
            id="catatan-selisih"
            rows={3}
            maxLength={300}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setErr("");
            }}
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? "catatan-selisih-error" : undefined}
            className={cn("w-full rounded-lg border bg-surface px-3 py-2.5 text-sm", err ? "border-danger" : "border-line")}
          />
          {err && (
            <p id="catatan-selisih-error" className="mt-1.5 text-[13px] font-medium text-danger-ink">
              {err}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={m.isPending}>
            Batal
          </Button>
          <Button type="submit" loading={m.isPending}>
            {resolve ? "Ya, tandai selesai" : "Ya, mulai tindak lanjut"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DetailDrawer({ item, onClose, onAct }) {
  const d = item;
  const st = d ? DISCREPANCY_STATUS[d.status] : null;
  const timeline =
    d &&
    [
      {
        at: d.created_at,
        title: "Selisih ditemukan",
        text: `Dari ${DISCREPANCY_SOURCE[d.source]}: stok sistem ${d.qty_system}, pembanding ${d.qty_compare} (selisih ${signed(d.difference)}).`,
      },
      d.recounted_at && { at: d.recounted_at, title: "Hitung ulang", text: `${d.recounted_by ?? "Staff"} menghitung ulang: ${d.qty_recount} unit.` },
      d.status === "IN_PROGRESS" && { at: d.updated_at, title: "Ditindaklanjuti", text: d.note ?? "Kasus sedang ditangani." },
      d.status === "RESOLVED" && {
        at: d.validated_at ?? d.updated_at,
        title: "Selesai",
        text: `${d.validated_by ?? "SPV"} menyelesaikan kasus.${d.note ? ` Catatan: ${d.note}` : ""}`,
      },
    ].filter(Boolean);

  return (
    <Drawer
      open={Boolean(d)}
      onClose={onClose}
      title="Detail Kasus Selisih"
      footer={
        d && d.status !== "RESOLVED" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Tutup
            </Button>
            {d.status === "OPEN" && (
              <Button variant="secondary" onClick={() => onAct("IN_PROGRESS")}>
                Mulai Tindak Lanjut
              </Button>
            )}
            <Button onClick={() => onAct("RESOLVED")}>
              <CheckCircle2 className="size-4" aria-hidden="true" /> Tandai Selesai
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        )
      }
    >
      {d && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{caseCode(d.id)}</span>
            <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          </div>
          <div>
            <p className="font-display text-lg font-semibold leading-snug">{d.product.name}</p>
            <p className="text-sm text-ink-muted">
              {d.product.code} · {d.warehouse ? d.warehouse.name : "Total semua gudang"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center" role="group" aria-label="Perbandingan stok">
            <div className="rounded-lg border border-line p-3">
              <p className="text-xs text-ink-muted">Stok sistem</p>
              <p className="font-display text-xl font-semibold tabular-nums">{d.qty_system}</p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-xs text-ink-muted">{DISCREPANCY_SOURCE[d.source]}</p>
              <p className="font-display text-xl font-semibold tabular-nums">{d.qty_compare}</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-primary">Selisih</p>
              <p className={cn("font-display text-xl font-semibold tabular-nums", d.difference < 0 ? "text-danger-ink" : "text-warning-ink")}>
                {signed(d.difference)}
              </p>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Selisih = stok pembanding − stok sistem.{!d.warehouse && " Perbandingan di tingkat total karena sumber tidak merinci gudang."}
          </p>
          <section aria-labelledby="kronologi">
            <h3 id="kronologi" className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Kronologi
            </h3>
            <ol className="relative space-y-4 border-l-2 border-line pl-5">
              {timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-primary ring-4 ring-surface" aria-hidden="true" />
                  <p className="text-sm font-semibold">
                    {t.title} <span className="font-normal text-ink-muted">· {fmtDateTime(t.at)}</span>
                  </p>
                  <p className="text-sm text-ink-muted">{t.text}</p>
                </li>
              ))}
            </ol>
          </section>
          {d.note && d.status === "OPEN" && (
            <p className="rounded-lg bg-canvas p-3 text-sm">
              <span className="text-xs text-ink-muted">Catatan</span>
              <br />
              {d.note}
            </p>
          )}
          <p className="flex items-start gap-2 rounded-lg bg-info/10 p-3 text-[13px] text-info-ink">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Menyelesaikan kasus tidak mengubah stok sistem. Koreksi stok dilakukan Staff lewat aktivitas Penyesuaian dengan alasan.
          </p>
        </div>
      )}
    </Drawer>
  );
}

export default function DiscrepanciesPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [target, setTarget] = useState(null);
  const search = useDebouncedValue(query);
  const key = JSON.stringify({ status, source, search });

  const list = useQuery({
    queryKey: ["discrepancies", "list", key, page],
    queryFn: () => listDiscrepancies({ page, limit: PAGE_SIZE, status, source, search }),
    placeholderData: keepPreviousData,
  });
  const counts = useQueries({
    queries: ["OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => ({
      queryKey: ["discrepancies", "count", s],
      queryFn: () => listDiscrepancies({ page: 1, limit: 50, status: s }),
    })),
  });
  const [open, prog, done] = counts.map((q) => q.data);
  const openUnits = [...(open?.data ?? []), ...(prog?.data ?? [])].reduce((s, d) => s + Math.abs(d.difference), 0);
  const meta = list.data?.meta;
  const rows = list.data?.data ?? [];
  const f = (fn) => (e) => {
    fn(e.target.value);
    setPage(1);
  };
  const finish = () => {
    setTarget(null);
    setDetail(null);
    qc.invalidateQueries({ queryKey: ["discrepancies"] });
  };

  const columns = [
    {
      key: "id",
      header: "ID Kasus",
      cell: (d) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDetail(d);
          }}
          className="font-semibold text-primary hover:underline"
          aria-label={`Buka detail ${caseCode(d.id)}`}
        >
          {caseCode(d.id)}
        </button>
      ),
    },
    {
      key: "product",
      header: "Barang / Kode",
      className: "min-w-44",
      cell: (d) => (
        <div>
          <p className="font-medium">{d.product.name}</p>
          <p className="text-xs text-ink-muted">{d.product.code}</p>
        </div>
      ),
    },
    { key: "wh", header: "Gudang / Cakupan", cell: (d) => (d.warehouse ? d.warehouse.name : <span className="text-ink-muted">Total (semua gudang)</span>) },
    { key: "src", header: "Sumber", cell: (d) => DISCREPANCY_SOURCE[d.source] },
    { key: "sys", header: "Sistem", align: "right", cell: (d) => <span className="tabular-nums">{d.qty_system}</span> },
    { key: "cmp", header: "Pembanding", align: "right", cell: (d) => <span className="tabular-nums">{d.qty_compare}</span> },
    {
      key: "diff",
      header: "Selisih",
      align: "right",
      cell: (d) => (
        <b className={cn("tabular-nums", d.difference < 0 ? "text-danger-ink" : "text-warning-ink")}>{signed(d.difference)}</b>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (d) => <StatusBadge tone={DISCREPANCY_STATUS[d.status].tone}>{DISCREPANCY_STATUS[d.status].label}</StatusBadge>,
    },
    { key: "date", header: "Ditemukan", cell: (d) => <span className="whitespace-nowrap">{fmtDay(d.created_at)}</span> },
    {
      key: "act",
      header: "Aksi",
      align: "right",
      cell: (d) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDetail(d);
          }}
          className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink"
          aria-label={`Lihat detail ${caseCode(d.id)}`}
          title="Lihat detail"
        >
          <Eye className="size-[18px]" />
        </button>
      ),
    },
  ];

  return (
    <>
      <CatalogSubNav />

      <PageHeader
        title="Monitoring Selisih"
        description="Pantau selisih antara stok sistem dengan Kasir Pintar atau hasil hitung fisik, dan tindak lanjuti hingga selesai."
        actions={<StatusBadge tone="warning">Data contoh</StatusBadge>}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <StatCard label="Belum Ditindaklanjuti" value={open?.meta.total ?? "—"} unit="Kasus" icon={FileWarning} tone="danger" caption="Selisih baru yang perlu perhatian" />
        <StatCard label="Dalam Proses" value={prog?.meta.total ?? "—"} unit="Kasus" icon={Hourglass} tone="warning" caption="Sedang ditangani / dihitung ulang" />
        <StatCard label="Selesai" value={done?.meta.total ?? "—"} unit="Kasus" icon={CheckCircle2} tone="success" caption="Tindak lanjut sudah selesai" />
        <StatCard label="Selisih Terbuka" value={openUnits} unit="unit" icon={Layers} tone="info" caption="Total selisih mutlak kasus yang belum selesai" />
      </div>

      <section className="mt-5 rounded-card bg-surface p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <label htmlFor="cari-selisih" className="sr-only">
              Cari nama barang atau kode
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              id="cari-selisih"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama barang atau kode…"
              className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm"
            />
          </div>
          <Select
            label="Status kasus"
            hideLabel
            value={status}
            onChange={f(setStatus)}
            options={[{ value: "all", label: "Semua status" }, ...Object.entries(DISCREPANCY_STATUS).map(([value, s]) => ({ value, label: s.label }))]}
            className="w-52"
            selectClassName="bg-canvas"
          />
          <Select
            label="Sumber pembanding"
            hideLabel
            value={source}
            onChange={f(setSource)}
            options={[{ value: "all", label: "Semua sumber" }, ...Object.entries(DISCREPANCY_SOURCE).map(([value, label]) => ({ value, label }))]}
            className="w-44"
            selectClassName="bg-canvas"
          />
        </div>
        {list.isLoading ? (
          <LoadingState label="Memuat kasus selisih…" />
        ) : list.isError ? (
          <ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} />
        ) : (
          <>
            <DataTable
              dense
              caption="Daftar kasus selisih stok"
              columns={columns}
              rows={rows}
              onRowClick={setDetail}
              emptyTitle="Tidak ada kasus selisih"
              emptyDescription="Kasus muncul otomatis dari hasil import Kasir Pintar atau stok opname Staff."
            />
            <Pagination
              page={meta?.page ?? 1}
              pageCount={meta?.totalPages ?? 1}
              onChange={(p) => setPage(Math.min(Math.max(1, p), meta?.totalPages ?? 1))}
              summary={`Menampilkan ${meta?.total ? (meta.page - 1) * meta.limit + 1 : 0} - ${meta ? Math.min(meta.page * meta.limit, meta.total) : 0} dari ${meta?.total ?? 0} kasus`}
            />
          </>
        )}
      </section>

      <DetailDrawer item={detail} onClose={() => setDetail(null)} onAct={setTarget} />
      <StatusDialog item={detail} target={target} onClose={() => setTarget(null)} onDone={finish} />
    </>
  );
}