import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { LoadingState } from "@/components/common/states";

/**
 * Guard untuk UX saja. Batas keamanan sebenarnya ada di backend (authenticate + authorize).
 * <ProtectedRoute />                    -> wajib login
 * <ProtectedRoute roles={["owner"]} />  -> wajib login + role tertentu
 */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Memeriksa sesi…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}
