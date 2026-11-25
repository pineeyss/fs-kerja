import StatusBadge from "./StatusBadge";

export const STOCK_STATUS = {
  OK: { label: "Tersedia", tone: "success" },
  LOW: { label: "Stok Menipis", tone: "warning" },
  OUT: { label: "Stok Habis", tone: "danger" },
};

export default function StockStatusBadge({ status }) {
  const s = STOCK_STATUS[status] ?? STOCK_STATUS.OK;
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}
