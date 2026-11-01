import type { EmployeeFilters, EmployeeStatus, ShiftRef, WorkMode } from "./types";

/* Display helpers for API values. Labels from /employees/filters win when loaded. */

export const STATUS_ORDER: EmployeeStatus[] = ["active", "probation", "on_leave", "notice_period", "inactive"];

const fallbackStatus: Record<EmployeeStatus, string> = {
  active: "Active",
  probation: "Probation",
  on_leave: "On leave",
  notice_period: "Notice period",
  inactive: "Inactive",
};
const fallbackMode: Record<WorkMode, string> = { onsite: "Onsite", hybrid: "Hybrid", remote: "Remote" };

export function statusLabel(s: EmployeeStatus, filters?: EmployeeFilters) {
  return filters?.statuses.find((x) => x.value === s)?.label ?? fallbackStatus[s];
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
