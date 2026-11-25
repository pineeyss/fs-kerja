/** Meratakan baris riwayat (historyDb) menjadi commit berisi items. */
export function groupCommits(rows) {
  const map = new Map();
  rows.forEach((r) => {
    let c = map.get(r.commit_id);
    if (!c) {
      c = { id: r.commit_id, created_at: r.created_at, user: r.user, status: r.status, review_note: r.review_note, reviewed_by: r.reviewed_by, reviewed_at: r.reviewed_at ?? null, follow_up_commit_id: r.follow_up_commit_id ?? null, items: [] };
      map.set(r.commit_id, c);
    }
    c.items.push({ id: r.id, activity_type: r.activity_type, product: r.product, warehouse: r.warehouse, qty_before: r.qty_before, qty_after: r.qty_after, reason: r.reason });
  });
  return [...map.values()];
}
