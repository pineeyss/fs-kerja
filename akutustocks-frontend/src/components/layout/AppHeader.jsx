import { Link, useLocation } from "react-router-dom";
import { Bell, Menu } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { ROLE_LABEL } from "@/lib/constants";
import { APP_ROUTES } from "@/lib/navigation";
import { formatDateLong } from "@/lib/utils";
import WarehouseFilter from "./WarehouseFilter";
import { useNavBadges } from "./useNavBadges";

export default function AppHeader({ onMenu }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const current = APP_ROUTES.find((r) => pathname === `/${r.path}` || pathname.startsWith(`/${r.path}/`));
  const unread = useNavBadges().notifikasi;
  const initial = user.name?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-20 flex min-h-20 items-center gap-3 border-b border-line bg-surface px-4 sm:px-8">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Buka menu"
        className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-canvas lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0">
        <p className="truncate font-display text-lg font-semibold leading-tight sm:text-2xl">{current?.label ?? "AkutuStocks"}</p>
        <p className="truncate text-xs text-ink-muted sm:text-[15px]">{formatDateLong()}</p>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-5">
        <WarehouseFilter />
        <Link
          to="/notifikasi"
          aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
          className="relative grid size-10 shrink-0 place-items-center rounded-lg text-ink hover:bg-canvas"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span aria-hidden="true" className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-3 border-l border-line pl-3 sm:pl-5">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-white">
            {initial}
          </span>
          <div className="hidden leading-tight md:block">
            <p className="max-w-44 truncate font-display text-[15px] font-semibold">{user.name}</p>
            <p className="text-xs text-ink-muted">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
