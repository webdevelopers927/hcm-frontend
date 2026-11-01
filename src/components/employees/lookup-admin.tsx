"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/session/session-provider";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { createLookup, deleteLookup, employeeKeys, listLookup, lookupKeys, renameLookup, type LookupResource } from "@/lib/api/employees";
import { ConfirmDialog, ErrorState, Skeleton } from "./api-ui";
import { ModuleHeader, SearchBox } from "./module-kit";

type Row = { id: number; name: string; count: number };

const CONFIG: Record<LookupResource, { title: string; one: string; description: string; countLabel: string; permission: "divisions.manage" | "degree-programs.manage" }> = {
  divisions: { title: "Divisions", one: "division", description: "Top-level groupings used on employee records.", countLabel: "Employees", permission: "divisions.manage" },
  "degree-programs": { title: "Degree programs", one: "degree program", description: "Options for the Qualification section of the employee form.", countLabel: "Qualifications", permission: "degree-programs.manage" },
};

/** Shared admin screen for simple named lookups (create, rename, delete; 409 when in use). */
export function LookupAdmin({ resource }: { resource: LookupResource }) {
  const cfg = CONFIG[resource];
  const qc = useQueryClient();
  const { can } = useSession();
  const manage = can(cfg.permission);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(term.trim()), 250);
    return () => clearTimeout(t);
  }, [term]);

  const list = useQuery({
    queryKey: lookupKeys.list(resource, search),
    queryFn: ({ signal }) => listLookup(resource, search, signal),
    select: (rows): Row[] => rows.map((r) => ({ id: r.id, name: r.name, count: "employees_count" in r ? r.employees_count : r.qualifications_count })),
  });
  // Divisions only filter on the client (the API may ignore ?search).
  const rows = (list.data ?? []).filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["lookups", resource] });
    void qc.invalidateQueries({ queryKey: employeeKeys.formOptions });
    void qc.invalidateQueries({ queryKey: employeeKeys.filters });
  };

  const remove = useMutation({
    mutationFn: (r: Row) => deleteLookup(resource, r.id),
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

  return (
    <div className="space-y-5">
      <ModuleHeader
        title={cfg.title}
        description={cfg.description}
        actions={manage && <Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add {cfg.one}</Button>}
      />
      <SearchBox value={term} onChange={setTerm} placeholder={`Search ${cfg.title.toLowerCase()}`} />

      {creating && <NameForm resource={resource} label={`New ${cfg.one}`} onDone={() => { setCreating(false); refresh(); }} onCancel={() => setCreating(false)} />}

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.isPending ? (
        <Card className="divide-y divide-line">{Array.from({ length: 4 }, (_, i) => <div key={i} className="p-4"><Skeleton className="h-4 w-40" /></div>)}</Card>
      ) : rows.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <h3 className="text-sm font-semibold text-ink">{search ? "Nothing matches" : `No ${cfg.title.toLowerCase()} yet`}</h3>
          <p className="mt-1 text-[13px] text-ink-3">{search ? "Try a different search." : manage ? `Add the first ${cfg.one}.` : "Ask an admin to add some."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[12px] text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="w-32 px-4 py-2.5 text-right font-medium">{cfg.countLabel}</th>
                {manage && <th className="w-28 px-2 py-2.5"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) =>
                editing === r.id ? (
                  <tr key={r.id}>
                    <td colSpan={3} className="p-2">
                      <NameForm resource={resource} id={r.id} initial={r.name} label={`Rename ${r.name}`} onDone={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} inline />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="hover:bg-surface-2">
                    <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                    <td className="tabular px-4 py-3 text-right text-ink-2">{r.count}</td>
                    {manage && (
                      <td className="px-2 py-2 text-right">
                        <button type="button" onClick={() => setEditing(r.id)} aria-label={`Rename ${r.name}`} className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setDeleting(r)} aria-label={`Delete ${r.name}`} className="rounded-lg p-2 text-ink-3 hover:bg-bad-soft hover:text-bad"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    )}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </Card>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          body={deleting.count > 0 ? `It's used by ${deleting.count} record${deleting.count === 1 ? "" : "s"}, so the server will likely refuse.` : "This can't be undone."}
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

function NameForm({ resource, id, initial = "", label, onDone, onCancel, inline }: { resource: LookupResource; id?: number; initial?: string; label: string; onDone: () => void; onCancel: () => void; inline?: boolean }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const save = useMutation({
    mutationFn: () => (id ? renameLookup(resource, id, name.trim()) : createLookup(resource, name.trim())),
    onSuccess: (row) => {
      toast(id ? `Renamed to ${row.name}` : `Added ${row.name}`);
      onDone();
    },
    onError: (e) => (e instanceof ApiError && e.status === 422 ? setError(e.field("name") ?? e.message) : toast(errorMessage(e), "bad")),
  });
  const fieldId = `lookup-${id ?? "new"}`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter a name");
        save.mutate();
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className={inline ? "flex items-start gap-2" : "rounded-2xl border border-line bg-surface p-4 shadow-soft"}
    >
      <Field label={label} htmlFor={fieldId} error={error} className="flex-1">
        <Input ref={input} id={fieldId} value={name} onChange={(e) => { setName(e.target.value); setError(undefined); }} invalid={!!error} maxLength={150} />
      </Field>
      <div className={inline ? "mt-[26px] flex gap-1" : "mt-3 flex justify-end gap-2"}>
        <Button type="button" variant="ghost" size={inline ? "icon" : "md"} onClick={onCancel} aria-label="Cancel">{inline ? <X className="h-4 w-4" /> : "Cancel"}</Button>
        <Button type="submit" variant="primary" size={inline ? "icon" : "md"} disabled={save.isPending} aria-label="Save">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : inline ? <Check className="h-4 w-4" /> : "Save"}
        </Button>
      </div>
    </form>
  );
}
