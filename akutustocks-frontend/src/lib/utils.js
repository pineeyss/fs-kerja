import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDateLong(date = new Date()) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatNumber(n) {
  return new Intl.NumberFormat("id-ID").format(n ?? 0);
}

/** "10 menit yang lalu", "2 jam yang lalu", atau tanggal bila lebih dari sehari. */
export function timeAgo(iso) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit yang lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam yang lalu`;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}
