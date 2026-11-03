"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session/session-provider";
import { Badge, Button, Card, Field, Input } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { createDutyType, deleteDutyType, dutyTypeKeys, employeeKeys, listDutyTypes, updateDutyType } from "@/lib/api/employees";
import type { DutyTypeRow } from "@/lib/api/types";
import { ConfirmDialog, ErrorState, Skeleton } from "./api-ui";
import { Switch } from "./form/controls";
import { ModuleHeader } from "./module-kit";

/** Setup → Duty types. The list order is the order of the Duty type dropdown. */
export function DutyTypesAdmin() {
  const qc = useQueryClient();
  const { can } = useSession();
  const manage = can("duty-types.manage");
  const list = useQuery({ queryKey: dutyTypeKeys.all, queryFn: ({ signal }) => listDutyTypes(signal) });
  const [editing, setEditing] = useState<DutyTypeRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<DutyTypeRow | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: dutyTypeKeys.all });
    void qc.invalidateQueries({ queryKey: employeeKeys.formOptions });
  };

  const move = useMutation({
    mutationFn: async ({ row, dir }: { row: DutyTypeRow; dir: -1 | 1 }) => {
      const rows = list.data ?? [];
      const i = rows.findIndex((r) => r.id === row.id);
      const other = rows[i + dir];
      if (!other) return;
      // Swap positions; fall back to index-based orders if the stored ones collide.
      const a = row.sort_order === other.sort_order ? i + dir : other.sort_order;
      const b = row.sort_order === other.sort_order ? i : row.sort_order;
      await updateDutyType(row.id, { sort_order: a });
      await updateDutyType(other.id, { sort_order: b });
    },
    onSuccess: refresh,
    onError: (e) => {
      toast(errorMessage(e), "bad");
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (r: DutyTypeRow) => deleteDutyType(r.id),
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
        title="Duty types"
        description="How people are engaged: full-time, part-time, contract and so on. Contractual types mark fixed-term or engagement-based work. Their order sets the Duty type dropdown."
        actions={manage && <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add duty type</Button>}
      />

      {editing === "new" && <DutyTypeForm onDone={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />}

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} title="Couldn't load duty types" />
      ) : list.isPending ? (
        <Card className="divide-y divide-line">{Array.from({ length: 6 }, (_, i) => <div key={i} className="flex gap-4 p-4"><Skeleton className="h-4 w-40" /><Skeleton className="ml-auto h-4 w-24" /></div>)}</Card>
      ) : rows.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <h3 className="text-sm font-semibold text-ink">No duty types yet</h3>
          <p className="mt-1 text-[13px] text-ink-3">{manage ? "Add the first one. Employees can't be submitted without a duty type." : "Ask an admin to add some."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[12px] text-ink-3">
              <tr>
                {manage && <th className="w-20 px-3 py-2.5 font-medium"><span className="sr-only">Order</span></th>}
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Contractual</th>
                <th className="w-28 px-4 py-2.5 text-right font-medium">Employees</th>
                {manage && <th className="w-24 px-2 py-2.5"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, i) =>
                editing !== "new" && editing?.id === r.id ? (
                  <tr key={r.id}>
                    <td colSpan={5} className="p-3">
                      <DutyTypeForm row={r} onDone={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />
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
                    <td className="px-4 py-3">{r.is_contractual ? <Badge tone="info"><ScrollText className="h-3 w-3" /> Yes</Badge> : <Badge tone="neutral">No</Badge>}</td>
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
          body={deleting.employees_count > 0 ? `${deleting.employees_count} people have this duty type, so the server will refuse.` : "This can't be undone. The server refuses if any draft or past employee still uses it."}
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

function DutyTypeForm({ row, onDone, onCancel }: { row?: DutyTypeRow; onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState(row?.name ?? "");
  const [contractual, setContractual] = useState(row?.is_contractual ?? false);
  const [error, setError] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), is_contractual: contractual };
      if (!row) return createDutyType(body);
      // Send only what changed.
      const changes = Object.fromEntries(Object.entries(body).filter(([k, v]) => row[k as keyof typeof body] !== v));
      return updateDutyType(row.id, changes);
    },
    onSuccess: (r) => {
      toast(row ? `Saved ${r.name}` : `Added ${r.name}`);
      onDone();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422) setError(e.field("name") ?? e.field("is_contractual") ?? e.message);
      else toast(errorMessage(e), "bad");
    },
  });

  const fieldId = `duty-type-${row?.id ?? "new"}`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter a name");
        save.mutate();
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-soft"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={row ? `Edit ${row.name}` : "New duty type"} htmlFor={fieldId} error={error}>
          <Input ref={input} id={fieldId} value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} invalid={!!error} maxLength={100} placeholder="e.g. Apprenticeship" />
        </Field>
        <Switch name={`${fieldId}-contractual`} label="Contractual" description="Fixed-term or engagement-based work." checked={contractual} onChange={setContractual} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
      </div>
    </form>
  );
}
