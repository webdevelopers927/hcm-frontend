"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, DoorOpen, Hourglass, Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session/session-provider";
import { Badge, Button, Card, Field, Input } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  createEmploymentStatus,
  deleteEmploymentStatus,
  employeeKeys,
  employmentStatusKeys,
  listEmploymentStatuses,
  updateEmploymentStatus,
} from "@/lib/api/employees";
import type { EmploymentStatusRow } from "@/lib/api/types";
import { ConfirmDialog, ErrorState, Skeleton } from "./api-ui";
import { Switch } from "./form/controls";
import { ModuleHeader } from "./module-kit";

/** Setup → Employment statuses. The list order drives the status tabs on People. */
export function EmploymentStatusesAdmin() {
  const qc = useQueryClient();
  const { can } = useSession();
  const manage = can("employment-statuses.manage");
  const list = useQuery({ queryKey: employmentStatusKeys.all, queryFn: ({ signal }) => listEmploymentStatuses(signal) });
  const [editing, setEditing] = useState<EmploymentStatusRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<EmploymentStatusRow | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: employmentStatusKeys.all });
    void qc.invalidateQueries({ queryKey: employeeKeys.filters });
    void qc.invalidateQueries({ queryKey: employeeKeys.formOptions });
    void qc.invalidateQueries({ queryKey: ["employees", "list"] });
  };

  const move = useMutation({
    mutationFn: async ({ row, dir }: { row: EmploymentStatusRow; dir: -1 | 1 }) => {
      const rows = list.data ?? [];
      const i = rows.findIndex((r) => r.id === row.id);
      const other = rows[i + dir];
      if (!other) return;
      // Swap positions; fall back to index-based orders if the stored ones collide.
      const a = row.sort_order === other.sort_order ? i + dir : other.sort_order;
      const b = row.sort_order === other.sort_order ? i : row.sort_order;
      await updateEmploymentStatus(row.id, { sort_order: a });
      await updateEmploymentStatus(other.id, { sort_order: b });
    },
    onSuccess: refresh,
    onError: (e) => {
      toast(errorMessage(e), "bad");
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (r: EmploymentStatusRow) => deleteEmploymentStatus(r.id),
    onSuccess: (res) => {
      toast(res.message);
      setDeleting(null);
      refresh();
    },
    onError: (e) => {
      setDeleting(null);
      toast(errorMessage(e), e instanceof ApiError && e.status === 409 ? "info" : "bad");
    },
  });

  const rows = list.data ?? [];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Employment statuses"
        description="Statuses used on employee records. They decide who can sign in, who is serving notice and who has left. Their order sets the tabs on People."
        actions={manage && <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add status</Button>}
      />

      {editing === "new" && <StatusForm onDone={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />}

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} title="Couldn't load statuses" />
      ) : list.isPending ? (
        <Card className="divide-y divide-line">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex gap-4 p-4"><Skeleton className="h-4 w-40" /><Skeleton className="ml-auto h-4 w-24" /></div>)}</Card>
      ) : rows.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <h3 className="text-sm font-semibold text-ink">No statuses yet</h3>
          <p className="mt-1 text-[13px] text-ink-3">{manage ? "Add the first one. Employees can't be created without a status." : "Ask an admin to add some."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[12px] text-ink-3">
              <tr>
                {manage && <th className="w-20 px-3 py-2.5 font-medium"><span className="sr-only">Order</span></th>}
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Can log in</th>
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Notice period</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Ends employment</th>
                <th className="w-28 px-4 py-2.5 text-right font-medium">Employees</th>
                {manage && <th className="w-24 px-2 py-2.5"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) =>
                editing !== "new" && editing?.id === r.id ? (
                  <tr key={r.id}>
                    <td colSpan={7} className="p-3">
                      <StatusForm row={r} onDone={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="hover:bg-surface-2">
                    {manage && (
                      <td className="px-2 py-2">
                        <div className="flex">
                          <button type="button" aria-label={`Move ${r.name} up`} disabled={i === 0 || move.isPending} onClick={() => move.mutate({ row: r, dir: -1 })} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink disabled:opacity-30">
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button type="button" aria-label={`Move ${r.name} down`} disabled={i === rows.length - 1 || move.isPending} onClick={() => move.mutate({ row: r, dir: 1 })} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink disabled:opacity-30">
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                    <td className="px-4 py-3">{r.can_login ? <Badge tone="ok">Yes</Badge> : <Badge tone="bad"><Lock className="h-3 w-3" /> No</Badge>}</td>
                    <td className="hidden px-4 py-3 sm:table-cell">{r.is_notice_period ? <Badge tone="warn"><Hourglass className="h-3 w-3" /> Yes</Badge> : <Badge tone="neutral">No</Badge>}</td>
                    <td className="hidden px-4 py-3 md:table-cell">{r.is_exit ? <Badge tone="neutral"><DoorOpen className="h-3 w-3" /> Yes</Badge> : <span className="text-[13px] text-ink-3">No</span>}</td>
                    <td className="tabular px-4 py-3 text-right text-ink-2">{r.employees_count}</td>
                    {manage && (
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        <button type="button" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`} className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setDeleting(r)} aria-label={`Delete ${r.name}`} className="rounded-lg p-2 text-ink-3 hover:bg-bad-soft hover:text-bad"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {move.isPending && <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-[12px] text-ink-3"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving order…</div>}
        </Card>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          body={deleting.employees_count > 0 ? `${deleting.employees_count} people have this status, so the server will refuse.` : "This can't be undone."}
          confirmLabel="Delete"
          danger
          busy={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting)}
        />
      )}
    </div>
  );
}

function StatusForm({ row, onDone, onCancel }: { row?: EmploymentStatusRow; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [canLogin, setCanLogin] = useState(row?.can_login ?? true);
  const [notice, setNotice] = useState(row?.is_notice_period ?? false);
  const [exit, setExit] = useState(row?.is_exit ?? false);
  const [flagError, setFlagError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [confirmLock, setConfirmLock] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), can_login: canLogin, is_notice_period: notice, is_exit: exit };
      if (!row) return createEmploymentStatus(body);
      // Send only what changed.
      const changes = Object.fromEntries(Object.entries(body).filter(([k, v]) => row[k as keyof typeof body] !== v));
      return updateEmploymentStatus(row.id, changes);
    },
    onSuccess: (r) => {
      toast(row ? `Saved ${r.name}` : `Added ${r.name}`);
      onDone();
    },
    onError: (e) => {
      setConfirmLock(false);
      if (e instanceof ApiError && e.status === 422) {
        setError(e.field("name"));
        setFlagError(e.field("is_exit") ?? e.field("is_notice_period") ?? (e.field("name") ? undefined : e.message));
      }
      else toast(errorMessage(e), "bad");
    },
  });

  const submit = () => {
    if (!name.trim()) return setError("Enter a name");
    // Switching sign-in off signs everyone in this status out.
    if (row && row.can_login && !canLogin && row.employees_count > 0) return setConfirmLock(true);
    save.mutate();
  };

  const fieldId = `status-${row?.id ?? "new"}`;
  return (
    <>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => e.key === "Escape" && !confirmLock && onCancel()}
      className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-soft"
    >
      <Field label={row ? `Edit ${row.name}` : "New status"} htmlFor={fieldId} error={error}>
        <Input ref={input} id={fieldId} value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} invalid={!!error} maxLength={100} placeholder="e.g. On sabbatical" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Switch name={`${fieldId}-login`} label="Can log in" description="Off: they can't sign in and are signed out." checked={canLogin} onChange={setCanLogin} />
        {/* Serving notice means still employed, so these two can't both be on. */}
        <Switch name={`${fieldId}-notice`} label="Notice period" description="Counts them under “On notice”." checked={notice} onChange={(v) => { setNotice(v); if (v) setExit(false); setFlagError(undefined); }} />
        <Switch name={`${fieldId}-exit`} label="Ends employment" description="They have left (resigned, retired…)." checked={exit} onChange={(v) => { setExit(v); if (v) setNotice(false); setFlagError(undefined); }} />
      </div>
      {flagError && <p role="alert" className="text-[12px] font-medium text-bad">{flagError}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
      </div>
    </form>
      {confirmLock && row && (
        <ConfirmDialog
          title="Turn off sign-in?"
          body={`${row.employees_count} ${row.employees_count === 1 ? "person" : "people"} in this status will be signed out and won't be able to sign in.`}
          confirmLabel="Turn off & save"
          danger
          busy={save.isPending}
          onCancel={() => setConfirmLock(false)}
          onConfirm={() => save.mutate()}
        />
      )}
    </>
  );
}
