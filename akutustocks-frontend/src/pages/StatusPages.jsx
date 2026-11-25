import { Link } from "react-router-dom";
import Button from "@/components/ui/Button";

function Centered({ code, title, text }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <p className="text-5xl font-semibold tabular-nums text-primary">{code}</p>
        <h1 className="mt-3 text-xl font-semibold">{title}</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{text}</p>
        <Link to="/dashboard" className="mt-6 inline-block">
          <Button>Kembali ke dashboard</Button>
        </Link>
      </div>
    </main>
  );
}

export const ForbiddenPage = () => (
  <Centered code="403" title="Anda tidak punya akses ke halaman ini" text="Hubungi Owner bila Anda merasa seharusnya memiliki akses." />
);

export const NotFoundPage = () => (
  <Centered code="404" title="Halaman tidak ditemukan" text="Alamat yang Anda buka tidak ada atau sudah dipindahkan." />
);
