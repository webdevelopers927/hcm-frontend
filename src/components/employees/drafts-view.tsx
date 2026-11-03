"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FilePen, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session/session-provider";
import { Avatar, Button, Card } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { hueFor } from "@/lib/api/display";
import { deleteEmployee, employeeKeys, listDrafts } from "@/lib/api/employees";
import type { DraftListItem } from "@/lib/api/types";
import { cn, formatDate } from "@/lib/utils";
import { ConfirmDialog, ErrorState, Skeleton, useSlow } from "./api-ui";
import { ModuleHeader, SearchBox } from "./module-kit";

const PER_PAGE = 20;

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return formatDate(iso);
}

/** Unfinished hires. Drafts have no code, login or invite until submitted from the form. */
export function DraftsView() {
  const qc = useQueryClient();
  const { can } = useSession();
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [discard, setDiscard] = useState<DraftListItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(term.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const query = { search: search || undefined, page, per_page: PER_PAGE };
  const list = useQuery({ queryKey: employeeKeys.drafts(query), queryFn: ({ signal }) => listDrafts(query, signal), placeholderData: keepPreviousData });
  const stale = useSlow(list.isPlaceholderData);

  const remove = useMutation({
    mutationFn: (d: DraftListItem) => deleteEmployee(d.id),
    onSuccess: (res) => {
      toast(res.message);
      setDiscard(null);
      void qc.invalidateQueries({ queryKey: ["employees", "drafts"] });
    },
    onError: (e) => toast(errorMessage(e), "bad"),
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;

  return (
    <div className="space-y-5">
      <ModuleHeader
        title={meta ? `Drafts · ${meta.total}` : "Drafts"}
        description="Hires you started but haven't finished. Pick one up where you left off."
        actions={
          can("employees.create") && (
            <Link href="/employees/new" className="inline-flex">
              <Button variant="primary" className="w-full justify-center"><Plus className="h-4 w-4" /> Add employee</Button>
            </Link>
          )
        }
      />

      <div className="flex items-center gap-3">
        <SearchBox value={term} onChange={setTerm} placeholder="Search drafts by name or email" />
        {list.isFetching && !list.isPending && <Loader2 className="h-4 w-4 animate-spin text-ink-3" aria-label="Updating" />}
      </div>

      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} title="Couldn't load drafts" />
      ) : list.isPending || stale ? (
        <Card className="divide-y divide-line">{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center gap-3 p-4"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-4 w-48" /></div>)}</Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-ink-2"><FilePen className="h-5 w-5" /></span>
          <h3 className="mt-3 text-sm font-semibold text-ink">{search ? "No drafts match" : "No drafts"}</h3>
          <p className="mt-1 max-w-sm text-[13px] text-ink-3">{search ? "Try another name or email." : "When you save a new hire before finishing, it shows up here."}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2 text-[12px] text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-medium">Draft</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">Role</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Started by</th>
                <th className="px-4 py-2.5 font-medium">Last edited</th>
                <th className="w-12 px-2 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((d) => (
                <tr key={d.id} className="group relative hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/employees/${d.id}/edit`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <Avatar name={d.name ?? "?"} hue={hueFor(d.id)} src={d.avatar_url} size="md" />
                      <span className="min-w-0">
                        <span className={cn("block truncate font-semibold", d.name ? "text-ink" : "text-ink-3 italic")}>{d.name ?? "Untitled draft"}</span>
                        <span className="block truncate text-[12px] text-ink-3">{d.email ?? "No business email yet"}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-[13px] text-ink-2 md:table-cell">
                    {d.designation?.name ?? "—"}
                    <span className="block text-[12px] text-ink-3">{d.department?.name ?? ""}</span>
                  </td>
                  <td className="hidden px-4 py-3 text-[13px] text-ink-2 lg:table-cell">{d.created_by?.name ?? "—"}</td>
                  <td className="tabular px-4 py-3 text-[13px] text-ink-2" title={formatDate(d.updated_at)}>{ago(d.updated_at)}</td>
                  <td className="relative z-10 px-2 py-3">
                    <button type="button" onClick={() => setDiscard(d)} aria-label={`Discard ${d.name ?? "untitled draft"}`} className="rounded-lg p-2 text-ink-3 hover:bg-bad-soft hover:text-bad">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta && meta.last_page > 1 && (
            <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-ink-3">
              <span className="tabular">Page {meta.current_page} of {meta.last_page}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Next page" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {discard && (
        <ConfirmDialog
          title="Discard this draft?"
          body={<>{discard.name ?? "This untitled draft"} and its uploaded files are deleted for good.</>}
          confirmLabel="Discard draft"
          danger
          busy={remove.isPending}
          onCancel={() => setDiscard(null)}
          onConfirm={() => remove.mutate(discard)}
        />
      )}
    </div>
  );
}
