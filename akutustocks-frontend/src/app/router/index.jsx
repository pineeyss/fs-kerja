import { createBrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import LoginPage from "@/features/auth/LoginPage";
import DashboardRouter from "@/features/dashboard/DashboardRouter";
import ActivationPage from "@/features/auth/ActivationPage";
import UsersPage from "@/features/users/UsersPage";
import ProductsPage from "@/features/products/ProductsPage";
import HistoryPage from "@/features/history/HistoryPage";
import ProfilePage from "@/features/profile/ProfilePage";
import ReportsPage from "@/features/reports/ReportsPage";
import StockCatalogPage from "@/features/stock/StockCatalogPage";
import TransactionPage from "@/features/transactions/TransactionPage";
import OpnamePage from "@/features/opname/OpnamePage";
import StatusReportPage from "@/features/status/StatusReportPage";
import NotificationsPage from "@/features/notifications/NotificationsPage";
import ActivityValidationPage from "@/features/activities/ActivityValidationPage";
import DiscrepanciesPage from "@/features/discrepancies/DiscrepanciesPage";
import ImportPage from "@/features/imports/ImportPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import { ForbiddenPage, NotFoundPage } from "@/pages/StatusPages";
import { APP_ROUTES } from "@/lib/navigation";

/*
 * Daftar halaman nyata. Saat sebuah fitur selesai, daftarkan di sini;
 * route yang belum ada otomatis memakai PlaceholderPage.
 */
const PAGES = {
  dashboard: <DashboardRouter />,
  akun: <UsersPage />,
  barang: <ProductsPage />,
  riwayat: <HistoryPage />,
  laporan: <ReportsPage />,
  "manajemen-stok": <StockCatalogPage />,
  transaksi: <TransactionPage />,
  opname: <OpnamePage />,
  "status-pelaporan": <StatusReportPage />,
  notifikasi: <NotificationsPage />,
  "aktivitas-staff": <ActivityValidationPage />,
  selisih: <DiscrepanciesPage />,
  import: <ImportPage />,
  pencarian: <StockCatalogPage />,
  profil: <ProfilePage />,
};

// Satu guard per kombinasi role agar guard role dijalankan sebelum layout dirender
const appRoutes = APP_ROUTES.map((r) => ({
  element: <ProtectedRoute roles={r.roles} />,
  children: [{ path: r.path, element: PAGES[r.path] ?? <PlaceholderPage title={r.label} /> }],
}));

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/aktivasi", element: <ActivationPage /> },
  { path: "/403", element: <ForbiddenPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [{ index: true, element: <Navigate to="/dashboard" replace /> }, ...appRoutes],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
