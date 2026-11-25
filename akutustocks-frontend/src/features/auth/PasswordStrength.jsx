import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_RULES, STRENGTH_LEVELS, passwordStrength } from "./passwordRules";

/** Indikator kekuatan + daftar ketentuan password. */
export default function PasswordStrength({ password }) {
  const score = passwordStrength(password);
  return (
    <>
      <div aria-live="polite">
        <div className="flex items-center justify-between text-xs">
          <span>Kekuatan Password</span>
          <span className="font-semibold">{password ? STRENGTH_LEVELS[score].label : "—"}</span>
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-2" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1 rounded-full", password && i <= score ? STRENGTH_LEVELS[score].bar : "bg-ink/15")} />
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-line bg-surface p-3.5">
        <p className="text-[13px] font-medium text-ink-muted">Ketentuan Keamanan</p>
        <ul className="mt-2 space-y-1.5">
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.id} className={cn("flex items-center gap-2 text-xs", ok ? "font-medium text-success-ink" : "text-ink-muted")}>
                {ok ? <Check className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
                {r.label}
                <span className="sr-only">{ok ? "(terpenuhi)" : "(belum terpenuhi)"}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">Simbol tidak wajib.</p>
      </div>
    </>
  );
}
