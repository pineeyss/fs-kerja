import Drawer from "@/components/ui/Drawer";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/common/StatusBadge";
import { ACTIVITY_STATUS, ROLE_LABEL } from "@/lib/constants";
import ActivityTypeBadge from "./ActivityTypeBadge";
import { deltaText, fmtDateTime } from "./historyUtils";

function Row({ label, children }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-t border-line py-3 text-sm first:border-t-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export default function HistoryDetailDrawer({ row, onClose }) {
  const st = row?.status ? ACTIVITY_STATUS[row.status] : null;
  return (
    <Drawer open={Boolean(row)} onClose={onClose} title="Detail Aktivitas" description="Catatan ini bersifat read-only dan tidak dapat diubah atau dihapus." footer={<Button variant="secondary" onClick={onClose}>Tutup</Button>}>
      {row && (
        <>
          <div className="mb-4"><ActivityTypeBadge type={row.activity_type} /></div>
          <dl>
            <Row label="Waktu">{fmtDateTime(row.created_at)}</Row>
            <Row label="Pelaku">{row.user.name} <span className="font-normal text-ink-muted">({ROLE_LABEL[row.user.role] ?? row.user.role})</span></Row>
            <Row label="Barang">{row.product.name}<span className="block text-xs font-normal text-ink-muted">{row.product.code} · {row.product.category}</span></Row>
            <Row label="Gudang">{row.warehouse.name}</Row>
            <Row label="Jumlah"><span className="tabular-nums">{row.qty_before} → {row.qty_after}</span> <span className="font-semibold tabular-nums">({deltaText(row.qty_before, row.qty_after)})</span></Row>
            <Row label="Alasan">{row.reason || "—"}</Row>
            <Row label="Status pelaporan">{st ? <StatusBadge tone={st.tone}>{st.label}</StatusBadge> : <span className="font-normal text-ink-muted">Tidak perlu dilaporkan</span>}</Row>
            {row.reviewed_by && <Row label="Diperiksa oleh">{row.reviewed_by}</Row>}
            {row.review_note && <Row label="Catatan SPV">{row.review_note}</Row>}
          </dl>
          {row.status === "REJECTED" && (
            <p className="mt-4 rounded-lg bg-canvas p-3 text-[13px] text-ink-muted">
              Penolakan tidak membatalkan perubahan stok. Koreksi dilakukan lewat aktivitas penyesuaian baru, dan aktivitas awal ini tetap tersimpan.
            </p>
          )}
        </>
      )}
    </Drawer>
  );
}
