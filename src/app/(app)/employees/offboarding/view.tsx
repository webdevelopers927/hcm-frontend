"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Columns3, DoorOpen, Info, List, Loader2, Plus, Trash2, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmployeeAvatar, ConfirmDialog, ErrorState, Skeleton, useEmployeeFilters, useSlow } from "@/components/employees/api-ui";
import { DataTable, Drawer, FormSection, ModuleHeader, SearchBox, StatStrip, TableFooter, Toolbar, type Column } from "@/components/employees/module-kit";
import { useSession } from "@/components/session/session-provider";
import { Badge, Button, Card, Field, Input, ProgressBar } from "@/components/ui/primitives";
import { EntitySelect, Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  addChecklistItem,
  cancelOffboarding,
  completeOffboarding,
  deleteChecklistItem,
  employeeKeys,
  getOffboarding,
  listEmployees,
  listOffboardings,
  offboardingKeys,
  startOffboarding,
  updateChecklistItem,
  updateOffboarding,
} from "@/lib/api/employees";
import type { EmployeeSummary, ExitType, OffboardingCase, OffboardingPatch, OffboardingStage, OffboardingSummary } from "@/lib/api/types";
import { cn, formatDate } from "@/lib/utils";

const typeTone: Record<ExitType, "info" | "bad" | "warn" | "violet"> = { resignation: "info", termination: "bad", contract_end: "warn", retirement: "violet" };
const today = () => new Date().toISOString().slice(0, 10);
const pct = (c: OffboardingCase) => (c.checklist_progress.total ? (c.checklist_progress.done / c.checklist_progress.total) * 100 : 0);
const labelOf = <V extends string>(list: { value: V; label: string }[] | undefined, v: V) => list?.find((x) => x.value === v)?.label ?? v.replace(/_/g, " ");

function daysLeft(c: OffboardingCase) {
  if (c.days_left === null) return null;
  return c.days_left >= 0 ? `in ${c.days_left}d` : "passed";
}

/** Everything that changes a case also changes the list, the employee and their profile. */
function useCaseCache() {
  const qc = useQueryClient();
  return (c: OffboardingCase) => {
    qc.setQueryData(offboardingKeys.detail(c.id), c);
    void qc.invalidateQueries({ queryKey: ["offboardings", "list"] });
    void qc.invalidateQueries({ queryKey: employeeKeys.all });
  };
}

const textareaCls =
  "w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:ring-4 focus:ring-accent/40 sm:text-sm";

/* ================= page ================= */

export function View() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useSession();
  const manage = can("employees.offboard");

  const [view, setView] = useState<"board" | "list">("board");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // The board shows every case at once; the list pages through them.
  const query = view === "board" ? { search: search || undefined, per_page: 100 } : { search: search || undefined, page, per_page: 50 };
  const list = useQuery({ queryKey: offboardingKeys.list(query), queryFn: ({ signal }) => listOffboardings(query, signal), placeholderData: keepPreviousData });
  const summary = list.data?.summary;
  const cases = useMemo(() => list.data?.data ?? [], [list.data]);
  const stale = useSlow(list.isPlaceholderData);

  const caseId = Number(sp.get("case")) || null;
  const openCase = (id: number | null) => {
    const next = new URLSearchParams(sp.toString());
    if (id) next.set("case", String(id));
    else next.delete("case");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // DataTable keys rows by a string id; the case keeps its numeric one.
  type Row = { id: string; c: OffboardingCase };
  const rows: Row[] = cases.map((c) => ({ id: String(c.id), c }));
  const columns: Column<Row>[] = [
    { key: "emp", header: "Employee", cell: ({ c }) => <Person c={c} /> },
    { key: "type", header: "Type", cell: ({ c }) => <Badge tone={typeTone[c.exit_type]}>{labelOf(summary?.exit_types, c.exit_type)}</Badge> },
    { key: "stage", header: "Stage", cell: ({ c }) => <span className="text-[13px] font-medium text-ink">{labelOf(summary?.stages, c.stage)}</span> },
    {
      key: "lwd",
      header: "Last working day",
      from: "lg",
      cell: ({ c }) => (
        <span className="tabular text-[13px] text-ink-2">
          {c.last_working_day ? formatDate(c.last_working_day) : "—"}
          {c.stage !== "completed" && daysLeft(c) && <span className={cn("ml-1.5", (c.days_left ?? 0) >= 0 && (c.days_left ?? 99) <= 7 ? "text-warn" : "text-ink-3")}>· {daysLeft(c)}</span>}
        </span>
      ),
    },
    { key: "check", header: "Checklist", cell: ({ c }) => <Progress c={c} className="w-32" /> },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Off-boarding"
        description="Resignations, terminations and contract ends, with a checklist so nothing walks out the door."
        actions={
          <>
            <div className="flex rounded-xl border border-line bg-surface p-0.5 shadow-soft">
              {([["board", Columns3], ["list", List]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} aria-pressed={view === v} className={cn("inline-flex h-9 w-10 items-center justify-center rounded-lg", view === v ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink")}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            {manage && <Button variant="primary" onClick={() => setStarting(true)}><UserMinus className="h-4 w-4" /> Start off-boarding</Button>}
          </>
        }
      />

      {summary ? (
        <StatStrip
          items={[
            { label: "In progress", value: summary.in_progress, hint: "Across all stages", tone: "info" },
            { label: "Leaving ≤ 30 days", value: summary.leaving_in_30_days, hint: "Plan handovers now", tone: "warn" },
            { label: "Pending clearance", value: summary.pending_clearance, hint: "Assets & access", tone: "violet" },
            { label: "Completed", value: summary.completed, hint: "Last 90 days", tone: "ok" },
          ]}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}</div>
      )}

      <Toolbar>
        <SearchBox value={q} onChange={setQ} placeholder="Search name or code" />
        {list.isFetching && !list.isPending && <Loader2 className="h-4 w-4 animate-spin text-ink-3" aria-label="Updating" />}
      </Toolbar>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} title="Couldn't load off-boarding cases" />
      ) : view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid w-max grid-flow-col auto-cols-[270px] gap-4 xl:w-full xl:auto-cols-fr">
            {(summary?.stages ?? PLACEHOLDER_STAGES).map((stage) => {
              const items = cases.filter((c) => c.stage === stage.value);
              return (
                <div key={stage.value} className="flex flex-col rounded-2xl bg-surface-3/60 p-2">
                  <div className="flex items-center justify-between px-2 py-2">
                    <span className="text-[13px] font-semibold text-ink">{stage.label}</span>
                    <span className="tabular rounded-md bg-surface px-1.5 text-[12px] font-semibold text-ink-2">{summary?.by_stage[stage.value] ?? "·"}</span>
                  </div>
                  <div className="space-y-2">
                    {list.isPending || stale
                      ? Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)
                      : items.map((c) => (
                          <button key={c.id} onClick={() => openCase(c.id)} className="block w-full text-left">
                            <Card className={cn("p-3.5 transition hover:-translate-y-0.5 hover:shadow-float", c.exited_at && "opacity-80")}>
                              <Person c={c} size="sm" />
                              <div className="mt-3 flex items-center justify-between gap-2 text-[12px]">
                                <Badge tone={typeTone[c.exit_type]}>{labelOf(summary?.exit_types, c.exit_type)}</Badge>
                                {c.last_working_day && (
                                  <span className="tabular inline-flex items-center gap-1 text-ink-3">
                                    <CalendarClock className="h-3.5 w-3.5" />
                                    {formatDate(c.last_working_day, { day: "numeric", month: "short" })}
                                    {c.stage !== "completed" && daysLeft(c) && <span className={cn((c.days_left ?? 99) <= 7 && (c.days_left ?? 0) >= 0 && "text-warn")}>· {daysLeft(c)}</span>}
                                  </span>
                                )}
                              </div>
                              <Progress c={c} className="mt-3" />
                            </Card>
                          </button>
                        ))}
                    {!list.isPending && !stale && items.length === 0 && <div className="rounded-xl border border-dashed border-line-strong p-4 text-center text-[12px] text-ink-3">No one here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : !list.isPending && !stale && rows.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <h3 className="text-sm font-semibold text-ink">{search ? "No results" : "No one is being off-boarded"}</h3>
          <p className="mt-1 text-[13px] text-ink-3">{search ? `Nobody matches “${search}”.` : "Open and recently completed cases show up here."}</p>
          {search && <Button size="sm" variant="secondary" className="mt-4" onClick={() => setQ("")}>Clear search</Button>}
        </Card>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          loading={list.isPending || stale}
          onRowClick={(r) => openCase(Number(r.id))}
          footer={
            list.data && (
              <div className="relative">
                <TableFooter shown={rows.length} total={list.data.meta.total} label="cases" />
                {list.data.meta.last_page > 1 && (
                  <div className="absolute top-1/2 right-3 flex -translate-y-1/2 gap-1">
                    <Button size="icon" variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Next page" disabled={page >= list.data.meta.last_page} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            )
          }
          mobile={({ c }) => (
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <Person c={c} sub={`${labelOf(summary?.stages, c.stage)}${c.last_working_day ? ` · LWD ${formatDate(c.last_working_day, { day: "numeric", month: "short" })}` : ""}`} />
                <Badge tone={typeTone[c.exit_type]}>{labelOf(summary?.exit_types, c.exit_type)}</Badge>
              </div>
              <Progress c={c} />
            </div>
          )}
        />
      )}

      {caseId && <CaseDrawer id={caseId} summary={summary} manage={manage} onClose={() => openCase(null)} />}
      {starting && (
        <StartDrawer
          summary={summary}
          onClose={() => setStarting(false)}
          onStarted={(c) => {
            setStarting(false);
            openCase(c.id);
          }}
        />
      )}
    </div>
  );
}

const PLACEHOLDER_STAGES: { value: OffboardingStage; label: string }[] = [
  { value: "resigned", label: "Resigned" },
  { value: "notice_period", label: "Notice period" },
  { value: "clearance", label: "Clearance" },
  { value: "completed", label: "Completed" },
];

function Person({ c, sub, size = "md" }: { c: OffboardingCase; sub?: ReactNode; size?: "sm" | "md" }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <EmployeeAvatar e={c.employee} size={size} />
      <div className="min-w-0">
        <div className="truncate font-semibold text-ink">{c.employee.name}</div>
        <div className="truncate text-[12px] text-ink-3">{sub ?? c.employee.department?.name ?? c.employee.designation?.name ?? c.employee.code}</div>
      </div>
    </div>
  );
}

function Progress({ c, className }: { c: OffboardingCase; className?: string }) {
  const p = pct(c);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ProgressBar value={p} tone={p === 100 ? "ok" : "ink"} />
      <span className="tabular text-[11px] text-ink-3">{c.checklist_progress.done}/{c.checklist_progress.total}</span>
    </div>
  );
}

/* ================= case drawer ================= */

function CaseDrawer({ id, summary, manage, onClose }: { id: number; summary: OffboardingSummary | undefined; manage: boolean; onClose: () => void }) {
  const q = useQuery({ queryKey: offboardingKeys.detail(id), queryFn: ({ signal }) => getOffboarding(id, signal), staleTime: 0 });
  const filters = useEmployeeFilters();
  const store = useCaseCache();
  const qc = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const act = useMutation({
    mutationFn: (fn: () => Promise<OffboardingCase>) => fn(),
    onSuccess: store,
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) void q.refetch();
      toast(e instanceof ApiError ? e.field("checklist") ?? e.message : errorMessage(e), "bad");
    },
  });
  const cancel = useMutation({
    mutationFn: () => cancelOffboarding(id),
    onSuccess: (res) => {
      toast(res.message);
      setConfirmCancel(false);
      qc.removeQueries({ queryKey: offboardingKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: ["offboardings", "list"] });
      void qc.invalidateQueries({ queryKey: employeeKeys.all });
      onClose();
    },
    onError: (e) => {
      setConfirmCancel(false);
      toast(errorMessage(e), "bad");
      void q.refetch();
    },
  });

  const c = q.data;
  const stages = summary?.stages ?? PLACEHOLDER_STAGES;
  const idx = c ? stages.findIndex((s) => s.value === c.stage) : -1;
  const next = c ? stages[idx + 1] : undefined;
  const done = !!c && (c.stage === "completed" || !!c.completed_at);
  const editable = manage && !done;
  const checklistDone = !!c && c.checklist_progress.done >= c.checklist_progress.total;
  const busy = act.isPending || cancel.isPending;

  let footer: ReactNode = <Button variant="secondary" onClick={onClose}>Close</Button>;
  if (c && editable && next) {
    footer =
      next.value === "completed" ? (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {!checklistDone && <span className="text-[12px] text-ink-3">Tick every checklist item to complete.</span>}
          <Button variant="primary" disabled={!checklistDone || busy} onClick={() => act.mutate(() => completeOffboarding(c.id))}>
            {act.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Complete off-boarding
          </Button>
        </div>
      ) : (
        <Button variant="primary" disabled={busy} onClick={() => act.mutate(() => updateOffboarding(c.id, { stage: next.value as Exclude<OffboardingStage, "completed"> }))}>
          {act.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Move to {next.label} <ArrowRight className="h-4 w-4" />
        </Button>
      );
  }

  return (
    <Drawer
      wide
      title={c ? c.employee.name : "Off-boarding"}
      subtitle={c ? `${labelOf(summary?.exit_types, c.exit_type)} · ${c.employee.designation?.name ?? c.employee.code}` : "Loading…"}
      onClose={onClose}
      footer={footer}
    >
      {q.isPending ? (
        <div className="space-y-4"><Skeleton className="h-8" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-32 rounded-xl" /></div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load this case" />
      ) : c ? (
        <div className="space-y-6">
          <ol className="flex items-center gap-1" aria-label="Stages">
            {stages.map((s, i) => (
              <li key={s.value} className="flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={i === idx ? "step" : undefined}>
                <span className={cn("h-1.5 w-full rounded-full", i <= idx ? "bg-ink" : "bg-surface-3")} />
                <span className={cn("text-[10px] leading-tight sm:text-[11px]", i === idx ? "font-semibold text-ink" : "text-ink-3")}>{s.label}</span>
              </li>
            ))}
          </ol>

          {c.exited_at ? (
            <p className="flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-[13px] text-ink-2">
              <DoorOpen className="h-4 w-4 shrink-0 text-ink-3" /> Left on {formatDate(c.separation_date ?? c.exited_at)}
              {c.final_employment_status && <> · now {c.final_employment_status.name}</>}
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-xl bg-info-soft p-3 text-[13px] text-info">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                On the day after the last working day they move to <strong>{c.final_employment_status?.name ?? "their final status"}</strong> automatically.
              </span>
            </p>
          )}

          <Checklist c={c} editable={editable} onCase={store} />

          <ExitDetails key={c.id + c.created_at} c={c} summary={summary} statuses={filters.data?.employment_statuses ?? []} editable={editable} onCase={store} />

          <FormSection title="Record">
            <dl className="divide-y divide-line rounded-xl border border-line text-[13px]">
              {[
                ["Current status", c.employee.employment_status?.name ?? "—"],
                ["Started by", c.created_by ? `${c.created_by.name} · ${formatDate(c.created_at)}` : formatDate(c.created_at)],
                ["Completed", c.completed_at ? formatDate(c.completed_at) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-3.5 py-2.5">
                  <dt className="text-ink-3">{k}</dt>
                  <dd className="text-right font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <Link href={`/employees/${c.employee.id}`} className="mt-2 inline-flex text-[13px] font-medium text-ink-2 hover:text-ink">Open profile →</Link>
          </FormSection>

          {manage && !c.exited_at && !done && (
            <button type="button" onClick={() => setConfirmCancel(true)} className="text-[13px] font-medium text-bad hover:underline">
              Cancel off-boarding
            </button>
          )}
        </div>
      ) : null}

      {confirmCancel && (
        <ConfirmDialog
          title="Cancel off-boarding?"
          body="Their previous status is restored and the exit dates are cleared."
          confirmLabel="Cancel off-boarding"
          danger
          busy={cancel.isPending}
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => cancel.mutate()}
        />
      )}
    </Drawer>
  );
}

function Checklist({ c, editable, onCase }: { c: OffboardingCase; editable: boolean; onCase: (c: OffboardingCase) => void }) {
  const [label, setLabel] = useState("");
  const [owner, setOwner] = useState("");
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: (fn: () => Promise<OffboardingCase>) => fn(),
    onSuccess: onCase,
    onError: (e) => toast(errorMessage(e), "bad"),
  });

  // Ticking is optimistic: the box flips at once, the server catches up, and a failure rolls it back.
  const detailKey = offboardingKeys.detail(c.id);
  const toggleKey = ["offboardings", "checklist-toggle", c.id];
  const toggle = useMutation({
    mutationKey: toggleKey,
    mutationFn: ({ itemId, done }: { itemId: number; done: boolean }) => updateChecklistItem(c.id, itemId, { done }),
    onMutate: async ({ itemId, done }) => {
      await qc.cancelQueries({ queryKey: detailKey });
      const previous = qc.getQueryData<OffboardingCase>(detailKey);
      qc.setQueryData<OffboardingCase>(detailKey, (old) => {
        if (!old?.checklist) return old;
        const checklist = old.checklist.map((i) => (i.id === itemId ? { ...i, done, done_at: done ? new Date().toISOString() : null, done_by: done ? i.done_by : null } : i));
        return { ...old, checklist, checklist_progress: { done: checklist.filter((i) => i.done).length, total: checklist.length } };
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(detailKey, ctx.previous);
      // Re-sync with the server in case other toggles in the burst succeeded.
      void qc.invalidateQueries({ queryKey: detailKey });
      toast(errorMessage(e), "bad");
    },
    onSuccess: (fresh) => {
      // Only the last toggle in a burst writes the server's copy, so earlier replies can't undo later clicks.
      if (qc.isMutating({ mutationKey: toggleKey }) === 1) onCase(fresh);
    },
  });

  const items = c.checklist ?? [];
  return (
    <FormSection title={`Exit checklist · ${c.checklist_progress.done}/${c.checklist_progress.total}`} action={editable && !adding ? <Button size="sm" variant="ghost" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Add item</Button> : undefined}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2">
            <button
              type="button"
              disabled={!editable}
              aria-pressed={item.done}
              onClick={() => toggle.mutate({ itemId: item.id, done: !item.done })}
              className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-default", item.done ? "border-transparent bg-ok-soft" : "border-line hover:border-line-strong")}
            >
              <span className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", item.done ? "border-ok bg-ok text-white" : "border-line-strong")}>
                {item.done && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", item.done ? "text-ink-2 line-through" : "font-medium text-ink")}>{item.label}</span>
                {item.done && (item.done_by || item.done_at) && (
                  <span className="block text-[12px] text-ink-3">
                    done{item.done_by ? ` by ${item.done_by.name}` : ""}{item.done_at ? ` · ${formatDate(item.done_at)}` : ""}
                  </span>
                )}
              </span>
              {item.owner && <span className="shrink-0 text-[12px] text-ink-3">{item.owner}</span>}
            </button>
            {editable && (
              <button type="button" aria-label={`Remove ${item.label}`} disabled={run.isPending} onClick={() => run.mutate(() => deleteChecklistItem(c.id, item.id))} className="rounded-lg p-2 text-ink-3 opacity-60 hover:bg-bad-soft hover:text-bad group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="rounded-xl border border-dashed border-line p-4 text-center text-[13px] text-ink-3">No checklist items.</li>}
      </ul>
      {adding && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            run.mutate(() => addChecklistItem(c.id, { label: label.trim(), owner: owner.trim() || null }), {
              onSuccess: () => {
                setLabel("");
                setOwner("");
                setAdding(false);
              },
            });
          }}
        >
          <Input autoFocus aria-label="New checklist item" placeholder="e.g. Return parking card" value={label} onChange={(e) => setLabel(e.target.value)} className="sm:flex-1" />
          <Input aria-label="Owner" placeholder="Owner (IT, HR…)" value={owner} onChange={(e) => setOwner(e.target.value)} className="sm:w-36" />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={!label.trim() || run.isPending}>Add</Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Cancel" onClick={() => setAdding(false)}><X className="h-4 w-4" /></Button>
          </div>
        </form>
      )}
    </FormSection>
  );
}

function ExitDetails({ c, summary, statuses, editable, onCase }: { c: OffboardingCase; summary: OffboardingSummary | undefined; statuses: { id: number; name: string }[]; editable: boolean; onCase: (c: OffboardingCase) => void }) {
  const initial = {
    exit_type: c.exit_type,
    resigned_date: c.resigned_date ?? "",
    last_working_day: c.last_working_day ?? "",
    reason_for_resignation: c.reason_for_resignation ?? "",
    final: c.final_employment_status ? String(c.final_employment_status.id) : "",
  };
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k === "final" ? "final_employment_status_id" : k]: "" }));
  };

  const changes: OffboardingPatch = {};
  if (f.exit_type !== initial.exit_type) changes.exit_type = f.exit_type;
  if (f.resigned_date !== initial.resigned_date) changes.resigned_date = f.resigned_date;
  if (f.last_working_day !== initial.last_working_day) changes.last_working_day = f.last_working_day;
  if (f.reason_for_resignation !== initial.reason_for_resignation) changes.reason_for_resignation = f.reason_for_resignation;
  if (f.final !== initial.final) changes.final_employment_status_id = f.final ? Number(f.final) : null;
  const dirty = Object.keys(changes).length > 0;
  const dateError = f.resigned_date && f.last_working_day && f.last_working_day < f.resigned_date ? "Can't be before the resigned date" : "";

  const save = useMutation({
    mutationFn: () => updateOffboarding(c.id, changes),
    onSuccess: (fresh) => {
      toast("Exit details saved");
      onCase(fresh);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) setErrors(Object.fromEntries(Object.entries(e.errors).map(([k, m]) => [k, m[0] ?? ""])));
      toast(errorMessage(e), "bad");
    },
  });

  return (
    <FormSection title="Exit details">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Exit type" htmlFor="xd-type" error={errors.exit_type}>
          <Select inputId="xd-type" value={f.exit_type} onChange={(v) => set("exit_type", v as ExitType)} disabled={!editable} options={summary?.exit_types ?? []} />
        </Field>
        <Field label="Status after leaving" htmlFor="xd-final" error={errors.final_employment_status_id} hint={<span className="text-[12px] text-ink-3">Empty = default for the type</span>}>
          <Select inputId="xd-final" value={f.final} onChange={(v) => set("final", v)} disabled={!editable} clearable placeholder="Default" options={statuses.map((st) => ({ value: String(st.id), label: st.name }))} />
        </Field>
        <Field label="Resigned date" htmlFor="xd-res" error={errors.resigned_date}>
          <Input id="xd-res" type="date" value={f.resigned_date} onChange={(e) => set("resigned_date", e.target.value)} disabled={!editable} invalid={!!errors.resigned_date} />
        </Field>
        <Field label="Last working day" htmlFor="xd-lwd" error={errors.last_working_day || dateError}>
          <Input id="xd-lwd" type="date" value={f.last_working_day} min={f.resigned_date || undefined} onChange={(e) => set("last_working_day", e.target.value)} disabled={!editable} invalid={!!(errors.last_working_day || dateError)} />
        </Field>
        <Field label="Reason" htmlFor="xd-reason" error={errors.reason_for_resignation} className="sm:col-span-2">
          <textarea id="xd-reason" rows={3} maxLength={2000} value={f.reason_for_resignation} onChange={(e) => set("reason_for_resignation", e.target.value)} disabled={!editable} className={cn(textareaCls, "disabled:opacity-60")} />
        </Field>
      </div>
      {editable && dirty && (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setF(initial); setErrors({}); }} disabled={save.isPending}>Discard</Button>
          <Button size="sm" variant="primary" onClick={() => save.mutate()} disabled={save.isPending || !!dateError}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save details
          </Button>
        </div>
      )}
    </FormSection>
  );
}

/* ================= start drawer ================= */

function StartDrawer({ summary, onClose, onStarted }: { summary: OffboardingSummary | undefined; onClose: () => void; onStarted: (c: OffboardingCase) => void }) {
  const filters = useEmployeeFilters();
  const store = useCaseCache();
  const statuses = filters.data?.employment_statuses ?? [];
  const noticeStatuses = statuses.filter((st) => st.is_notice_period);

  const [employee, setEmployee] = useState<EmployeeSummary | null>(null);
  const [exitType, setExitType] = useState<ExitType>("resignation");
  const [resigned, setResigned] = useState(today());
  const [lwd, setLwd] = useState("");
  const [reason, setReason] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [noticeId, setNoticeId] = useState("");
  const [finalId, setFinalId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const notice = noticeId || (noticeStatuses[0] ? String(noticeStatuses[0].id) : "");

  const clear = (k: string) => setErrors((e) => ({ ...e, [k]: "" }));
  const loadPeople = useMemo(
    () => (term: string) =>
      listEmployees({ search: term || undefined, per_page: 20 }).then((r) => r.data.map((e) => ({ id: e.id, name: e.name, designation: e.designation, avatar_url: e.avatar_url, code: e.code }))),
    [],
  );

  const start = useMutation({
    mutationFn: () =>
      startOffboarding({
        employee_id: employee!.id,
        exit_type: exitType,
        resigned_date: resigned,
        last_working_day: lwd,
        reason_for_resignation: reason.trim(),
        ...(notice ? { notice_employment_status_id: Number(notice) } : {}),
        ...(finalId ? { final_employment_status_id: Number(finalId) } : {}),
      }),
    onSuccess: (c) => {
      toast(`Off-boarding started for ${c.employee.name}`);
      store(c);
      onStarted(c);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        setErrors({ employee_id: "This person is already being off-boarded." });
      } else if (e instanceof ApiError && e.status === 422) {
        setErrors(Object.fromEntries(Object.entries(e.errors).map(([k, m]) => [k, m[0] ?? ""])));
        if (e.errors.notice_employment_status_id || e.errors.final_employment_status_id) setAdvanced(true);
      } else {
        toast(errorMessage(e), "bad");
      }
    },
  });

  function submit() {
    const e: Record<string, string> = {};
    if (!employee) e.employee_id = "Choose an employee";
    if (!resigned) e.resigned_date = "Required";
    if (!lwd) e.last_working_day = "Required";
    else if (resigned && lwd < resigned) e.last_working_day = "Can't be before the resigned date";
    if (!reason.trim()) e.reason_for_resignation = "Required";
    setErrors(e);
    if (Object.keys(e).length === 0) start.mutate();
  }

  return (
    <Drawer
      title="Start off-boarding"
      subtitle="Moves them to a notice-period status and creates the exit checklist"
      onClose={() => !start.isPending && onClose()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={start.isPending}>Cancel</Button>
          <Button variant="danger" onClick={submit} disabled={start.isPending}>
            {start.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Start off-boarding
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Employee" htmlFor="ob-emp" error={errors.employee_id}>
          <EntitySelect<EmployeeSummary & { code: string }>
            inputId="ob-emp"
            value={employee}
            onChange={(v) => {
              setEmployee(v);
              clear("employee_id");
            }}
            load={loadPeople}
            invalid={!!errors.employee_id}
            placeholder="Search by name or code"
            renderOption={(e) => (
              <span className="flex items-center gap-2.5">
                <EmployeeAvatar e={e} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{e.name}</span>
                  <span className="block truncate text-[12px] text-ink-3">{e.code} · {e.designation?.name ?? "—"}</span>
                </span>
              </span>
            )}
            renderValue={employee ? <EmployeeAvatar e={employee} size="xs" /> : null}
          />
        </Field>
        <Field label="Exit type" htmlFor="ob-type" error={errors.exit_type}>
          <Select inputId="ob-type" value={exitType} onChange={(v) => setExitType(v as ExitType)} options={summary?.exit_types ?? []} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resigned date" htmlFor="ob-res" error={errors.resigned_date}>
            <Input id="ob-res" type="date" value={resigned} onChange={(e) => { setResigned(e.target.value); clear("resigned_date"); }} invalid={!!errors.resigned_date} />
          </Field>
          <Field label="Last working day" htmlFor="ob-lwd" error={errors.last_working_day}>
            <Input id="ob-lwd" type="date" value={lwd} min={resigned || undefined} onChange={(e) => { setLwd(e.target.value); clear("last_working_day"); }} invalid={!!errors.last_working_day} />
          </Field>
        </div>
        <Field label="Reason" htmlFor="ob-reason" error={errors.reason_for_resignation}>
          <textarea id="ob-reason" rows={3} maxLength={2000} value={reason} onChange={(e) => { setReason(e.target.value); clear("reason_for_resignation"); }} placeholder="e.g. Moving abroad" className={cn(textareaCls, errors.reason_for_resignation && "border-bad")} />
        </Field>

        <div className="rounded-2xl border border-line">
          <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] font-semibold text-ink">
            Advanced
            <ChevronDown className={cn("h-4 w-4 text-ink-3 transition-transform", advanced && "rotate-180")} />
          </button>
          {advanced && (
            <div className="space-y-4 border-t border-line p-4">
              <Field label="Notice period status" htmlFor="ob-notice" error={errors.notice_employment_status_id} hint={<span className="text-[12px] text-ink-3">While they serve notice</span>}>
                <Select inputId="ob-notice" value={notice} onChange={setNoticeId} options={noticeStatuses.map((st) => ({ value: String(st.id), label: st.name }))} />
              </Field>
              <Field label="Status after leaving" htmlFor="ob-final" error={errors.final_employment_status_id} hint={<span className="text-[12px] text-ink-3">Empty = default for the type</span>}>
                <Select inputId="ob-final" value={finalId} onChange={setFinalId} clearable placeholder="Default" options={statuses.map((st) => ({ value: String(st.id), label: st.name }))} />
              </Field>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
