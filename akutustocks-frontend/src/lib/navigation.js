import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  History,
  UserRound,
  ClipboardList,
  ArrowLeftRight,
  FileCheck2,
  FileUp,
  AlertTriangle,
  UserCheck,
  Bell,
} from "lucide-react";
import { ROLES } from "@/lib/constants";

const { OWNER, SPV, STAFF } = ROLES;
const ALL = [OWNER, SPV, STAFF];

/**
 * Sumber tunggal untuk route DAN menu sidebar.
 * roles    : siapa yang boleh membuka halaman (guard UX; backend tetap wajib cek)
 * navRoles : siapa yang melihat menunya di sidebar (default = roles)
 */
export const APP_ROUTES = [
  { path: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { path: "import", label: "Import Kasir Pintar", icon: FileUp, roles: [SPV] },

  // Owner & SPV: satu menu Manajemen Data Barang dengan halaman terpisah (Data Barang & Monitoring Selisih)
  { path: "akun", label: "Manajemen Akun", icon: Users, roles: [OWNER] },
  {
    path: "barang",
    label: "Manajemen Data Barang",
    icon: Package,
    roles: [OWNER, SPV],
    activePaths: ["barang", "barang/selisih"],
    children: [
      { path: "barang", label: "Data Barang", icon: Package, roles: [OWNER, SPV], exact: true },
      { path: "barang/selisih", label: "Monitoring Selisih", icon: AlertTriangle, roles: [SPV] },
    ],
  },
  { path: "barang/selisih", label: "Monitoring Selisih", icon: AlertTriangle, roles: [SPV], navRoles: [] },

  // SPV
  { path: "aktivitas-staff", label: "Validasi Aktivitas Staff", icon: UserCheck, roles: [SPV], badge: true },

  // Staff
  { path: "manajemen-stok", label: "Manajemen Stok", icon: ClipboardList, roles: [STAFF] },
  { path: "transaksi", label: "Input Transaksi", icon: ArrowLeftRight, roles: [STAFF] },
  { path: "status-pelaporan", label: "Status Pelaporan", icon: FileCheck2, roles: [STAFF], badge: true },

  // Bersama
  { path: "laporan", label: "Laporan & Analisis", icon: BarChart3, roles: [OWNER, SPV] },
  { path: "riwayat", label: "Riwayat Aktivitas", icon: History, roles: ALL },
  { path: "notifikasi", label: "Notifikasi", icon: Bell, roles: ALL, badge: true, section: "Preferensi", sectionRoles: ALL },
  { path: "profil", label: "Profil", icon: UserRound, roles: ALL, section: "Preferensi", sectionRoles: ALL },
];

export function navFor(role) {
  return APP_ROUTES.filter((r) => (r.navRoles ?? r.roles).includes(role)).map((r) => ({
    ...r,
    label: r.labelByRole?.[role] ?? r.label,
    section: r.sectionRoles?.includes(role) ? r.section : undefined,
    children: r.children?.filter((c) => (c.navRoles ?? c.roles).includes(role)),
  }));
}