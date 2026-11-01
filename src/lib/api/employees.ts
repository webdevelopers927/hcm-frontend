import { apiDownload, apiFetch } from "./client";
import type {
  BoundDevice,
  BulkDeleteResponse,
  City,
  Country,
  DegreeProgram,
  Division,
  DraftListItem,
  EmployeeDetail,
  EmployeeFilters,
  EmployeeListResponse,
  EmployeePayload,
  EmployeeProfile,
  EmployeeQuery,
  EmployeeSensitive,
  FormOptions,
  GeoState,
  IdName,
  ImportCommitResponse,
  ImportDryRunResponse,
  ImportRowError,
  Paginated,
  Upload,
  UploadPurpose,
  User,
} from "./types";

/* ---------- auth ---------- */

export async function login(email: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => ({}))) as { user?: User; message?: string; errors?: Record<string, string[]> };
  return { ok: res.ok, status: res.status, retryAfter: Number(res.headers.get("retry-after")) || null, ...data };
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
}

export const getMe = (signal?: AbortSignal) => apiFetch<{ data: User }>("auth/me", { signal }).then((r) => r.data);

/* ---------- employees ---------- */

export const employeeKeys = {
  all: ["employees"] as const,
  list: (q: EmployeeQuery) => ["employees", "list", q] as const,
  detail: (id: number) => ["employees", "detail", id] as const,
  device: (id: number) => ["employees", "device", id] as const,
  filters: ["employees", "filters"] as const,
  formOptions: ["employees", "form-options"] as const,
  details: (id: number) => ["employees", "details", id] as const,
  drafts: (q: { search?: string; page?: number; per_page?: number }) => ["employees", "drafts", q] as const,
};

export const listEmployees = (query: EmployeeQuery, signal?: AbortSignal) => apiFetch<EmployeeListResponse>("employees", { query: { ...query }, signal });

export const getEmployeeFilters = (signal?: AbortSignal) => apiFetch<{ data: EmployeeFilters }>("employees/filters", { signal }).then((r) => r.data);

export const getEmployee = (id: number, signal?: AbortSignal) => apiFetch<{ data: EmployeeProfile }>(`employees/${id}`, { signal }).then((r) => r.data);

/** Audit-logged on the server. Call only on an explicit "Reveal"; never cache. */
export const getEmployeeSensitive = (id: number) => apiFetch<{ data: EmployeeSensitive }>(`employees/${id}/sensitive`).then((r) => r.data);

/* ---------- employee form & drafts ---------- */

export const getFormOptions = (signal?: AbortSignal) => apiFetch<{ data: FormOptions }>("employees/form-options", { signal }).then((r) => r.data);

/** Works for drafts and real employees. */
export const getEmployeeDetail = (id: number, signal?: AbortSignal) => apiFetch<{ data: EmployeeDetail }>(`employees/${id}/details`, { signal }).then((r) => r.data);

export const createDraft = (payload: EmployeePayload) => apiFetch<{ data: EmployeeDetail }>("employees/drafts", { method: "POST", body: payload }).then((r) => r.data);

/** Sends only changed keys; returns the full detail to refresh the form from. */
export const updateEmployee = (id: number, changes: EmployeePayload) =>
  apiFetch<{ data: EmployeeDetail }>(`employees/${id}`, { method: "PATCH", body: changes }).then((r) => r.data);

/** 422 → still a draft (errors list what's missing); 409 → already submitted. */
export const submitDraft = (id: number) => apiFetch<{ data: EmployeeProfile }>(`employees/${id}/submit`, { method: "POST" }).then((r) => r.data);

export const listDrafts = (query: { search?: string; page?: number; per_page?: number }, signal?: AbortSignal) =>
  apiFetch<Paginated<DraftListItem>>("employees/drafts", { query, signal });

export function uploadFile(purpose: UploadPurpose, file: File) {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", file);
  return apiFetch<{ data: Upload }>("uploads", { method: "POST", body: form }).then((r) => r.data);
}

/** Private files: `download_url` is absolute to the API, so route it through this app's proxy. */
export function downloadPrivateFile(downloadUrl: string, filename: string) {
  const path = downloadUrl.includes("/api/v1/") ? downloadUrl.slice(downloadUrl.indexOf("/api/v1/") + "/api/v1/".length) : downloadUrl;
  return apiDownload(path, {}, filename);
}

/* ---------- geo reference data ---------- */

export const geoKeys = {
  countries: ["geo", "countries"] as const,
  states: (countryId: number) => ["geo", "states", countryId] as const,
  cities: (stateId: number, search: string) => ["geo", "cities", stateId, search] as const,
  nationalities: ["geo", "nationalities"] as const,
};

export const listCountries = (signal?: AbortSignal) => apiFetch<{ data: Country[] }>("countries", { signal }).then((r) => r.data);
export const listStates = (countryId: number, signal?: AbortSignal) => apiFetch<{ data: GeoState[] }>(`countries/${countryId}/states`, { signal }).then((r) => r.data);
export const searchCities = (stateId: number, search: string, signal?: AbortSignal) =>
  apiFetch<Paginated<City>>(`states/${stateId}/cities`, { query: { search, per_page: 50 }, signal }).then((r) => r.data);
export const listNationalities = (signal?: AbortSignal) => apiFetch<{ data: IdName[] }>("nationalities", { signal }).then((r) => r.data);

/* ---------- admin lookups ---------- */

export type LookupResource = "divisions" | "degree-programs";
type LookupRow<R extends LookupResource> = R extends "divisions" ? Division : DegreeProgram;

export const lookupKeys = { list: (r: LookupResource, search: string) => ["lookups", r, search] as const };

export const listLookup = <R extends LookupResource>(resource: R, search: string, signal?: AbortSignal) =>
  apiFetch<{ data: LookupRow<R>[] }>(resource, { query: { search }, signal }).then((r) => r.data);
export const createLookup = <R extends LookupResource>(resource: R, name: string) =>
  apiFetch<{ data: LookupRow<R> }>(resource, { method: "POST", body: { name } }).then((r) => r.data);
export const renameLookup = <R extends LookupResource>(resource: R, id: number, name: string) =>
  apiFetch<{ data: LookupRow<R> }>(`${resource}/${id}`, { method: "PATCH", body: { name } }).then((r) => r.data);
/** 409 with a readable message while the row is still in use. */
export const deleteLookup = (resource: LookupResource, id: number) => apiFetch<{ message: string }>(`${resource}/${id}`, { method: "DELETE" });

export const deleteEmployee = (id: number) => apiFetch<{ message: string }>(`employees/${id}`, { method: "DELETE" });

export const bulkDeleteEmployees = (ids: number[]) => apiFetch<BulkDeleteResponse>("employees/bulk-delete", { method: "POST", body: { ids } });

export const resetTwoFactor = (id: number) => apiFetch<{ message: string; two_factor_enabled: false }>(`employees/${id}/two-factor/reset`, { method: "POST" });

export const getDevice = (id: number) => apiFetch<{ data: BoundDevice | null }>(`employees/${id}/device`).then((r) => r.data);

export const unbindDevice = (id: number) => apiFetch<{ message: string; device_bound: false }>(`employees/${id}/device/unbind`, { method: "POST" });

/* ---------- bulk import ---------- */

export const downloadImportTemplate = () => apiDownload("employees/import/template", {}, "employee-import-template.csv");

/**
 * Validates (dryRun) or imports a CSV/XLSX. All-or-nothing on the server:
 * any row error → 422 and nothing is saved.
 */
export function importEmployees<D extends boolean>(file: File, { dryRun }: { dryRun: D }) {
  const form = new FormData();
  form.append("file", file);
  form.append("dry_run", dryRun ? "1" : "0");
  return apiFetch<D extends true ? ImportDryRunResponse : ImportCommitResponse>("employees/import", { method: "POST", body: form });
}

/** Turns `rows.<line>.<column>` keys into sorted row errors; `file` is returned separately. */
export function parseImportErrors(errors: Record<string, string[]>): { file?: string; rows: ImportRowError[] } {
  const rows: ImportRowError[] = [];
  let file: string | undefined;
  for (const [key, messages] of Object.entries(errors)) {
    if (key === "file") {
      file = messages[0];
      continue;
    }
    const m = /^rows\.(\d+)\.(.+)$/.exec(key);
    if (m) rows.push({ line: Number(m[1]), column: m[2]!, messages });
  }
  rows.sort((a, b) => a.line - b.line || a.column.localeCompare(b.column));
  return { file, rows };
}

/** Streams a CSV/XLSX of the filtered (or selected) employees. */
export function exportEmployees(query: Omit<EmployeeQuery, "page" | "per_page">, format: "csv" | "xlsx", ids?: number[]) {
  return apiDownload("employees/export", { method: "POST", body: { ...query, ...(ids?.length ? { ids } : {}), format } }, `employees.${format}`);
}
