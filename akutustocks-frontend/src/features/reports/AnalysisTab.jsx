import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/common/states";

// Hanya tautan https (atau localhost saat pengembangan) yang boleh ditanam
const raw = (import.meta.env.VITE_STREAMLIT_URL ?? "").trim();
const url = /^https:\/\//i.test(raw) || /^http:\/\/localhost(:\d+)?(\/|$)/i.test(raw) ? raw : "";

/** Dashboard analisis Streamlit dari tim Data Science (PRD FR-25). */
export default function AnalysisTab() {
  if (!url) {
    return (
      <div className="rounded-card bg-surface shadow-card">
        <EmptyState
          title="Dashboard analisis belum terhubung"
          description="Halaman ini akan menampilkan dashboard Streamlit dari tim Data Science. Isi VITE_STREAMLIT_URL di file .env setelah dashboard dideploy, lalu jalankan ulang aplikasi."
          action={<BarChart3 className="mx-auto size-6 text-ink-muted" aria-hidden="true" />}
        />
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-card">
      <iframe
        title="Dashboard analisis stok (Streamlit)"
        src={url}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="no-referrer"
        className="h-[80vh] min-h-[560px] w-full border-0"
      />
    </div>
  );
}
