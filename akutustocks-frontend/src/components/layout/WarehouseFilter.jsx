import { ChevronDown, Store } from "lucide-react";
import { useWarehouse } from "@/app/providers/WarehouseContext";

export default function WarehouseFilter() {
  const { warehouseId, setWarehouseId, warehouses } = useWarehouse();
  return (
    <div className="relative">
      <label htmlFor="warehouse-filter" className="sr-only">
        Filter gudang
      </label>
      <Store className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-accent-ink" aria-hidden="true" />
      <select
        id="warehouse-filter"
        value={warehouseId}
        onChange={(e) => setWarehouseId(e.target.value)}
        className="h-10 appearance-none rounded-full border-2 border-accent-ink/60 bg-surface pl-9 pr-9 text-sm font-medium text-accent-ink"
      >
        <option value="all">Semua Gudang</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-accent-ink" aria-hidden="true" />
    </div>
  );
}
