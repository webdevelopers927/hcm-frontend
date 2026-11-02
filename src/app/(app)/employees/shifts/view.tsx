"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, Coffee, History, Loader2, SearchX, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { EmployeeAvatar, ErrorState, Skeleton } from "@/components/employees/api-ui";
import { DataTable, Drawer, ModuleHeader, SearchBox, Segments, TableFooter, Toolbar, type Column } from "@/components/employees/module-kit";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { getShiftHistory, listEmployeeShifts, shiftKeys } from "@/lib/api/employees";
import type { EmployeeShiftRow, EmployeeShiftsQuery, ShiftDetail } from "@/lib/api/types";
import { cn, formatDate } from "@/lib/utils";

/*
 * Read-only: shifts are set on the employee record (create/edit form), and
 * every change is kept as dated history. This page only shows who works when.
 */

const PER_PAGE = 12;
const PALETTE = ["var(--accent)", "var(--info)", "var(--violet)", "var(--warn)"];

/** One colour per shift, by its position in the start-time-ordered list, so cards, chips and tracks agree. */
function useShiftColors(shifts: { id: number }[] | undefined) {
  return useMemo(() => {
    const map = new Map((shifts ?? []).map((s, i) => [s.id, PALETTE[i % PALETTE.length]!]));
    return (id: number) => map.get(id) ?? "var(--ink-3)";
  }, [shifts]);
}

const toH = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;

/** Draws a shift on a 24h track; overnight shifts wrap to the start. */
function Track({ shift, color, className }: { shift: ShiftDetail; color: string; className?: string }) {
  const s = toH(shift.start);
  const e = toH(shift.end);
  const segs = e > s ? [[s, e]] : [[s, 24], [0, e]];
  return (
    <div className={cn("relative h-2.5 rounded-full bg-surface-3", className)} aria-hidden>
      {segs.map(([a, b]) => (
        <span key={a} className="absolute inset-y-0 rounded-full" style={{ left: `${(a! / 24) * 100}%`, width: `${((b! - a!) / 24) * 100}%`, background: color }} />
      ))}
    </div>
  );
}

function ShiftChip({ shift, color }: { shift: { name: string }; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[12px] font-medium text-ink">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {shift.name}
    </span>
  );
}

/* ---------------- URL ⇄ query ---------------- */

function readQuery(sp: URLSearchParams): EmployeeShiftsQuery {
  const raw = sp.get("shift_id");
  const shift = raw === "unassigned" ? "unassigned" : raw && Number.isInteger(Number(raw)) ? Number(raw) : undefined;
  return { search: sp.get("search") || undefined, shift_id: shift, page: Math.max(1, Number(sp.get("page")) || 1), per_page: PER_PAGE };
}

function writeQuery(q: EmployeeShiftsQuery) {
  const sp = new URLSearchParams();
  if (q.search) sp.set("search", q.search);
  if (q.shift_id !== undefined) sp.set("shift_id", String(q.shift_id));
  if (q.page && q.page > 1) sp.set("page", String(q.page));
  return sp.toString();
}

type Row = EmployeeShiftRow & { id: string };

export function View() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = useMemo(() => readQuery(new URLSearchParams(sp.toString())), [sp]);
  const setQuery = (patch: Partial<EmployeeShiftsQuery>) => {
    const qs = writeQuery({ ...query, page: 1, ...patch });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const list = useQuery({ queryKey: shiftKeys.list(query), queryFn: ({ signal }) => listEmployeeShifts(query, signal), placeholderData: keepPreviousData });
  const color = useShiftColors(list.data?.shifts);
  const [historyFor, setHistoryFor] = useState<Row | null>(null);

  // Debounced server-side search, kept in sync if the URL changes elsewhere.
  const [q, setQ] = useState(query.search ?? "");
  const [synced, setSynced] = useState(query.search ?? "");
  if ((query.search ?? "") !== synced) {
    setSynced(query.search ?? "");
    setQ(query.search ?? "");
  }
  useEffect(() => {
    if (q.trim() === (query.search ?? "")) return;
    const t = setTimeout(() => setQuery({ search: q.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [q]);

  const data = list.data;
  const rows: Row[] = (data?.data ?? []).map((r) => ({ ...r, id: String(r.employee.id) }));
  const meta = data?.meta;
  const filter = query.shift_id === undefined ? "all" : String(query.shift_id);
  const activeShift = typeof query.shift_id === "number" ? data?.shifts.find((s) => s.id === query.shift_id) : undefined;

  const columns: Column<Row>[] = [
    {
      key: "emp",
      header: "Employee",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <EmployeeAvatar e={r.employee} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-ink">{r.employee.name}</div>
            <div className="tabular truncate text-[12px] text-ink-3">{r.employee.code}</div>
          </div>
        </div>
      ),
    },
    {
      key: "dept",
      header: "Department",
      from: "lg",
      cell: (r) => (
        <div className="text-[13px]">
          <div className="text-ink">{r.department?.name ?? "—"}</div>
          {r.division && <div className="text-ink-3">{r.division.name} division</div>}
        </div>
      ),
    },
    {
      key: "shift",
      header: "Shift",
      cell: (r) => (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {r.previous_shift && (
              <>
                <span className="text-[12px] text-ink-3 line-through">{r.previous_shift.name}</span>
                <ArrowRight className="h-3 w-3 text-ink-3" />
              </>
            )}
            {r.shift ? <ShiftChip shift={r.shift} color={color(r.shift.id)} /> : <Badge tone="neutral">No shift</Badge>}
          </div>
          {r.upcoming && (
            <div className="mt-1 inline-flex items-center gap-1 text-[12px] text-info">
              <Clock3 className="h-3 w-3" /> {r.upcoming.shift.name} from {formatDate(r.upcoming.effective_from, { day: "numeric", month: "short" })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "time",
      header: "Timing",
      from: "xl",
      cell: (r) =>
        r.shift ? (
          <div className="w-40">
            <Track shift={r.shift} color={color(r.shift.id)} />
            <div className="tabular mt-1 text-[12px] text-ink-3">{r.shift.start} – {r.shift.end}</div>
          </div>
        ) : (
          <span className="text-[13px] text-ink-3">—</span>
        ),
    },
    { key: "from", header: "Effective from", cell: (r) => <span className="tabular text-[13px] text-ink-2">{r.effective_from ? formatDate(r.effective_from) : "—"}</span> },
  ];

  const pager = meta && (
    <div className="relative">
      <TableFooter shown={rows.length} total={meta.total} label="people" />
      {meta.last_page > 1 && (
        <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1">
          <span className="tabular mr-1 text-[12px] text-ink-3">Page {meta.current_page} of {meta.last_page}</span>
          <Button size="icon" variant="ghost" aria-label="Previous page" disabled={meta.current_page <= 1} onClick={() => setQuery({ page: meta.current_page - 1 })}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" aria-label="Next page" disabled={meta.current_page >= meta.last_page} onClick={() => setQuery({ page: meta.current_page + 1 })}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <ModuleHeader title="Shift records" description="Who works when. Shifts are set on each employee's record, and every change is kept as history." />

      {/* Cards */}
      {list.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[150px] rounded-2xl" />)}</div>
      ) : data && data.shifts.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {data.shifts.map((s) => (
            <button key={s.id} onClick={() => setQuery({ shift_id: query.shift_id === s.id ? undefined : s.id })} aria-pressed={query.shift_id === s.id} className="text-left">
              <Card className={cn("p-4 transition hover:shadow-float", query.shift_id === s.id && "ring-2 ring-ink")}>
                <div className="flex items-center justify-between">
                  <ShiftChip shift={s} color={color(s.id)} />
                  <span className="tabular inline-flex items-center gap-1 text-[13px] font-semibold text-ink"><Users className="h-3.5 w-3.5 text-ink-3" />{s.employees_count}</span>
                </div>
                <div className="tabular mt-3 text-xl font-semibold tracking-tight text-ink">{s.start} – {s.end}</div>
                <Track shift={s} color={color(s.id)} className="mt-3" />
                <div className="tabular mt-1.5 flex justify-between text-[10px] text-ink-3"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
                <div className="mt-2 inline-flex items-center gap-1 text-[12px] text-ink-3"><Coffee className="h-3.5 w-3.5" />{s.break_minutes} min break</div>
              </Card>
            </button>
          ))}
        </div>
      ) : null}

      <Toolbar>
        {data ? (
          <Segments
            value={filter}
            onChange={(v) => setQuery({ shift_id: v === "all" ? undefined : v === "unassigned" ? "unassigned" : Number(v) })}
            options={[
              { value: "all", label: "All shifts", count: data.counts.all },
              ...data.shifts.map((s) => ({ value: String(s.id), label: s.name, count: s.employees_count })),
              ...(data.counts.unassigned > 0 ? [{ value: "unassigned", label: "Unassigned", count: data.counts.unassigned }] : []),
            ]}
          />
        ) : (
          <Skeleton className="h-10 w-80 rounded-xl" />
        )}
        <div className="flex items-center gap-2 md:justify-end">
          {list.isFetching && !list.isPending && <Loader2 className="h-4 w-4 animate-spin text-ink-3" aria-label="Updating" />}
          <SearchBox value={q} onChange={setQ} placeholder="Name, ID, department" />
        </div>
      </Toolbar>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} title="Couldn't load shift records" />
      ) : list.isPending ? (
        <Card className="divide-y divide-line">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-14 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-ink-2">{query.search ? <SearchX className="h-5 w-5" /> : <Users className="h-5 w-5" />}</span>
          <h3 className="mt-3 text-sm font-semibold text-ink">{query.search ? "No results" : "No one on this shift"}</h3>
          <p className="mt-1 max-w-sm text-[13px] text-ink-3">
            {query.search ? `Nobody matches “${query.search}”${activeShift ? ` on the ${activeShift.name} shift` : ""}.` : "Nobody is assigned here right now."}
          </p>
          {(query.search || query.shift_id !== undefined) && (
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => setQuery({ search: undefined, shift_id: query.search ? query.shift_id : undefined })}>
              {query.search ? "Clear search" : "Show all shifts"}
            </Button>
          )}
        </Card>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          onRowClick={setHistoryFor}
          footer={pager}
          mobile={(r) => (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <EmployeeAvatar e={r.employee} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{r.employee.name}</div>
                  <div className="tabular truncate text-[12px] text-ink-3">{r.shift ? `${r.shift.start} – ${r.shift.end}` : "No shift"}</div>
                </div>
              </div>
              {r.shift && <ShiftChip shift={r.shift} color={color(r.shift.id)} />}
            </div>
          )}
        />
      )}

      {historyFor && <HistoryDrawer row={historyFor} color={color} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

/* ---------------- history (read-only timeline) ---------------- */

const statusTone = { upcoming: "info", current: "ok", past: "neutral" } as const;
const statusLabel = { upcoming: "Scheduled", current: "Current", past: "Past" } as const;

function HistoryDrawer({ row, color, onClose }: { row: Row; color: (id: number) => string; onClose: () => void }) {
  const history = useQuery({ queryKey: shiftKeys.history(row.employee.id), queryFn: ({ signal }) => getShiftHistory(row.employee.id, signal) });
  return (
    <Drawer
      title={row.employee.name}
      subtitle={`${row.employee.code} · shift history`}
      onClose={onClose}
      footer={
        <Link href={`/employees/${row.employee.id}`} className="flex-1">
          <Button variant="secondary" className="w-full justify-center">Open profile</Button>
        </Link>
      }
    >
      {history.isPending ? (
        <div className="space-y-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} title="Couldn't load history" />
      ) : history.data.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <History className="h-6 w-6 text-ink-3" />
          <p className="mt-2 text-sm text-ink-2">No shift history recorded yet.</p>
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {history.data.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute top-4 -left-[27px] h-3 w-3 rounded-full ring-4 ring-surface" style={{ background: h.status === "past" ? "var(--line-strong)" : color(h.shift.id) }} />
              <Card className={cn("p-3.5", h.status === "past" && "opacity-75")}>
                <div className="flex items-center justify-between gap-2">
                  <ShiftChip shift={h.shift} color={color(h.shift.id)} />
                  <Badge tone={statusTone[h.status]}>{statusLabel[h.status]}</Badge>
                </div>
                <div className="tabular mt-2 text-sm font-semibold text-ink">{h.shift.start} – {h.shift.end}</div>
                <Track shift={h.shift} color={color(h.shift.id)} className="mt-2" />
                <div className="mt-2 text-[12px] text-ink-3">
                  {h.status === "upcoming" ? "Starts" : "From"} {formatDate(h.effective_from)}
                  {h.assigned_by && <> · by {h.assigned_by.name}</>}
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
