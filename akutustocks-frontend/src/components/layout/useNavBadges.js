import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { ROLES } from "@/lib/constants";
import { listActivities } from "@/services/api/activities.api";
import { listNotifications } from "@/services/api/notifications.api";

/**
 * Angka penanda di sidebar dan lonceng.
 *  - "status-pelaporan" (Staff): aktivitas Ditolak yang belum ditindaklanjuti penyesuaian ("Perlu Tindakan")
 *  - "aktivitas-staff" (SPV): aktivitas Staff berstatus Diajukan (antrean validasi)
 *  - "notifikasi": notifikasi belum dibaca
 */
export function useNavBadges() {
  const { user } = useAuth();
  const action = useQuery({
    queryKey: ["activities", "count", "needs_action"],
    queryFn: () => listActivities({ page: 1, limit: 1, needs_action: true }),
    enabled: user.role === ROLES.STAFF,
    refetchInterval: 60_000,
  });
  const queue = useQuery({
    queryKey: ["activities", "count", "SUBMITTED"],
    queryFn: () => listActivities({ page: 1, limit: 1, status: "SUBMITTED" }),
    enabled: user.role === ROLES.SPV,
    refetchInterval: 60_000,
  });
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => listNotifications({ page: 1, limit: 1, unread: true }),
    refetchInterval: 60_000,
  });
  return { "status-pelaporan": action.data?.meta.total ?? 0, "aktivitas-staff": queue.data?.meta.total ?? 0, notifikasi: unread.data?.meta.total ?? 0 };
}
