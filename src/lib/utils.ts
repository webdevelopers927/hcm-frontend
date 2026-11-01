import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function formatPKR(value: number) {
  return `PKR ${value.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(iso).toLocaleDateString("en-GB", opts);
}

export function tenure(iso: string, now = new Date("2026-11-01")) {
  const start = new Date(iso);
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${Math.max(m, 0)} mo`;
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
}

/** Masks all but the last `visible` characters, keeping separators. */
export function mask(value: string, visible = 4) {
  let seen = 0;
  return value
    .split("")
    .reverse()
    .map((ch) => {
      if (!/[0-9A-Za-z]/.test(ch)) return ch;
      seen += 1;
      return seen <= visible ? ch : "•";
    })
    .reverse()
    .join("");
}

/** Demo "today" so mock data stays meaningful. Swap for `new Date()` with a real API. */
export const TODAY = "2026-11-01";

export function daysUntil(iso: string, from = TODAY) {
  return Math.round((new Date(iso).getTime() - new Date(from).getTime()) / 86_400_000);
}
