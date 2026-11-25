import { Package } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import Button from "@/components/ui/Button";
import StockStatusBadge from "@/components/common/StockStatusBadge";
import { formatNumber } from "@/lib/utils";

const fmtDate = (iso) => (iso ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "Belum pernah");

export default function ProductDetailDrawer({ product, warehouses, onClose, onEdit }) {
  const p = product;
  return (
    <Drawer
      open={Boolean(p)}
      onClose={onClose}
      title="Detail Barang"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Tutup</Button>
          <Button onClick={() => onEdit(p)}>Ubah barang</Button>
        </>
      }
    >
      {p && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="size-20 rounded-xl object-cover" />
            ) : (
              <span aria-hidden="true" className="grid size-20 place-items-center rounded-xl bg-primary/10 text-primary">
                <Package className="size-8" />
              </span>
            )}
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold leading-snug">{p.name}</p>
              <p className="mt-1 text-sm text-ink-muted">{p.code} · {p.category}</p>
              <div className="mt-2"><StockStatusBadge status={p.status} /></div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-canvas p-3"><dt className="text-ink-muted">Total stok</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums">{formatNumber(p.total)} unit</dd></div>
            <div className="rounded-lg bg-canvas p-3"><dt className="text-ink-muted">Batas minimum</dt><dd className="mt-0.5 text-xl font-semibold tabular-nums">{formatNumber(p.min_stock)} unit</dd></div>
          </dl>

          <section>
            <h3 className="mb-2 font-display text-base font-semibold">Stok per gudang</h3>
            <table className="w-full text-sm">
              <caption className="sr-only">Stok barang pada setiap gudang</caption>
              <thead>
                <tr className="text-left text-ink-muted">
                  <th scope="col" className="pb-2 font-medium">Gudang</th>
                  <th scope="col" className="pb-2 text-right font-medium">Jumlah</th>
                  <th scope="col" className="pb-2 text-right font-medium">Pengecekan terakhir</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => {
                  const s = (p.stocks ?? []).find((x) => x.warehouse_id === w.id);
                  return (
                    <tr key={w.id} className="border-t border-line">
                      <th scope="row" className="py-2.5 text-left font-medium">{w.name}</th>
                      <td className="py-2.5 text-right tabular-nums">{formatNumber(s?.quantity ?? 0)}</td>
                      <td className="py-2.5 text-right text-ink-muted">{fmtDate(s?.last_checked_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[13px] text-ink-muted">Jumlah stok hanya berubah lewat transaksi stok, tidak bisa diedit langsung.</p>
          </section>
        </div>
      )}
    </Drawer>
  );
}
