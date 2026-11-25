/** Kartu kuning di tengah dengan latar putih + semburat biru kiri-bawah (mockup Login/Aktivasi). */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-surface px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 -left-56 size-[40rem] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(0 74 173 / 0.6), rgb(96 143 204 / 0.3) 55%, transparent)" }}
      />
      <section className="relative w-full max-w-[600px] rounded-[28px] bg-accent px-6 py-12 shadow-card sm:px-[100px] sm:py-14">
        <h1 className="text-center font-display text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mx-auto mt-3 max-w-sm text-center text-[15px]">{subtitle}</p>}
        <div className="mt-10">{children}</div>
      </section>
      {footer && <div className="relative mt-6 w-full max-w-[600px] text-center text-[13px] text-ink-muted">{footer}</div>}
    </main>
  );
}
