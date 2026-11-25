import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, Download, Mail, Pencil, PlusCircle, Search, Trash2, Users as UsersIcon } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import StatCard from "@/components/common/StatCard";
import DataTable from "@/components/common/DataTable";
import Pagination from "@/components/common/Pagination";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { LoadingState, ErrorState } from "@/components/common/states";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useAuth } from "@/features/auth/AuthContext";
import { ROLES, ROLE_LABEL } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { getErrorMessage } from "@/services/api/client";
import * as usersApi from "@/services/api/users.api";
import UserFormDialog from "./UserFormDialog";
import { AccountStatusBadge, RoleBadge, downloadUsersCsv, expiryText, fmtDate, initials } from "./userUtils";

const PAGE_SIZE = 10;

export default function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDeactivate, setToDeactivate] = useState(null);

  const search = useDebouncedValue(query);
  const filters = { search, role, status };

  // Daftar halaman aktif (paginasi dari server: GET /users?page&limit)
  const list = useQuery({
    queryKey: ["users", "list", { page, ...filters }],
    queryFn: () => usersApi.listUsers({ page, limit: PAGE_SIZE, ...filters }),
    placeholderData: keepPreviousData,
  });
  const meta = list.data?.meta;
  const rows = list.data?.data ?? [];

  // Angka kartu ringkasan diambil dari meta.total (limit=1) agar tidak perlu memuat semua pengguna
  const totalQ = useQuery({ queryKey: ["users", "count", "all"], queryFn: () => usersApi.listUsers({ page: 1, limit: 1 }) });
  const activeQ = useQuery({ queryKey: ["users", "count", "active"], queryFn: () => usersApi.listUsers({ page: 1, limit: 1, status: "active" }) });
  const pendingQ = useQuery({ queryKey: ["users", "count", "pending"], queryFn: () => usersApi.listUsers({ page: 1, limit: 1, status: "pending" }) });
  const total = totalQ.data?.meta.total;
  const activeCount = activeQ.data?.meta.total;
  const pendingCount = pendingQ.data?.meta.total;
  const pendingFirst = pendingQ.data?.data?.[0];

  // Bila halaman saat ini melewati halaman terakhir (mis. setelah menonaktifkan item terakhir), mundur
  useEffect(() => {
    if (meta && page > meta.totalPages) setPage(Math.max(1, meta.totalPages));
  }, [meta, page]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadUsersCsv(await usersApi.fetchAllUsers(filters));
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal mengekspor data."));
    } finally {
      setExporting(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: (values) => (editing ? usersApi.updateUser(editing.id, values) : usersApi.createUser(values)),
    onSuccess: () => {
      toast.success(editing ? "Data akun berhasil diperbarui." : "Akun berhasil dibuat. Tautan aktivasi dikirim ke email pengguna.");
      setFormOpen(false);
      invalidate();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (u) => usersApi.deactivateUser(u.id),
    onSuccess: () => {
      toast.success("Akun berhasil dinonaktifkan.");
      setToDeactivate(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setToDeactivate(null);
    },
  });

  const resendMutation = useMutation({
    mutationFn: (u) => usersApi.resendActivation(u.id),
    onSuccess: () => toast.success("Tautan aktivasi baru telah dikirim."),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const from = meta && meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setFormOpen(true);
  };

  const iconBtn = "grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-canvas hover:text-ink disabled:opacity-40";

  const columns = [
    {
      key: "name",
      header: "Pengguna",
      cell: (u) => (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-white">
            {initials(u.name)}
          </span>
          <span className="font-medium">
            {u.name}
            {u.id === me.id && <span className="ml-2 text-xs font-normal text-ink-muted">(Anda)</span>}
          </span>
        </div>
      ),
    },
    { key: "email", header: "Email" },
    { key: "role", header: "Role", cell: (u) => <RoleBadge role={u.role} /> },
    {
      key: "status",
      header: "Status Akun",
      cell: (u) => (
        <div>
          <AccountStatusBadge user={u} />
          {!u.deleted_at && !u.is_active && u.activation_expires_at && (
            <p className="mt-1 text-xs text-ink-muted">Tautan {expiryText(u.activation_expires_at)}</p>
          )}
        </div>
      ),
    },
    { key: "created_at", header: "Tanggal Dibuat", cell: (u) => fmtDate(u.created_at) },
    {
      key: "actions",
      header: "Aksi",
      align: "right",
      cell: (u) => {
        const gone = Boolean(u.deleted_at);
        return (
          <div className="flex justify-end gap-1">
            {!gone && !u.is_active && (
              <button type="button" className={iconBtn} aria-label={`Kirim ulang aktivasi ${u.name}`} title="Kirim ulang aktivasi" onClick={() => resendMutation.mutate(u)} disabled={resendMutation.isPending}>
                <Mail className="size-[18px]" />
              </button>
            )}
            <button type="button" className={iconBtn} aria-label={`Ubah ${u.name}`} title="Ubah" onClick={() => openEdit(u)} disabled={gone}>
              <Pencil className="size-[18px]" />
            </button>
            <button
              type="button"
              className={iconBtn}
              aria-label={`Nonaktifkan ${u.name}`}
              title={u.id === me.id ? "Anda tidak dapat menonaktifkan akun sendiri" : "Nonaktifkan"}
              onClick={() => setToDeactivate(u)}
              disabled={gone || u.id === me.id}
            >
              <Trash2 className="size-[18px]" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Manajemen Akun"
        description="Kelola akses pengguna dan peran Staff, Supervisor, dan Owner."
        actions={
          <Button onClick={openCreate} className="h-12 px-5">
            <PlusCircle className="size-5" aria-hidden="true" /> Tambah Akun
          </Button>
        }
      />

      {list.isLoading ? (
        <LoadingState label="Memuat daftar pengguna…" />
      ) : list.isError ? (
        <div className="rounded-card bg-surface shadow-card">
          <ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} />
        </div>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-3">
            <StatCard label="Total Pengguna" value={total ?? "—"} unit="Pengguna" icon={UsersIcon} tone="info" />
            <StatCard
              label="Akun Aktif"
              value={activeCount ?? "—"}
              unit="Akun"
              icon={CheckCircle2}
              tone="success"
              footer={
                total ? (
                  <span className="text-xs text-ink-muted">
                    <b className="text-success-ink">{Math.round(((activeCount ?? 0) / total) * 100)}%</b> pengguna telah aktif
                  </span>
                ) : null
              }
            />
            <StatCard
              label="Menunggu Aktivasi"
              value={pendingCount ?? "—"}
              unit="Akun"
              icon={Clock}
              tone="warning"
              footer={
                <span className="text-xs text-warning-ink">
                  {pendingFirst ? `${pendingFirst.name} (tautan ${expiryText(pendingFirst.activation_expires_at) || "—"})` : "Semua akun sudah aktif"}
                </span>
              }
            />
          </div>

          <section className="mt-5 rounded-card bg-surface p-6 shadow-card">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <label htmlFor="cari-user" className="sr-only">Cari nama atau email</label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
                <input
                  id="cari-user"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Cari nama atau email…"
                  className="h-11 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm"
                />
              </div>
              <Select
                label="Filter role"
                hideLabel
                value={role}
                onChange={(e) => { setRole(e.target.value); setPage(1); }}
                options={[{ value: "all", label: "Semua role" }, ...[ROLES.OWNER, ROLES.SPV, ROLES.STAFF].map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
                className="w-36"
                selectClassName="bg-canvas"
              />
              <Select
                label="Filter status"
                hideLabel
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                options={[
                  { value: "all", label: "Semua status" },
                  { value: "active", label: "Aktif" },
                  { value: "pending", label: "Belum Aktif" },
                ]}
                className="w-40"
                selectClassName="bg-canvas"
              />
              <Button variant="ghost" onClick={exportCsv} loading={exporting} disabled={!meta?.total} className="text-primary">
                <Download className="size-4" aria-hidden="true" /> Ekspor CSV
              </Button>
            </div>

            <DataTable
              caption="Daftar pengguna"
              columns={columns}
              rows={rows}
              emptyTitle="Tidak ada pengguna yang cocok"
              emptyDescription="Ubah kata kunci atau filter, atau tambahkan akun baru."
            />
            <Pagination
              page={meta?.page ?? 1}
              pageCount={meta?.totalPages ?? 1}
              onChange={(p) => setPage(Math.min(Math.max(1, p), meta?.totalPages ?? 1))}
              summary={`Menampilkan ${from} – ${to} dari ${meta?.total ?? 0} pengguna`}
            />
          </section>
        </>
      )}

      <UserFormDialog
        open={formOpen}
        user={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={(values) => saveMutation.mutateAsync(values)}
      />

      <ConfirmDialog
        open={Boolean(toDeactivate)}
        tone="danger"
        title="Nonaktifkan akun ini?"
        description={toDeactivate ? `${toDeactivate.name} tidak akan bisa login lagi. Riwayat aktivitasnya tetap tersimpan.` : ""}
        confirmLabel="Nonaktifkan"
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate(toDeactivate)}
        onCancel={() => setToDeactivate(null)}
      />
    </>
  );
}
