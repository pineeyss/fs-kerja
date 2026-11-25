import PageHeader from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/states";

/** Dipakai untuk halaman yang belum dikerjakan agar menu tidak mengarah ke halaman kosong. */
export default function PlaceholderPage({ title }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-card border border-line bg-surface shadow-card">
        <EmptyState
          title="Halaman ini belum tersedia"
          description="Sedang dalam pengerjaan sesuai urutan tahap implementasi."
        />
      </div>
    </>
  );
}
