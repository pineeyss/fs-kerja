import { useAuth } from "@/features/auth/AuthContext";
import { ROLES } from "@/lib/constants";
import DashboardPage from "./DashboardPage";
import StaffDashboard from "./StaffDashboard";
import SpvDashboard from "./SpvDashboard";

/** Dashboard menyesuaikan role.  */
export default function DashboardRouter() {
  const { user } = useAuth();
  if (user.role === ROLES.STAFF) return <StaffDashboard />;
  if (user.role === ROLES.SPV) return <SpvDashboard />;
  return <DashboardPage />;
}
