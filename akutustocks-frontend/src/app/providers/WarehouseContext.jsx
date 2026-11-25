import { createContext, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listWarehouses } from "@/services/api/warehouses.api";

const Ctx = createContext(null);

/** Filter gudang global di header ("Semua Gudang"). Halaman yang relevan membaca warehouseId. */
export function WarehouseProvider({ children }) {
  const [warehouseId, setWarehouseId] = useState("all");
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: listWarehouses, staleTime: 5 * 60_000 });
  const value = useMemo(() => ({ warehouseId, setWarehouseId, warehouses }), [warehouseId, warehouses]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWarehouse() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWarehouse harus dipakai di dalam <WarehouseProvider>");
  return ctx;
}
