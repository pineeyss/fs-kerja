import { ShieldCheck, Users, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/constants";
import StatusBadge from "@/components/common/StatusBadge";
import { downloadCsv } from "@/lib/csv";

const roleStyle = {
  owner: { cls: "bg-primary/10 text-primary", Icon: ShieldCheck },
  spv: { cls: "bg-info/12 text-info-ink", Icon: Users },
  staff: { cls: "bg-line text-ink", Icon: Store },
};

export function RoleBadge({ role }) {
  const { cls, Icon } = roleStyle[role] ?? roleStyle.staff;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", cls)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

/** Status akun diturunkan dari kolom ERD: deleted_at, is_active, activation_expires_at. */
export function accountStatus(u) {
  if (u.deleted_at) return { key: "INACTIVE", label: "Dinonaktifkan", tone: "neutral" };
  if (u.is_active) return { key: "ACTIVE", label: "Aktif", tone: "success" };
  return { key: "PENDING", label: "Belum Aktif", tone: "warning" };
}

export function AccountStatusBadge({ user }) {
  const s = accountStatus(user);
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export const fmtDate = (iso) =>
  iso ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

export function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("") || "?";
}

/** Sisa waktu tautan aktivasi, mis. "berlaku 23 jam" atau "kedaluwarsa". */
export function expiryText(iso) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "kedaluwarsa";
  const h = Math.ceil(ms / 3600000);
  return `berlaku ${h} jam`;
}

export function downloadUsersCsv(users) {
  downloadCsv(
    "daftar-pengguna.csv",
    ["Nama", "Email", "Role", "Status", "Dibuat"],
    users.map((u) => [u.name, u.email, ROLE_LABEL[u.role], accountStatus(u).label, fmtDate(u.created_at)])
  );
}
