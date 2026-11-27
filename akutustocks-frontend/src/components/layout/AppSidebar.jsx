import { NavLink, useLocation } from "react-router-dom";
import { AlertTriangle, Boxes, LogOut, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navFor } from "@/lib/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { useNavBadges } from "./useNavBadges";

const CATALOG_PATHS = ["/barang", "/barang/selisih", "/selisih"];

export default function AppSidebar({ open, onClose }) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const items = user?.role ? navFor(user.role) : [];
  const badges = useNavBadges();

  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const isSelisihActive =
    normalizedPath === "/barang/selisih" ||
    normalizedPath.startsWith("/barang/selisih/") ||
    normalizedPath === "/selisih" ||
    normalizedPath.startsWith("/selisih/");
  const isBarangActive = normalizedPath === "/barang";
  const isCatalogContext =
    isBarangActive ||
    isSelisihActive ||
    CATALOG_PATHS.some((p) => normalizedPath === p || normalizedPath.startsWith(`${p}/`));
  const canSeeCatalogSubs = user?.role === "spv" || user?.role === "owner";

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cn("fixed inset-0 z-30 bg-ink/40 lg:hidden", open ? "block" : "hidden")}
      />
      <aside
        aria-label="Menu utama"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-surface shadow-card transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-primary text-accent">
              <Boxes className="size-7" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold">AkutuStocks</p>
              <p className="text-xs text-ink-muted">Inventory Hub</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-canvas lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="mx-6 border-t border-line" />

        <nav className="flex-1 overflow-y-auto px-5 py-5">
          <ul className="space-y-2">
            {items.map(({ path, label, icon: Icon, badge, section }, i) => {
              const isBarangMenu = path === "barang";
              const itemPath = `/${path}`;
              const isParentActive = isBarangMenu
                ? isCatalogContext
                : normalizedPath === itemPath || normalizedPath.startsWith(`${itemPath}/`);

              return (
                <li key={path}>
                  {section && section !== items[i - 1]?.section && (
                    <p className="mb-1 mt-5 px-4 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      {section}
                    </p>
                  )}

                  <NavLink
                    to={itemPath}
                    onClick={onClose}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-lg px-4 text-[15px] font-medium transition-colors",
                      isParentActive
                        ? "bg-primary text-white"
                        : "text-ink-muted hover:bg-canvas hover:text-ink"
                    )}
                  >
                    {Icon && <Icon className="size-5 shrink-0" aria-hidden="true" />}
                    <span className="flex-1">{label}</span>
                    {badge && badges[path] > 0 && (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white">
                        {badges[path]}
                        <span className="sr-only">
                          {path === "notifikasi" ? " belum dibaca" : " perlu tindakan"}
                        </span>
                      </span>
                    )}
                  </NavLink>

                  {isBarangMenu && canSeeCatalogSubs && isCatalogContext && (
                    <ul
                      className="mt-1.5 ml-5 space-y-1 border-l-2 border-primary/25 pl-3"
                      aria-label="Sub-menu Manajemen Data Barang"
                    >
                      <li>
                        <NavLink
                          to="/barang"
                          onClick={onClose}
                          className={cn(
                            "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                            isBarangActive
                              ? "bg-primary font-semibold text-white shadow-card"
                              : "text-ink-muted hover:bg-canvas hover:text-ink"
                          )}
                        >
                          <Package className="size-4 shrink-0" aria-hidden="true" />
                          <span>Data Barang</span>
                        </NavLink>
                      </li>
                      <li>
                        <NavLink
                          to="/barang/selisih"
                          onClick={onClose}
                          className={cn(
                            "flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium transition-colors",
                            isSelisihActive
                              ? "bg-primary font-semibold text-white shadow-card"
                              : "text-ink-muted hover:bg-canvas hover:text-ink"
                          )}
                        >
                          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                          <span>Monitoring Selisih</span>
                        </NavLink>
                      </li>
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mx-6 border-t border-line" />
        <div className="p-5">
          <button
            type="button"
            onClick={logout}
            className="flex h-12 w-full items-center gap-3 rounded-lg px-4 text-[15px] font-medium text-danger-ink hover:bg-danger/10"
          >
            <LogOut className="size-5" aria-hidden="true" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
}