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
import StatusReportPage from "@/features/status/StatusReportPage";
import NotificationsPage from "@/features/notifications/NotificationsPage";
import ActivityValidationPage from "@/features/activities/ActivityValidationPage";
import DiscrepanciesPage from "@/features/discrepancies/DiscrepanciesPage";
import ImportPage from "@/features/imports/ImportPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import { ForbiddenPage, NotFoundPage } from "@/pages/StatusPages";
import { APP_ROUTES } from "@/lib/navigation";

const PAGES = {
  dashboard: <DashboardRouter />,
  akun: <UsersPage />,
  barang: <ProductsPage />,
  "barang/selisih": <DiscrepanciesPage />,
  riwayat: <HistoryPage />,
  laporan: <ReportsPage />,
  "manajemen-stok": <StockCatalogPage />,
  transaksi: <TransactionPage />,
  "status-pelaporan": <StatusReportPage />,
  notifikasi: <NotificationsPage />,
  "aktivitas-staff": <ActivityValidationPage />,
  import: <ImportPage />,
  profil: <ProfilePage />,
};

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
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "selisih", element: <Navigate to="/barang/selisih" replace /> },
          { path: "pencarian", element: <Navigate to="/barang" replace /> },
          ...appRoutes,
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);