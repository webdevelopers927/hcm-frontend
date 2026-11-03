"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FilePen,
  LayoutGrid,
  Link2Off,
  List,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/components/session/session-provider";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { shiftLabel } from "@/lib/api/display";
import { bulkDeleteEmployees, deleteEmployee, employeeKeys, exportEmployees, getDevice, listDrafts, listEmployees, resetTwoFactor, unbindDevice } from "@/lib/api/employees";
import type { BulkDeleteResponse, EmployeeListItem, EmployeeListResponse, EmployeeQuery, EmployeeSort, WorkMode } from "@/lib/api/types";
import { cn, formatDate, tenure } from "@/lib/utils";
import { ApiModeBadge, ApiStatusBadge, ConfirmDialog, EmployeeAvatar, ErrorState, Skeleton, useEmployeeFilters, useSlow } from "./api-ui";
import { ImportDialog } from "./import-dialog";
import { ModuleHeader } from "./module-kit";

/* ---------------- URL ⇄ query ---------------- */

const ARRAY_KEYS = ["employment_status_id", "department_id", "designation_id", "location_id", "shift_id", "work_mode"] as const;
const SORTS: EmployeeSort[] = ["name", "-name", "join_date", "-join_date", "department", "-department", "code", "-code"];
const PAGE_SIZES = [12, 24, 48];

function readQuery(sp: URLSearchParams): EmployeeQuery {
  const list = (k: string) => (sp.get(k) ?? "").split(",").filter(Boolean);
  const nums = (k: string) => list(k).map(Number).filter(Number.isFinite);
  const sort = sp.get("sort") as EmployeeSort | null;
  const perPage = Number(sp.get("per_page"));
  return {
    search: sp.get("search") ?? undefined,
    employment_status_id: nums("employment_status_id"),
    on_notice: sp.get("on_notice") === "1" ? 1 : undefined,
    department_id: nums("department_id"),
    designation_id: nums("designation_id"),
    location_id: nums("location_id"),
    shift_id: nums("shift_id"),
    work_mode: list("work_mode") as WorkMode[],
    sort: sort && SORTS.includes(sort) ? sort : "name",
    page: Math.max(1, Number(sp.get("page")) || 1),
    per_page: PAGE_SIZES.includes(perPage) ? perPage : 12,
  };
}

/** URL uses readable comma lists (employment_status_id=1,2); the API gets arrays. */
function writeQuery(q: EmployeeQuery) {
  const sp = new URLSearchParams();
  if (q.search) sp.set("search", q.search);
  for (const k of ARRAY_KEYS) {
    const v = q[k];
    if (v && v.length) sp.set(k, v.join(","));
  }
  if (q.on_notice) sp.set("on_notice", "1");
  if (q.sort && q.sort !== "name") sp.set("sort", q.sort);
  if (q.page && q.page > 1) sp.set("page", String(q.page));
  if (q.per_page && q.per_page !== 12) sp.set("per_page", String(q.per_page));
  return sp.toString();
}

function apiQuery(q: EmployeeQuery): EmployeeQuery {
  // Drop empty arrays so the cache key stays stable.
  return Object.fromEntries(Object.entries(q).filter(([, v]) => !(Array.isArray(v) && v.length === 0) && v !== undefined && v !== "")) as EmployeeQuery;
}

const failureReason: Record<BulkDeleteResponse["failed"][number]["reason"], string> = {
  not_found: "Already deleted or doesn't exist",
  cannot_delete_self: "You can't delete your own record",
  forbidden: "You don't have permission",
};

/* ---------------- page ---------------- */

export function EmployeesView() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const { can } = useSession();
  const filtersQ = useEmployeeFilters();

  const query = useMemo(() => apiQuery(readQuery(new URLSearchParams(sp.toString()))), [sp]);
  const key = writeQuery(query);
  const setQuery = (patch: Partial<EmployeeQuery>, resetPage = true) => {
    const next = { ...query, ...patch, ...(resetPage && !("page" in patch) ? { page: 1 } : {}) };
    const qs = writeQuery(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Drafts never appear in this list; surface how many are waiting.
  const drafts = useQuery({ queryKey: employeeKeys.drafts({ per_page: 1 }), queryFn: ({ signal }) => listDrafts({ per_page: 1 }, signal), enabled: can("employees.create") });

  const list = useQuery({
    queryKey: employeeKeys.list(query),
    queryFn: ({ signal }) => listEmployees(query, signal),
    placeholderData: keepPreviousData,
  });
  const stale = useSlow(list.isPlaceholderData);

  // Debounced search, kept in sync when the URL changes from elsewhere (e.g. "Clear all").
  const [q, setQ] = useState(query.search ?? "");
  const [syncedSearch, setSyncedSearch] = useState(query.search ?? "");
  if ((query.search ?? "") !== syncedSearch) {
    setSyncedSearch(query.search ?? "");
    setQ(query.search ?? "");
  }
  useEffect(() => {
    if (q === (query.search ?? "")) return;
    const t = setTimeout(() => setQuery({ search: q.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [q]);

  const [view, setView] = useState<"table" | "grid">("table");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectionKey, setSelectionKey] = useState(key);
  if (key !== selectionKey) {
    // New filters or page → previous selection no longer visible.
    setSelectionKey(key);
    setSelected(new Set());
  }
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [preview, setPreview] = useState<EmployeeListItem | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "delete" | "bulk" | "reset2fa" | "unbind"; rows: EmployeeListItem[] } | null>(null);
  const [bulkResult, setBulkResult] = useState<{ res: BulkDeleteResponse; names: Map<number, string> } | null>(null);
  const [deviceFor, setDeviceFor] = useState<EmployeeListItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const counts = list.data?.status_counts;
  const statuses = filtersQ.data?.employment_statuses ?? [];
  const activeStatus = query.employment_status_id?.length === 1 ? query.employment_status_id[0] : undefined;
  const filterCount = (query.department_id?.length ?? 0) + (query.designation_id?.length ?? 0) + (query.location_id?.length ?? 0) + (query.shift_id?.length ?? 0) + (query.work_mode?.length ?? 0);
  const hasFilters = filterCount > 0 || !!query.search || !!query.employment_status_id?.length || !!query.on_notice;
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const patchRow = (id: number, patch: Partial<EmployeeListItem>) =>
    qc.setQueryData<EmployeeListResponse>(employeeKeys.list(query), (old) => (old ? { ...old, data: old.data.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : old));

  const action = useMutation({
    mutationFn: async ({ kind, rows: targets }: { kind: "delete" | "bulk" | "reset2fa" | "unbind"; rows: EmployeeListItem[] }) => {
      const r = targets[0]!;
      if (kind === "delete") return { kind, msg: (await deleteEmployee(r.id)).message };
      if (kind === "reset2fa") return { kind, msg: (await resetTwoFactor(r.id)).message, id: r.id };
      if (kind === "unbind") {
        patchRow(r.id, { device_bound: false });
        return { kind, msg: (await unbindDevice(r.id)).message, id: r.id };
      }
      return { kind, bulk: await bulkDeleteEmployees(targets.map((t) => t.id)), names: new Map(targets.map((t) => [t.id, t.name])) };
    },
    onSuccess: (res) => {
      if (res.kind === "bulk" && res.bulk) {
        const n = res.bulk.deleted.length;
        toast(n ? `Deleted ${n} employee${n === 1 ? "" : "s"}` : "No employees were deleted", n ? "ok" : "bad");
        if (res.bulk.failed.length) setBulkResult({ res: res.bulk, names: res.names });
        setSelected(new Set());
      } else {
        toast(res.msg ?? "Done");
        if (res.kind === "reset2fa" && res.id) patchRow(res.id, { two_factor_enabled: false });
      }
      if (res.kind === "delete" || res.kind === "bulk") {
        setPreview(null);
        void qc.invalidateQueries({ queryKey: employeeKeys.all });
      }
      setConfirm(null);
    },
    onError: (e, vars) => {
      if (vars.kind === "unbind") patchRow(vars.rows[0]!.id, { device_bound: true });
      toast(e instanceof ApiError ? e.field("employee") ?? e.field("device") ?? e.message : errorMessage(e), "bad");
      setConfirm(null);
    },
  });

  async function runExport(format: "csv" | "xlsx", ids?: number[]) {
    setExporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- pagination isn't part of an export
      const { page, per_page, ...filters } = query;
      const name = await exportEmployees(filters, format, ids);
      toast(`Downloaded ${name}`);
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setExporting(false);
    }
  }

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const clearAll = () => router.replace(pathname, { scroll: false });

  return (
    <div className="space-y-5">
      <ModuleHeader
        title={meta ? `People · ${counts?.all ?? meta.total}` : "People"}
        description="Everyone in your organisation — search, filter and act on records in bulk."
        actions={
          <>
            {can("employees.create") && (
              <Link href="/employees/drafts" className="inline-flex">
                <Button variant="secondary" className="w-full justify-center">
                  <FilePen className="h-4 w-4" /> Drafts
                  {!!drafts.data?.meta.total && <span className="tabular rounded-md bg-warn-soft px-1.5 text-[11px] font-semibold text-warn">{drafts.data.meta.total}</span>}
                </Button>
              </Link>
            )}
            {can("employees.import") && (
              <Button variant="secondary" onClick={() => setImporting(true)}>
                <Upload className="h-4 w-4" /> Import
              </Button>
            )}
            {can("employees.export") && <ExportMenu busy={exporting} onExport={(f) => runExport(f)} />}
            {can("employees.create") && (
              <Link href="/employees/new" className="inline-flex">
                <Button variant="primary" className="w-full justify-center">
                  <Plus className="h-4 w-4" /> <span className="max-sm:hidden">Add employee</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Status tabs: counts come from the server and already honour the other filters. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Filter by status" className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1 shadow-soft">
          {[
            { key: "all", label: "All", count: counts?.all, on: !activeStatus && !query.on_notice && !(query.employment_status_id?.length ?? 0), patch: { employment_status_id: undefined, on_notice: undefined } },
            ...statuses.map((st) => ({
              key: String(st.id),
              label: st.name,
              count: counts?.by_status[String(st.id)],
              on: activeStatus === st.id && !query.on_notice,
              patch: { employment_status_id: [st.id], on_notice: undefined },
            })),
            { key: "notice", label: "On notice", count: counts?.on_notice, on: !!query.on_notice, patch: { employment_status_id: undefined, on_notice: 1 as const } },
          ]
            // Empty statuses add noise; keep "All" and whatever is selected.
            .filter((t) => t.key === "all" || t.on || !counts || (t.count ?? 0) > 0)
            .map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={t.on}
                onClick={() => setQuery(t.patch)}
                className={cn("inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition", t.on ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface-3 hover:text-ink")}
              >
                {t.label}
                <span className={cn("tabular min-w-4 text-[11px]", t.on ? "text-canvas/70" : "text-ink-3")}>{t.count ?? "·"}</span>
              </button>
            ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-md">
          <label htmlFor="emp-search" className="sr-only">Search employees</label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            id="emp-search"
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, code, email, machine UID…"
            className="h-10 w-full rounded-xl border border-line bg-surface pr-10 pl-10 text-sm text-ink shadow-soft outline-none placeholder:text-ink-3 focus:border-ink focus:ring-4 focus:ring-accent/40"
          />
          {q ? (
            <button onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-ink-3 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line px-1.5 font-mono text-[11px] text-ink-3 md:block">/</kbd>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="secondary" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-haspopup="dialog">
              <SlidersHorizontal className="h-4 w-4" /> Filters
              {filterCount > 0 && <span className="tabular rounded-md bg-accent px-1.5 text-[11px] font-semibold text-accent-ink">{filterCount}</span>}
            </Button>
            {filtersOpen && <FilterPanel query={query} onChange={(p) => setQuery(p)} onClose={() => setFiltersOpen(false)} />}
          </div>

          <Select
            className="w-44 md:hidden"
            aria-label="Sort by"
            value={query.sort ?? "name"}
            onChange={(v) => setQuery({ sort: v as EmployeeSort })}
            options={[
              { value: "name", label: "Name A–Z" },
              { value: "-name", label: "Name Z–A" },
              { value: "-join_date", label: "Newest joiners" },
              { value: "join_date", label: "Longest tenure" },
              { value: "department", label: "Department" },
              { value: "code", label: "Employee code" },
            ]}
          />

          {list.isFetching && !list.isPending && <Loader2 className="h-4 w-4 animate-spin text-ink-3" aria-label="Updating" />}

          <div className="ml-auto flex rounded-xl border border-line bg-surface p-0.5 shadow-soft md:ml-2">
            {([["table", List], ["grid", LayoutGrid]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} aria-pressed={view === v} className={cn("inline-flex h-8 w-9 items-center justify-center rounded-lg transition", view === v ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink")}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <ActiveChips query={query} onChange={(p) => setQuery(p)} onClearAll={clearAll} total={meta?.total} />

      {/* Results */}
      {list.isError && !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} title="Couldn't load employees" />
      ) : list.isPending || stale ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState filtered={hasFilters} onReset={clearAll} />
      ) : view === "table" ? (
        <Card className="overflow-hidden">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[12px] font-medium tracking-wide text-ink-3 uppercase">
                  <th className="w-12 py-3 pl-5">
                    <input type="checkbox" aria-label="Select all on this page" className="h-4 w-4 cursor-pointer accent-[var(--ink)]" checked={allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(rows.map((r) => r.id)))} />
                  </th>
                  <SortHeader label="Employee" field="name" sort={query.sort} onSort={(s) => setQuery({ sort: s })} />
                  <SortHeader label="Role" field="department" sort={query.sort} onSort={(s) => setQuery({ sort: s })} />
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="hidden py-3 pr-4 font-medium xl:table-cell">Work mode</th>
                  <th className="hidden py-3 pr-4 font-medium lg:table-cell">Shift</th>
                  <th className="hidden py-3 pr-4 font-medium 2xl:table-cell">Location</th>
                  <SortHeader label="Joined" field="join_date" sort={query.sort} onSort={(s) => setQuery({ sort: s })} />
                  <th className="py-3 pr-4 font-medium"><span className="sr-only">Security</span></th>
                  <th className="w-12 py-3 pr-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className={cn("divide-y divide-line transition-opacity", list.isPlaceholderData && "opacity-60")}>
                {rows.map((e) => (
                  <tr key={e.id} onClick={() => setPreview(e)} className={cn("group cursor-pointer transition", selected.has(e.id) ? "bg-accent-soft/60" : "hover:bg-surface-2")}>
                    <td className="py-3 pl-5" onClick={(ev) => ev.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${e.name}`} className="h-4 w-4 cursor-pointer accent-[var(--ink)]" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar e={e} />
                        <div className="min-w-0">
                          <Link href={`/employees/${e.id}`} onClick={(ev) => ev.stopPropagation()} className="block truncate font-semibold text-ink hover:underline">
                            {e.name}
                            {e.pseudo_name && e.pseudo_name !== e.name.split(" ")[0] && <span className="font-normal text-ink-3"> · {e.pseudo_name}</span>}
                          </Link>
                          <div className="tabular truncate text-[12px] text-ink-3">
                            {e.code}
                            {e.machine_uid && ` · UID ${e.machine_uid}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="truncate font-medium text-ink">{e.designation?.name ?? "—"}</div>
                      <div className="truncate text-[12px] text-ink-3">{e.department?.name ?? "—"}</div>
                    </td>
                    <td className="py-3 pr-4"><ApiStatusBadge status={e.employment_status} /></td>
                    <td className="hidden py-3 pr-4 xl:table-cell"><ApiModeBadge mode={e.work_mode} /></td>
                    <td className="tabular hidden py-3 pr-4 text-[13px] text-ink-2 lg:table-cell">{shiftLabel(e.shift)}</td>
                    <td className="hidden py-3 pr-4 text-[13px] text-ink-2 2xl:table-cell">{e.location?.name ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <div className="tabular text-[13px] text-ink">{formatDate(e.join_date)}</div>
                      <div className="text-[12px] text-ink-3">{tenure(e.join_date)}</div>
                    </td>
                    <td className="py-3 pr-4"><SecurityIcons e={e} /></td>
                    <td className="py-3 pr-4" onClick={(ev) => ev.stopPropagation()}>
                      <RowMenu
                        e={e}
                        onView={() => setPreview(e)}
                        onDevice={() => setDeviceFor(e)}
                        onAction={(kind) => setConfirm({ kind, rows: [e] })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className={cn("divide-y divide-line md:hidden", list.isPlaceholderData && "opacity-60")}>
            {rows.map((e) => (
              <li key={e.id} className={cn("flex items-center gap-3 px-4 py-3.5", selected.has(e.id) && "bg-accent-soft/60")}>
                <input type="checkbox" aria-label={`Select ${e.name}`} className="h-4 w-4 accent-[var(--ink)]" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                <button onClick={() => setPreview(e)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <EmployeeAvatar e={e} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{e.name}</span>
                      <ApiStatusBadge status={e.employment_status} />
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-ink-3">
                      {e.designation?.name ?? "—"} · {e.code}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {meta && <Pagination meta={meta} onPage={(p) => setQuery({ page: p }, false)} onPageSize={(n) => setQuery({ per_page: n })} />}
        </Card>
      ) : (
        <>
          <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-4", list.isPlaceholderData && "opacity-60")}>
            {rows.map((e) => (
              <PersonCard key={e.id} e={e} selected={selected.has(e.id)} onSelect={() => toggle(e.id)} onOpen={() => setPreview(e)} />
            ))}
          </div>
          {meta && (
            <Card>
              <Pagination meta={meta} onPage={(p) => setQuery({ page: p }, false)} onPageSize={(n) => setQuery({ per_page: n })} />
            </Card>
          )}
        </>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-xl animate-rise items-center gap-2 rounded-2xl bg-[#15171c] p-2 pl-4 text-[#f2f2ee] shadow-pop md:bottom-6 dark:bg-surface-3">
          <span className="tabular text-sm font-medium">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-[13px] text-white/60 hover:text-white">Clear</button>
          <div className="ml-auto flex gap-1.5">
            {can("employees.export") && (
              <button
                disabled={exporting}
                onClick={() => runExport("csv", [...selected])}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[13px] font-medium hover:bg-white/15 disabled:opacity-50"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
              </button>
            )}
            {can("employees.delete") && (
              <button
                onClick={() => setConfirm({ kind: "bulk", rows: rows.filter((r) => selected.has(r.id)) })}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#c43d3d] px-3 text-[13px] font-medium text-white hover:opacity-90"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {preview && (
        <PreviewDrawer
          e={rows.find((r) => r.id === preview.id) ?? preview}
          onClose={() => setPreview(null)}
          onDelete={() => setConfirm({ kind: "delete", rows: [preview] })}
        />
      )}

      {confirm && (
        <ActionConfirm
          kind={confirm.kind}
          rows={confirm.rows}
          busy={action.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={() => action.mutate(confirm)}
        />
      )}

      {bulkResult && (
        <ConfirmDialog
          title={`${bulkResult.res.failed.length} couldn't be deleted`}
          body={bulkResult.res.deleted.length ? `${bulkResult.res.deleted.length} employee${bulkResult.res.deleted.length === 1 ? " was" : "s were"} deleted.` : undefined}
          confirmLabel="OK"
          onConfirm={() => setBulkResult(null)}
          onCancel={() => setBulkResult(null)}
        >
          <ul className="mt-4 max-h-60 space-y-2 overflow-y-auto">
            {bulkResult.res.failed.map((f) => (
              <li key={f.id} className="rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
                <span className="font-semibold text-ink">{bulkResult.names.get(f.id) ?? `#${f.id}`}</span>
                <span className="text-ink-3"> — {failureReason[f.reason]}</span>
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      )}

      {deviceFor && <DeviceDialog e={deviceFor} onClose={() => setDeviceFor(null)} />}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
    </div>
  );
}

/* ---------------- pieces ---------------- */

function SortHeader({ label, field, sort, onSort }: { label: string; field: "name" | "department" | "join_date" | "code"; sort?: EmployeeSort; onSort: (s: EmployeeSort) => void }) {
  const asc = sort === field;
  const desc = sort === `-${field}`;
  return (
    <th className="py-3 pr-4 font-medium" aria-sort={asc ? "ascending" : desc ? "descending" : "none"}>
      <button onClick={() => onSort(asc ? (`-${field}` as EmployeeSort) : (field as EmployeeSort))} className={cn("inline-flex items-center gap-1 uppercase hover:text-ink", (asc || desc) && "text-ink")}>
        {label}
        {asc ? <ArrowUp className="h-3 w-3" /> : desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3 opacity-0" />}
      </button>
    </th>
  );
}

function SecurityIcons({ e }: { e: EmployeeListItem }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-3">
      {e.two_factor_enabled ? <ShieldCheck className="h-4 w-4 text-ok" aria-label="2FA on" /> : <ShieldOff className="h-4 w-4" aria-label="2FA off" />}
      {e.device_bound && <Smartphone className="h-4 w-4 text-ink-2" aria-label="Mobile device bound" />}
    </span>
  );
}

function ExportMenu({ busy, onExport }: { busy: boolean; onExport: (f: "csv" | "xlsx") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-flex">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)} disabled={busy} aria-haspopup="menu" aria-expanded={open} className="w-full justify-center">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {busy ? "Exporting…" : "Export"}
      </Button>
      {open && (
        <div role="menu" className="absolute top-12 right-0 z-30 w-48 animate-rise rounded-xl border border-line bg-surface p-1 shadow-pop">
          {(["csv", "xlsx"] as const).map((f) => (
            <button key={f} role="menuitem" onClick={() => { setOpen(false); onExport(f); }} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink">
              {f === "csv" ? "CSV" : "Excel (.xlsx)"}
              <span className="text-[11px] text-ink-3">current filters</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPanel({ query, onChange, onClose }: { query: EmployeeQuery; onChange: (p: Partial<EmployeeQuery>) => void; onClose: () => void }) {
  const { data, isPending, isError, refetch } = useEmployeeFilters();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest("[aria-haspopup='dialog']")) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const flip = <T,>(list: T[] | undefined, v: T) => ((list ?? []).includes(v) ? (list ?? []).filter((x) => x !== v) : [...(list ?? []), v]);
  const designations = data?.designations.filter((d) => !query.department_id?.length || d.department_id === null || query.department_id.includes(d.department_id)) ?? [];

  return (
    <div ref={ref} role="dialog" aria-label="Filters" className="fixed inset-x-3 top-[12vh] z-40 max-h-[76vh] animate-rise overflow-y-auto rounded-2xl border border-line bg-surface p-4 shadow-pop sm:absolute sm:inset-x-auto sm:top-12 sm:left-0 sm:w-[400px]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Filter people</h3>
        <button onClick={onClose} aria-label="Close filters" className="rounded-md p-1 text-ink-3 hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      {isPending ? (
        <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
      ) : isError || !data ? (
        <p className="text-[13px] text-bad">Couldn&apos;t load filter options. <button className="underline" onClick={() => refetch()}>Retry</button></p>
      ) : (
        <div className="space-y-4">
          <ToggleGroup label="Department" items={data.departments} selected={query.department_id} onToggle={(id) => onChange({ department_id: flip(query.department_id, id), designation_id: undefined })} />
          {designations.length > 0 && <ToggleGroup label="Designation" items={designations} selected={query.designation_id} onToggle={(id) => onChange({ designation_id: flip(query.designation_id, id) })} />}
          <ToggleGroup label="Location" items={data.locations} selected={query.location_id} onToggle={(id) => onChange({ location_id: flip(query.location_id, id) })} />
          <ToggleGroup label="Shift" items={data.shifts.map((s) => ({ id: s.id, name: shiftLabel(s) }))} selected={query.shift_id} onToggle={(id) => onChange({ shift_id: flip(query.shift_id, id) })} />
          <fieldset>
            <legend className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Work mode</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.work_modes.map((m) => (
                <Toggle key={m.value} on={!!query.work_mode?.includes(m.value)} onClick={() => onChange({ work_mode: flip(query.work_mode, m.value) })}>{m.label}</Toggle>
              ))}
            </div>
          </fieldset>
        </div>
      )}
      <div className="mt-5 flex justify-between border-t border-line pt-3">
        <Button size="sm" variant="ghost" onClick={() => onChange({ department_id: undefined, designation_id: undefined, location_id: undefined, shift_id: undefined, work_mode: undefined })}>Reset</Button>
        <Button size="sm" variant="primary" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

function ToggleGroup({ label, items, selected, onToggle }: { label: string; items: { id: number; name: string }[]; selected?: number[]; onToggle: (id: number) => void }) {
  if (!items.length) return null;
  return (
    <fieldset>
      <legend className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{label}</legend>
      <div className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
        {items.map((i) => (
          <Toggle key={i.id} on={!!selected?.includes(i.id)} onClick={() => onToggle(i.id)}>{i.name}</Toggle>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={cn("h-8 rounded-lg border px-2.5 text-[13px] font-medium transition", on ? "border-ink bg-ink text-canvas" : "border-line text-ink-2 hover:border-line-strong hover:text-ink")}>
      {children}
    </button>
  );
}

function ActiveChips({ query, onChange, onClearAll, total }: { query: EmployeeQuery; onChange: (p: Partial<EmployeeQuery>) => void; onClearAll: () => void; total?: number }) {
  const { data } = useEmployeeFilters();
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const named = (k: "department_id" | "designation_id" | "location_id" | "shift_id", list: { id: number; name: string }[] | undefined) =>
    query[k]?.forEach((id) => chips.push({ key: `${k}-${id}`, label: list?.find((x) => x.id === id)?.name ?? `#${id}`, remove: () => onChange({ [k]: query[k]!.filter((x) => x !== id) }) }));
  named("department_id", data?.departments);
  named("designation_id", data?.designations);
  named("location_id", data?.locations);
  named("shift_id", data?.shifts);
  query.work_mode?.forEach((m) => chips.push({ key: `wm-${m}`, label: data?.work_modes.find((x) => x.value === m)?.label ?? m, remove: () => onChange({ work_mode: query.work_mode!.filter((x) => x !== m) }) }));
  if (query.employment_status_id && query.employment_status_id.length > 1)
    query.employment_status_id.forEach((id) =>
      chips.push({ key: `st-${id}`, label: data?.employment_statuses.find((x) => x.id === id)?.name ?? `#${id}`, remove: () => onChange({ employment_status_id: query.employment_status_id!.filter((x) => x !== id) }) }),
    );
  if (query.search) chips.push({ key: "q", label: `“${query.search}”`, remove: () => onChange({ search: undefined }) });
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface pr-1 pl-3 text-[13px] font-medium text-ink">
          {c.label}
          <button onClick={c.remove} aria-label={`Remove filter ${c.label}`} className="rounded-full p-0.5 text-ink-3 hover:bg-surface-3 hover:text-ink"><X className="h-3.5 w-3.5" /></button>
        </span>
      ))}
      <button onClick={onClearAll} className="text-[13px] font-medium text-ink-3 underline-offset-4 hover:text-ink hover:underline">Clear all</button>
      {total !== undefined && <span className="tabular ml-auto text-[13px] text-ink-3">{total} results</span>}
    </div>
  );
}

function RowMenu({ e, onView, onDevice, onAction }: { e: EmployeeListItem; onView: () => void; onDevice: () => void; onAction: (k: "delete" | "reset2fa" | "unbind") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => !ref.current?.contains(ev.target as Node) && setOpen(false);
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink";
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Actions for ${e.name}`} aria-haspopup="menu" aria-expanded={open} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 opacity-70 transition group-hover:opacity-100 hover:bg-surface-3 hover:text-ink focus-visible:opacity-100">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute top-9 right-0 z-30 w-56 animate-rise rounded-xl border border-line bg-surface p-1 shadow-pop">
          <button role="menuitem" className={item} onClick={run(onView)}><Eye className="h-4 w-4" /> Quick view</button>
          <Link role="menuitem" className={item} href={`/employees/${e.id}`}><Users className="h-4 w-4" /> Open profile</Link>
          {e.can.update && <Link role="menuitem" className={item} href={`/employees/${e.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>}
          {e.can.reset_2fa && e.two_factor_enabled && <button role="menuitem" className={item} onClick={run(() => onAction("reset2fa"))}><ShieldOff className="h-4 w-4" /> Reset 2FA</button>}
          {e.device_bound && <button role="menuitem" className={item} onClick={run(onDevice)}><Smartphone className="h-4 w-4" /> View bound device</button>}
          {e.can.unbind_device && e.device_bound && <button role="menuitem" className={item} onClick={run(() => onAction("unbind"))}><Link2Off className="h-4 w-4" /> Unbind device</button>}
          {e.can.delete && (
            <>
              <div className="my-1 h-px bg-line" />
              <button role="menuitem" className={cn(item, "text-bad hover:bg-bad-soft hover:text-bad")} onClick={run(() => onAction("delete"))}><Trash2 className="h-4 w-4" /> Delete</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActionConfirm({ kind, rows, busy, onCancel, onConfirm }: { kind: "delete" | "bulk" | "reset2fa" | "unbind"; rows: EmployeeListItem[]; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const one = rows[0]!;
  const copy = {
    delete: { title: `Delete ${one.name}?`, body: "They'll be removed from the directory and signed out everywhere.", cta: "Delete", danger: true },
    bulk: { title: `Delete ${rows.length} employee${rows.length === 1 ? "" : "s"}?`, body: "They'll be removed from the directory and signed out everywhere. Any that can't be deleted will be listed after.", cta: `Delete ${rows.length}`, danger: true },
    reset2fa: { title: `Reset 2FA for ${one.name}?`, body: "Their authenticator is removed; they'll set up two-factor again at next sign-in.", cta: "Reset 2FA", danger: true },
    unbind: { title: `Unbind ${one.name}'s device?`, body: "Mobile attendance stops working until they bind a new phone.", cta: "Unbind", danger: true },
  }[kind];
  return <ConfirmDialog title={copy.title} body={copy.body} confirmLabel={copy.cta} danger={copy.danger} busy={busy} onCancel={onCancel} onConfirm={onConfirm} />;
}

function DeviceDialog({ e, onClose }: { e: EmployeeListItem; onClose: () => void }) {
  const q = useQuery({ queryKey: employeeKeys.device(e.id), queryFn: () => getDevice(e.id), staleTime: 0 });
  return (
    <ConfirmDialog title={`${e.name}'s device`} confirmLabel="Close" onConfirm={onClose} onCancel={onClose}>
      <div className="mt-4">
        {q.isPending ? (
          <Skeleton className="h-20" />
        ) : q.isError ? (
          <p className="text-[13px] text-bad">{errorMessage(q.error)}</p>
        ) : !q.data ? (
          <p className="text-sm text-ink-3">No device is bound.</p>
        ) : (
          <dl className="divide-y divide-line rounded-xl border border-line text-sm">
            {[
              ["Model", q.data.model],
              ["Platform", q.data.platform === "ios" ? "iOS" : "Android"],
              ["Device ID", <span key="d" className="font-mono text-[12px]">{q.data.device_id}</span>],
              ["Bound", new Date(q.data.bound_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4 px-3 py-2.5">
                <dt className="text-ink-3">{k}</dt>
                <dd className="text-right font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </ConfirmDialog>
  );
}

function PersonCard({ e, selected, onSelect, onOpen }: { e: EmployeeListItem; selected: boolean; onSelect: () => void; onOpen: () => void }) {
  return (
    <Card className={cn("group relative p-5 transition hover:-translate-y-0.5 hover:shadow-float", selected && "ring-2 ring-ink")}>
      <div className="absolute top-4 left-4">
        <input type="checkbox" aria-label={`Select ${e.name}`} className="h-4 w-4 accent-[var(--ink)]" checked={selected} onChange={onSelect} />
      </div>
      <div className="absolute top-4 right-4"><ApiStatusBadge status={e.employment_status} /></div>
      <button onClick={onOpen} className="flex w-full flex-col items-center pt-5 text-center">
        <EmployeeAvatar e={e} size="lg" />
        <div className="mt-3 text-[15px] font-semibold text-ink">{e.name}</div>
        <div className="text-[13px] text-ink-2">{e.designation?.name ?? "—"}</div>
        <div className="tabular mt-0.5 text-[12px] text-ink-3">{e.code}</div>
      </button>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-4 text-[12px]">
        <div>
          <div className="text-ink-3">Department</div>
          <div className="truncate font-medium text-ink">{e.department?.name ?? "—"}</div>
        </div>
        <div>
          <div className="text-ink-3">Joined</div>
          <div className="truncate font-medium text-ink">{tenure(e.join_date)}</div>
        </div>
      </div>
    </Card>
  );
}

function Pagination({ meta, onPage, onPageSize }: { meta: EmployeeListResponse["meta"]; onPage: (p: number) => void; onPageSize: (n: number) => void }) {
  const { current_page: page, last_page: pages, per_page, total } = meta;
  const from = total === 0 ? 0 : (page - 1) * per_page + 1;
  const to = Math.min(total, page * per_page);
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-3 text-[13px] text-ink-3">
        <span className="tabular">{from}–{to} of {total}</span>
        <Select
          size="sm"
          className="w-32"
          aria-label="Rows per page"
          value={String(per_page)}
          onChange={(v) => onPageSize(Number(v))}
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} / page` }))}
        />
      </div>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-3 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center">
            {i > 0 && n - nums[i - 1]! > 1 && <span className="px-1 text-ink-3">…</span>}
            <button onClick={() => onPage(n)} aria-current={n === page ? "page" : undefined} className={cn("tabular h-8 min-w-8 rounded-lg px-2 text-[13px] font-medium", n === page ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface-3")}>{n}</button>
          </span>
        ))}
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-3 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  );
}

function TableSkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-label="Loading employees">
      <div className="h-11 border-b border-line bg-surface-2" />
      <ul className="divide-y divide-line">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-24" /></div>
            <Skeleton className="hidden h-3.5 w-32 md:block" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="hidden h-3.5 w-20 lg:block" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EmptyState({ filtered, onReset }: { filtered: boolean; onReset: () => void }) {
  return (
    <Card className="flex flex-col items-center px-6 py-16 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-3 text-ink-2"><Users className="h-6 w-6" /></span>
      <h3 className="mt-4 text-base font-semibold text-ink">{filtered ? "No results for these filters" : "No employees yet"}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-3">{filtered ? "Try a different search term, or clear the filters to see everyone." : "Add your first employee to get started."}</p>
      {filtered ? (
        <Button variant="secondary" className="mt-5" onClick={onReset}>Clear filters</Button>
      ) : (
        <Link href="/employees/new" className="mt-5"><Button variant="primary"><Plus className="h-4 w-4" /> Add employee</Button></Link>
      )}
    </Card>
  );
}

function PreviewDrawer({ e, onClose, onDelete }: { e: EmployeeListItem; onClose: () => void; onDelete: () => void }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  const facts: [string, ReactNode][] = [
    ["Department", e.department?.name ?? "—"],
    ["Designation", e.designation?.name ?? "—"],
    ["Location", e.location?.name ?? "—"],
    ["Work mode", <ApiModeBadge key="m" mode={e.work_mode} />],
    ["Shift", shiftLabel(e.shift)],
    ["Campaign", e.campaign?.name ?? "—"],
    ["Joined", `${formatDate(e.join_date)} · ${tenure(e.join_date)}`],
    ["Machine UID", e.machine_uid ?? "—"],
    ["Two-factor", e.two_factor_enabled ? "On" : "Off"],
    ["Mobile device", e.device_bound ? "Bound" : "Not bound"],
  ];
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${e.name} preview`}>
      <div className="absolute inset-0 animate-fade bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] animate-slide-up flex-col rounded-t-3xl bg-surface shadow-pop sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[440px] sm:animate-slide-in sm:rounded-none sm:rounded-l-3xl">
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
        <div className="relative px-6 pt-6 pb-5">
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 rounded-xl p-2 text-ink-2 hover:bg-surface-3 hover:text-ink"><X className="h-4 w-4" /></button>
          <EmployeeAvatar e={e} size="lg" />
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">{e.name}</h2>
          <p className="text-sm text-ink-2">{e.designation?.name ?? "—"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ApiStatusBadge status={e.employment_status} />
            <Badge className="tabular">{e.code}</Badge>
          </div>
        </div>
        <div className="px-6">
          <a href={`mailto:${e.email}`} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line text-sm font-medium text-ink hover:bg-surface-2">
            <Mail className="h-4 w-4" /> {e.email}
          </a>
        </div>
        <dl className="mt-4 flex-1 divide-y divide-line overflow-y-auto px-6">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-3 text-sm">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-right font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {e.can.delete && (
            <Button variant="ghost" onClick={onDelete} aria-label={`Delete ${e.name}`} className="text-bad hover:bg-bad-soft hover:text-bad"><Trash2 className="h-4 w-4" /></Button>
          )}
          <Link href={`/employees/${e.id}`} className="flex-1"><Button variant="primary" className="w-full justify-center">Open full profile</Button></Link>
        </div>
      </aside>
    </div>
  );
}
