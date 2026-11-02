import type { EmploymentStatusRef, EmployeeFilters, ShiftRef, WorkMode } from "./types";

/* Display helpers for API values. Labels from /employees/filters win when loaded. */

const fallbackMode: Record<WorkMode, string> = { onsite: "Onsite", hybrid: "Hybrid", remote: "Remote" };

/** No colour comes from the API, so it follows the flags: left → muted, blocked (e.g. suspended) → bad, notice → warn, else ok. */
export function employmentStatusTone(s: Pick<EmploymentStatusRef, "can_login" | "is_notice_period" | "is_exit">): "ok" | "warn" | "bad" | "neutral" {
  if (s.is_exit) return "neutral";
  if (!s.can_login) return "bad";
  return s.is_notice_period ? "warn" : "ok";
}

export function workModeLabel(m: WorkMode, filters?: EmployeeFilters) {
  return filters?.work_modes.find((x) => x.value === m)?.label ?? fallbackMode[m];
}

export function shiftLabel(s: ShiftRef | null) {
  return s ? `${s.name} ${s.start}–${s.end}` : "—";
}

/** Stable avatar colour per employee id. */
export function hueFor(id: number) {
  return (id * 47 + 20) % 360;
}

/* ---------- PII masks ---------- */

export const CNIC_MASK = "•••••-•••••••-•";

/** Formats digits typed into a CNIC field as 00000-0000000-0. */
export function formatCnicInput(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}
