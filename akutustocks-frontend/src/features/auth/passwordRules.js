import { z } from "zod";

export const PASSWORD_RULES = [
  { id: "len", label: "Minimal 8 karakter", test: (p) => p.length >= 8 },
  { id: "upper", label: "Memiliki huruf besar (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "Memiliki huruf kecil (a-z)", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "Memiliki angka (0-9)", test: (p) => /\d/.test(p) },
];

export const STRENGTH_LEVELS = [
  { label: "Terlalu Lemah", bar: "bg-danger" },
  { label: "Lemah", bar: "bg-danger" },
  { label: "Cukup", bar: "bg-warning" },
  { label: "Kuat", bar: "bg-success" },
  { label: "Sangat Kuat", bar: "bg-success" },
];

/** 0-4. Semua aturan terpenuhi = Kuat; simbol (opsional) atau >= 12 karakter = Sangat Kuat. */
export function passwordStrength(p) {
  if (!p) return 0;
  const met = PASSWORD_RULES.filter((r) => r.test(p)).length;
  if (met === PASSWORD_RULES.length) return /[^A-Za-z0-9]/.test(p) || p.length >= 12 ? 4 : 3;
  return Math.max(0, met - 1);
}

export const passwordSchema = z
  .string()
  .min(8, "Password minimal 8 karakter")
  .regex(/[A-Z]/, "Password harus memiliki huruf besar")
  .regex(/[a-z]/, "Password harus memiliki huruf kecil")
  .regex(/\d/, "Password harus memiliki angka");
