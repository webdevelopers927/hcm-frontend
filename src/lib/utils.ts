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

/** Time since joining. Never negative: a future join date is "New joiner", under a month is "< 1 mo". */
export function tenure(iso: string, now = new Date()) {
  const start = parseDate(iso);
  if (start > now) return "New joiner";
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return "< 1 mo";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  return m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
}

/** "YYYY-MM-DD" as a local date (new Date() would read it as UTC midnight). */
function parseDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
}

/** Today as local "YYYY-MM-DD". */
export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

/** Today (local) as "YYYY-MM-DD", fixed when the module loads. */
export const TODAY = todayIso();

export function daysUntil(iso: string, from = TODAY) {
  return Math.round((new Date(iso).getTime() - new Date(from).getTime()) / 86_400_000);
}
