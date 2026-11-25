import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { WarehouseProvider } from "@/app/providers/WarehouseContext";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <WarehouseProvider>
      <div className="min-h-dvh">
        <AppSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="lg:pl-72">
          <AppHeader onMenu={() => setMenuOpen(true)} />
          <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </WarehouseProvider>
  );
}
