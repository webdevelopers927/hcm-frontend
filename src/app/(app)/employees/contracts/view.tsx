"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, FilePlus2, History, Info, Loader2, Lock, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ConfirmDialog, EmployeeAvatar, ErrorState, Skeleton, useSlow } from "@/components/employees/api-ui";
import { DataTable, DetailList, Drawer, FormSection, ModuleHeader, SearchBox, Segments, StatStrip, Switch, TableFooter, Toolbar, type Column } from "@/components/employees/module-kit";
import { useSession } from "@/components/session/session-provider";
import { Badge, Button, Card, Field, Input } from "@/components/ui/primitives";
import { EntitySelect } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { contractKeys, createContract, deleteContract, employeeKeys, getContract, listContractEligible, listContracts, renewContract, updateContract } from "@/lib/api/employees";
import type { Contract, ContractEligibleEmployee, ContractEmployee, ContractStatus } from "@/lib/api/types";
import { cn, formatDate } from "@/lib/utils";

type Filter = "all" | Exclude<ContractStatus, "renewed">;
const statusTone: Record<ContractStatus, "ok" | "warn" | "bad" | "info" | "neutral"> = { active: "ok", expiring: "warn", expired: "bad", upcoming: "info", renewed: "neutral" };
const statusLabel: Record<ContractStatus, string> = { active: "Active", expiring: "Expiring", expired: "Expired", upcoming: "Upcoming", renewed: "Renewed" };
/** The system status an employee is moved to when their contract ends. */
const EXPIRED_STATUS = "Contract expired";
const signInBlocked = (e: ContractEmployee) => e.employment_status?.name === EXPIRED_STATUS;

/* Date-only arithmetic in UTC so DST never shifts a day. */
const toDay = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const addDays = (iso: string, n: number) => new Date(toDay(iso) + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((toDay(b) - toDay(a)) / 86_400_000);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const textareaCls =
  "w-full resize-y rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-3 hover:border-line-strong focus:border-ink focus:ring-4 focus:ring-accent/40 sm:text-sm";

const EXPIRY_RULE = "When a contract's end date passes, the employee is moved to “Contract expired” and can't sign in until it's renewed or extended.";

/** Anything that changes a contract can change the list, the summary and the employee's status. */
function useContractCache() {
  const qc = useQueryClient();
  return (c?: Contract) => {
    if (c) qc.setQueryData(contractKeys.detail(c.id), c);
    void qc.invalidateQueries({ queryKey: contractKeys.all });
    void qc.invalidateQueries({ queryKey: employeeKeys.all });
  };
}

/** Field errors from a 422, first message per key. */
const fieldErrors = (e: ApiError) => Object.fromEntries(Object.entries(e.errors).map(([k, m]) => [k, m[0] ?? ""]));

/* ================= page ================= */

export function View() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useSession();
  const manage = can("contracts.manage");

  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [renewing, setRenewing] = useState<Contract | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = { search: search || undefined, status: filter === "all" ? undefined : filter, page, per_page: 50 };
  const list = useQuery({ queryKey: contractKeys.list(query), queryFn: ({ signal }) => listContracts(query, signal), placeholderData: keepPreviousData });
  const summary = list.data?.summary;
  const contracts = useMemo(() => list.data?.data ?? [], [list.data]);
  // Rows from the previous tab/search/page are on screen while the new ones load.
  const stale = useSlow(list.isPlaceholderData);

  const contractId = Number(sp.get("contract")) || null;
  const openContract = (id: number | null) => {
    const next = new URLSearchParams(sp.toString());
    if (id) next.set("contract", String(id));
    else next.delete("contract");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const setTab = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };

  // DataTable keys rows by a string id; the contract keeps its numeric one.
  type Row = { id: string; c: Contract };
  const rows: Row[] = contracts.map((c) => ({ id: String(c.id), c }));
  const renewButton = (c: Contract) =>
    manage && c.renewable ? (
      <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setRenewing(c); }}>
        <RefreshCw className="h-3.5 w-3.5" /> Renew
      </Button>
    ) : null;

  const columns: Column<Row>[] = [
    { key: "emp", header: "Employee", cell: ({ c }) => <Person e={c.employee} /> },
    { key: "kind", header: "Type", cell: ({ c }) => <span className="text-[13px] font-medium text-ink">{c.employee.duty_type?.name ?? "—"}</span> },
    { key: "period", header: "Period", cell: ({ c }) => <Period c={c} /> },
    { key: "leaves", header: "Leaves", from: "lg", cell: ({ c }) => <span className="text-[13px] text-ink-2">{c.leave_entitled ? "Entitled" : "Not entitled"}</span> },
    { key: "status", header: "Status", cell: ({ c }) => <StatusCell c={c} /> },
    { key: "act", header: "", className: "text-right", cell: ({ c }) => renewButton(c) },
  ];

  const expiring = summary?.expiring_this_month;
  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Contracts"
        description="Fixed-term agreements for contractual staff, with expiry tracking so renewals never slip."
        actions={manage && <Button variant="primary" onClick={() => setCreating(true)}><FilePlus2 className="h-4 w-4" /> New contract</Button>}
      />

      {summary ? (
        <StatStrip
          items={[
            { label: "Active", value: summary.active, hint: "Currently in force", tone: "ok" },
            { label: `Expiring ≤ ${summary.expiring_days} days`, value: summary.expiring, hint: "Renew or close", tone: "warn" },
            { label: "Expired", value: summary.expired, hint: "Sign-in blocked until renewed", tone: "bad" },
            { label: "Upcoming", value: summary.upcoming, hint: "Starts later", tone: "ink" },
          ]}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[92px] rounded-2xl" />)}</div>
      )}

      {expiring && expiring.count > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
          <p className="flex-1 text-sm text-ink">
            <span className="font-semibold">{expiring.count} {expiring.count === 1 ? "contract expires" : "contracts expire"} this month</span> — {expiring.names.join(", ")}
            {expiring.count > expiring.names.length && ` and ${expiring.count - expiring.names.length} more`}.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setTab("expiring")}>Review</Button>
        </div>
      )}

      <Toolbar>
        <Segments
          value={filter}
          onChange={setTab}
          options={[
            { value: "all", label: "All", count: summary?.all },
            { value: "active", label: "Active", count: summary?.active },
            { value: "expiring", label: "Expiring", count: summary?.expiring },
            { value: "expired", label: "Expired", count: summary?.expired },
            { value: "upcoming", label: "Upcoming", count: summary?.upcoming },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Search name, ID or type" />
        {list.isFetching && !list.isPending && <Loader2 className="h-4 w-4 animate-spin text-ink-3" aria-label="Updating" />}
      </Toolbar>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} title="Couldn't load contracts" />
      ) : !list.isPending && !stale && rows.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <h3 className="text-sm font-semibold text-ink">{search ? "No results" : filter === "all" ? "No contracts yet" : `No ${statusLabel[filter].toLowerCase()} contracts`}</h3>
          <p className="mt-1 text-[13px] text-ink-3">
            {search ? `Nothing matches “${search}”.` : filter === "all" ? "Contracts are for employees with a contractual duty type (contract, freelance, internship…)." : "Try another tab."}
          </p>
          {search ? (
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => setQ("")}>Clear search</Button>
          ) : (
            filter === "all" && manage && <Button size="sm" variant="primary" className="mt-4" onClick={() => setCreating(true)}><FilePlus2 className="h-3.5 w-3.5" /> New contract</Button>
          )}
        </Card>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          loading={list.isPending || stale}
          onRowClick={(r) => openContract(Number(r.id))}
          footer={
            list.data && (
              <div className="relative">
                <TableFooter shown={rows.length} total={list.data.meta.total} label="contracts" />
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
                <Person e={c.employee} sub={c.employee.duty_type?.name} />
                <StatusCell c={c} />
              </div>
              <Period c={c} />
              {renewButton(c)}
            </div>
          )}
        />
      )}

      {contractId && (
        <ContractDrawer
          key={contractId}
          id={contractId}
          manage={manage}
          onOpen={openContract}
          onRenew={(c) => {
            openContract(null);
            setRenewing(c);
          }}
          onClose={() => openContract(null)}
        />
      )}
      {creating && (
        <NewContractDrawer
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            setCreating(false);
            openContract(c.id);
          }}
        />
      )}
      {renewing && (
        <RenewDrawer
          contract={renewing}
          onClose={() => setRenewing(null)}
          onRenewed={(c) => {
            setRenewing(null);
            openContract(c.id);
          }}
        />
      )}
    </div>
  );
}

/* ================= bits ================= */

function Person({ e, sub, size = "md" }: { e: ContractEmployee; sub?: ReactNode; size?: "sm" | "md" }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <EmployeeAvatar e={e} size={size} />
      <div className="min-w-0">
        <div className="truncate font-semibold text-ink">{e.name}</div>
        <div className="truncate text-[12px] text-ink-3">{sub ?? e.designation?.name ?? e.code}</div>
      </div>
    </div>
  );
}

function StatusCell({ c }: { c: Contract }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={statusTone[c.status]} dot>{statusLabel[c.status]}</Badge>
      {signInBlocked(c.employee) && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-bad"><Lock className="h-3 w-3" /> Sign-in blocked</span>
      )}
    </div>
  );
}

function Period({ c }: { c: Contract }) {
  const ended = c.days_left < 0;
  const tone = c.status === "expired" ? "bad" : c.status === "expiring" ? "warn" : null;
  return (
    <div className="w-full max-w-[220px]">
      <div className="tabular mb-1 flex justify-between gap-2 text-[12px] text-ink-3">
        <span>{formatDate(c.start_date, { day: "numeric", month: "short", year: "2-digit" })}</span>
        <span className={cn(tone === "bad" && "font-semibold text-bad", tone === "warn" && "font-semibold text-warn")}>
          {ended ? `Ended ${-c.days_left}d ago` : `${c.days_left}d left`}
        </span>
        <span>{formatDate(c.end_date, { day: "numeric", month: "short", year: "2-digit" })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={cn("h-full", tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-warn" : c.status === "renewed" ? "bg-ink-3" : "bg-ink")} style={{ width: `${Math.min(100, Math.max(0, c.progress))}%` }} />
      </div>
    </div>
  );
}

function Note({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "bad" }) {
  return (
    <div className={cn("flex gap-2.5 rounded-xl border p-3 text-[13px] leading-relaxed", tone === "bad" ? "border-bad/30 bg-bad-soft text-ink" : "border-line bg-surface-2 text-ink-2")}>
      {tone === "bad" ? <Lock className="mt-0.5 h-4 w-4 shrink-0 text-bad" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />}
      <p>{children}</p>
    </div>
  );
}

/* ================= detail drawer ================= */

function ContractDrawer({ id, manage, onOpen, onRenew, onClose }: { id: number; manage: boolean; onOpen: (id: number) => void; onRenew: (c: Contract) => void; onClose: () => void }) {
  const q = useQuery({ queryKey: contractKeys.detail(id), queryFn: ({ signal }) => getContract(id, signal), staleTime: 0 });
  const c = q.data;
  const historyQuery = { employee_id: c?.employee.id, per_page: 50 };
  const history = useQuery({
    queryKey: contractKeys.list(historyQuery),
    queryFn: ({ signal }) => listContracts(historyQuery, signal),
    enabled: !!c,
  });
  const store = useContractCache();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = useMutation({
    mutationFn: () => deleteContract(id),
    onSuccess: (res) => {
      toast(res.message);
      setConfirmDelete(false);
      qc.removeQueries({ queryKey: contractKeys.detail(id) });
      store();
      onClose();
    },
    onError: (e) => {
      setConfirmDelete(false);
      toast(errorMessage(e), e instanceof ApiError && e.status === 409 ? "info" : "bad");
      void q.refetch();
    },
  });

  const renewed = c?.status === "renewed";
  // Newest first; the API returns them in period order.
  const others = [...(history.data?.data ?? [])].sort((a, b) => b.start_date.localeCompare(a.start_date));

  let footer: ReactNode = <Button variant="secondary" onClick={onClose}>Close</Button>;
  if (c && manage && !editing) {
    footer = (
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="text-bad hover:bg-bad-soft" onClick={() => setConfirmDelete(true)} disabled={remove.isPending}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
        <div className="flex gap-2">
          {!renewed && <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
          {c.renewable && <Button variant="primary" onClick={() => onRenew(c)}><RefreshCw className="h-4 w-4" /> Renew</Button>}
        </div>
      </div>
    );
  }

  return (
    <Drawer
      title={c ? c.employee.name : "Contract"}
      subtitle={c ? `${c.employee.code} · ${c.employee.duty_type?.name ?? "No duty type"}` : undefined}
      onClose={() => !confirmDelete && onClose()}
      footer={editing ? undefined : footer}
    >
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load this contract" />
      ) : !c ? (
        <div className="space-y-3"><Skeleton className="h-16 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
      ) : editing ? (
        <EditForm c={c} onDone={() => setEditing(false)} />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <StatusCell c={c} />
            <div className="flex-1"><Period c={c} /></div>
          </div>

          {signInBlocked(c.employee) ? (
            <Note tone="bad">{c.employee.name} can&apos;t sign in: their contract has expired. Renewing it restores their previous status straight away.</Note>
          ) : renewed ? (
            <Note>This contract has been renewed. To change dates, edit the renewal; to delete it, delete the renewal first.</Note>
          ) : (
            <Note>{EXPIRY_RULE}</Note>
          )}

          <FormSection title="Details">
            <DetailList
              rows={[
                ["Period", `${formatDate(c.start_date)} – ${formatDate(c.end_date)} (${daysBetween(c.start_date, c.end_date) + 1} days)`],
                ["Leaves", c.leave_entitled ? "Entitled" : "Not entitled"],
                ["Employment status", c.employee.employment_status?.name ?? "—"],
                ["Designation", c.employee.designation?.name ?? "—"],
                ["Department", c.employee.department?.name ?? "—"],
                ...(c.renewed_from_id ? ([["Renewal of", <button key="rf" type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => onOpen(c.renewed_from_id!)}>previous contract</button>]] as [string, ReactNode][]) : []),
                ...(c.renewed_at ? ([["Renewed", formatDate(c.renewed_at)]] as [string, ReactNode][]) : []),
                ...(c.expired_at ? ([["Expired", formatDate(c.expired_at)]] as [string, ReactNode][]) : []),
                ["Created", `${formatDate(c.created_at)}${c.created_by ? ` by ${c.created_by.name}` : ""}`],
              ]}
            />
            {c.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-[13px] whitespace-pre-wrap text-ink-2">{c.notes}</p>}
          </FormSection>

          <FormSection title="History">
            {history.isError ? (
              <p className="text-[13px] text-ink-3">Couldn&apos;t load the history. <button type="button" className="font-medium text-ink underline" onClick={() => history.refetch()}>Retry</button></p>
            ) : history.isPending ? (
              <Skeleton className="h-14 rounded-xl" />
            ) : others.length <= 1 ? (
              <p className="text-[13px] text-ink-3">This is their only contract.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                {others.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(h.id)}
                      disabled={h.id === c.id}
                      className={cn("flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px]", h.id === c.id ? "bg-surface-2" : "hover:bg-surface-2")}
                    >
                      <History className="h-4 w-4 shrink-0 text-ink-3" />
                      <span className="tabular flex-1 text-ink">{formatDate(h.start_date)} – {formatDate(h.end_date)}</span>
                      {h.id === c.id && <span className="text-[12px] text-ink-3">Viewing</span>}
                      <Badge tone={statusTone[h.status]}>{statusLabel[h.status]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>
        </div>
      )}

      {confirmDelete && c && (
        <ConfirmDialog
          title="Delete this contract?"
          body={
            renewed
              ? "It has been renewed, so the server will refuse. Delete the renewal first."
              : `${formatDate(c.start_date)} – ${formatDate(c.end_date)} for ${c.employee.name}. This can't be undone.`
          }
          confirmLabel="Delete"
          danger
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate()}
        />
      )}
    </Drawer>
  );
}

function EditForm({ c, onDone }: { c: Contract; onDone: () => void }) {
  const store = useContractCache();
  const [start, setStart] = useState(c.start_date);
  const [end, setEnd] = useState(c.end_date);
  const [leave, setLeave] = useState(c.leave_entitled);
  const [notes, setNotes] = useState(c.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => {
      const changes = {
        ...(start !== c.start_date ? { start_date: start } : {}),
        ...(end !== c.end_date ? { end_date: end } : {}),
        ...(leave !== c.leave_entitled ? { leave_entitled: leave } : {}),
        ...(notes.trim() !== (c.notes ?? "") ? { notes: notes.trim() || null } : {}),
      };
      return updateContract(c.id, changes);
    },
    onSuccess: (fresh) => {
      toast("Contract saved");
      store(fresh);
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) setErrors(fieldErrors(e));
      else {
        toast(errorMessage(e), "bad");
        if (e instanceof ApiError && e.status === 409) {
          store();
          onDone();
        }
      }
    },
  });

  function submit() {
    if (!start || !end) return setErrors({ ...(start ? {} : { start_date: "Required" }), ...(end ? {} : { end_date: "Required" }) });
    if (end < start) return setErrors({ end_date: "Can't be before the start date" });
    save.mutate();
  }

  return (
    <div className="space-y-4">
      {c.status === "expired" && end > today() && <Note>Moving the end date past today extends the contract and restores {c.employee.name}&apos;s previous status.</Note>}
      <ContractFields
        start={start}
        end={end}
        leave={leave}
        notes={notes}
        errors={errors}
        onStart={(v) => { setStart(v); setErrors({}); }}
        onEnd={(v) => { setEnd(v); setErrors({}); }}
        onLeave={setLeave}
        onNotes={setNotes}
      />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</Button>
      </div>
    </div>
  );
}

/* ================= shared fields ================= */

function ContractFields({
  start,
  end,
  leave,
  notes,
  errors,
  onStart,
  onEnd,
  onLeave,
  onNotes,
  startMin,
}: {
  start: string;
  end: string;
  leave: boolean;
  notes: string;
  errors: Record<string, string>;
  onStart: (v: string) => void;
  onEnd: (v: string) => void;
  onLeave: (v: boolean) => void;
  onNotes: (v: string) => void;
  startMin?: string;
}) {
  const length = start && end && end >= start ? daysBetween(start, end) + 1 : null;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" htmlFor="ct-start" error={errors.start_date}>
          <Input id="ct-start" type="date" value={start} min={startMin} onChange={(e) => onStart(e.target.value)} invalid={!!errors.start_date} />
        </Field>
        <Field label="End date" htmlFor="ct-end" error={errors.end_date} hint={length ? <span className="tabular text-[12px] text-ink-3">{length} days</span> : undefined}>
          <Input id="ct-end" type="date" value={end} min={start || undefined} onChange={(e) => onEnd(e.target.value)} invalid={!!errors.end_date} />
        </Field>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-line p-4">
        <div>
          <div className="text-sm font-medium text-ink">Leave entitlement</div>
          <div className="text-[12px] text-ink-3">Accrue annual, sick and casual leave</div>
        </div>
        <Switch checked={leave} onChange={onLeave} label="Leave entitlement" />
      </div>
      <Field label="Notes" htmlFor="ct-notes" error={errors.notes}>
        <textarea id="ct-notes" rows={3} maxLength={2000} value={notes} onChange={(e) => onNotes(e.target.value)} placeholder="Optional" className={cn(textareaCls, errors.notes && "border-bad")} />
      </Field>
    </>
  );
}

/* ================= new contract ================= */

function NewContractDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Contract) => void }) {
  const store = useContractCache();
  const [employee, setEmployee] = useState<ContractEligibleEmployee | null>(null);
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState("");
  const [leave, setLeave] = useState(true);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clear = (k: string) => setErrors((e) => ({ ...e, [k]: "" }));
  const loadPeople = useMemo(() => (term: string) => listContractEligible(term), []);

  const create = useMutation({
    mutationFn: () => createContract({ employee_id: employee!.id, start_date: start, end_date: end, leave_entitled: leave, notes: notes.trim() || null }),
    onSuccess: (c) => {
      toast(`Contract created for ${c.employee.name}`);
      store(c);
      onCreated(c);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) setErrors(fieldErrors(e));
      else toast(errorMessage(e), "bad");
    },
  });

  function submit() {
    const e: Record<string, string> = {};
    if (!employee) e.employee_id = "Choose an employee";
    if (!start) e.start_date = "Required";
    if (!end) e.end_date = "Required";
    else if (start && end < start) e.end_date = "Can't be before the start date";
    setErrors(e);
    if (Object.keys(e).length === 0) create.mutate();
  }

  return (
    <Drawer
      title="New contract"
      subtitle="For employees with a contractual duty type"
      onClose={() => !create.isPending && onClose()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={create.isPending}>{create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create contract</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Employee" htmlFor="ct-emp" error={errors.employee_id}>
          <EntitySelect<ContractEligibleEmployee>
            inputId="ct-emp"
            value={employee}
            onChange={(v) => {
              setEmployee(v);
              clear("employee_id");
              clear("start_date");
            }}
            load={loadPeople}
            invalid={!!errors.employee_id}
            placeholder="Search by name or code"
            noOptionsText="No contractual employees match"
            renderOption={(e) => (
              <span className="flex items-center gap-2.5">
                <EmployeeAvatar e={e} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block truncate text-[12px] opacity-70">{e.code} · {e.duty_type?.name ?? "—"}</span>
                </span>
                {e.has_current_contract && <span className="shrink-0 rounded-md border border-current px-1.5 text-[11px] leading-[18px] opacity-60">has a current contract</span>}
              </span>
            )}
            renderValue={employee ? <EmployeeAvatar e={employee} size="xs" /> : null}
          />
        </Field>
        {employee?.has_current_contract && (
          <Note>{employee.name} already has a current contract. A new one can&apos;t overlap it; to continue the same engagement, renew that contract instead.</Note>
        )}
        <ContractFields
          start={start}
          end={end}
          leave={leave}
          notes={notes}
          errors={errors}
          onStart={(v) => { setStart(v); clear("start_date"); }}
          onEnd={(v) => { setEnd(v); clear("end_date"); }}
          onLeave={setLeave}
          onNotes={setNotes}
        />
        <Note>{EXPIRY_RULE}</Note>
      </div>
    </Drawer>
  );
}

/* ================= renew ================= */

function RenewDrawer({ contract: c, onClose, onRenewed }: { contract: Contract; onClose: () => void; onRenewed: (c: Contract) => void }) {
  const store = useContractCache();
  // Same length as before, starting the day after the old end.
  const firstDay = addDays(c.end_date, 1);
  const [start, setStart] = useState(firstDay);
  const [end, setEnd] = useState(addDays(firstDay, daysBetween(c.start_date, c.end_date)));
  const [leave, setLeave] = useState(c.leave_entitled);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const renew = useMutation({
    mutationFn: () => renewContract(c.id, { start_date: start, end_date: end, leave_entitled: leave, notes: notes.trim() || null }),
    onSuccess: (fresh) => {
      toast(`Contract renewed for ${fresh.employee.name}`);
      store(fresh);
      onRenewed(fresh);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) setErrors(fieldErrors(e));
      else toast(errorMessage(e), "bad");
    },
  });

  function submit() {
    const e: Record<string, string> = {};
    if (!start) e.start_date = "Required";
    else if (start <= c.end_date) e.start_date = `Must be after ${formatDate(c.end_date)}`;
    if (!end) e.end_date = "Required";
    else if (start && end < start) e.end_date = "Can't be before the start date";
    setErrors(e);
    if (Object.keys(e).length === 0) renew.mutate();
  }

  return (
    <Drawer
      title="Renew contract"
      subtitle={`${c.employee.name} · current one ${c.days_left < 0 ? "ended" : "ends"} ${formatDate(c.end_date)}`}
      onClose={() => !renew.isPending && onClose()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={renew.isPending}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={renew.isPending}>{renew.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Renew contract</Button>
        </>
      }
    >
      <div className="space-y-4">
        {signInBlocked(c.employee) ? (
          <Note tone="bad">{c.employee.name} can&apos;t sign in right now. Renewing restores their previous status immediately.</Note>
        ) : (
          <Note>{EXPIRY_RULE} Renewing now avoids that.</Note>
        )}
        {errors.contract && <p role="alert" className="rounded-xl border border-bad/30 bg-bad-soft p-3 text-[13px] font-medium text-bad">{errors.contract}</p>}
        <ContractFields
          start={start}
          end={end}
          leave={leave}
          notes={notes}
          errors={errors}
          startMin={firstDay}
          onStart={(v) => { setStart(v); setErrors({}); }}
          onEnd={(v) => { setEnd(v); setErrors({}); }}
          onLeave={setLeave}
          onNotes={setNotes}
        />
      </div>
    </Drawer>
  );
}
