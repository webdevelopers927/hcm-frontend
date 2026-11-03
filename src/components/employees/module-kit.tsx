"use client";

import { Check, ChevronDown, ChevronRight, Inbox, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EMPLOYEE_GROUPS, activeEmployeePage } from "@/components/shell/nav";
import { Avatar, Badge, Button, Card } from "@/components/ui/primitives";
import type { Employee } from "@/lib/data";
import type { Approval } from "@/lib/module-data";
import { cn } from "@/lib/utils";
import { Skeleton } from "./api-ui";

/* ---------------- Header + module switcher ---------------- */

export function ModuleHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <ModuleSwitcher />
        <h1 className="mt-2 font-display text-[38px] leading-none tracking-tight text-ink sm:text-[46px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-2">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1 [&>*]:max-sm:justify-center">{actions}</div>}
    </div>
  );
}

/** Breadcrumb that doubles as a jump menu across every Employees sub-page. */
function ModuleSwitcher() {
  const pathname = usePathname();
  const current = activeEmployeePage(pathname);
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
    <div ref={ref} className="relative inline-flex items-center gap-1.5 text-[13px] font-medium">
      <Link href="/employees" className="text-ink-3 hover:text-ink">
        Employees
      </Link>
      <ChevronRight className="h-3.5 w-3.5 text-ink-3" />
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-md px-1 text-ink hover:bg-surface-3">
        {current.label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-8 left-0 z-40 w-[min(92vw,560px)] animate-rise rounded-2xl border border-line bg-surface p-3 shadow-pop">
          <div className="grid gap-3 sm:grid-cols-2">
            {EMPLOYEE_GROUPS.map((g) => (
              <div key={g.title}>
                <div className="px-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{g.title}</div>
                {g.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setOpen(false)}
                    className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px]", i.href === current.href ? "bg-surface-3 font-semibold text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
                  >
                    <i.icon className="h-4 w-4 text-ink-3" />
                    <span className="flex-1">{i.label}</span>
                    {i.count !== undefined && <span className="tabular text-[11px] text-ink-3">{i.count}</span>}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Stats ---------------- */

type StatTone = "ink" | "ok" | "warn" | "bad" | "info" | "violet";
const statDot: Record<StatTone, string> = { ink: "bg-ink", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-info", violet: "bg-violet" };

export function StatStrip({ items }: { items: { label: string; value: ReactNode; hint?: string; tone?: StatTone }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {items.map((s, i) => (
        <Card key={s.label} className="animate-rise p-4" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
            <span className={cn("h-2 w-2 rounded-full", statDot[s.tone ?? "ink"])} />
            {s.label}
          </div>
          <div className="tabular mt-2 text-[28px] leading-none font-semibold tracking-tight text-ink">{s.value}</div>
          {s.hint && <div className="mt-1.5 truncate text-[12px] text-ink-3">{s.hint}</div>}
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Toolbar ---------------- */

export function Segments<T extends string>({ options, value, onChange }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-1 rounded-xl border border-line bg-surface p-1 shadow-soft">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition",
              value === o.value ? "bg-ink text-canvas" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn("tabular text-[11px]", value === o.value ? "text-canvas/70" : "text-ink-3")}>{o.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full md:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-surface pr-9 pl-10 text-sm text-ink shadow-soft outline-none placeholder:text-ink-3 focus:border-ink focus:ring-4 focus:ring-accent/40"
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-ink-3 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">{children}</div>;
}

/* ---------------- Table ---------------- */

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide the column below this breakpoint. */
  from?: "lg" | "xl";
};

const fromCls = { lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" };

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  mobile,
  onRowClick,
  emptyText = "Nothing here yet",
  footer,
  loading,
  loadingRows = 6,
}: {
  rows: T[];
  columns: Column<T>[];
  mobile: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  footer?: ReactNode;
  /** Keep the header and show shimmering rows in place of the data. */
  loading?: boolean;
  loadingRows?: number;
}) {
  if (loading) return <DataTableSkeleton columns={columns} rows={rows.length || loadingRows} footer={footer} />;
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center px-6 py-14 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-ink-2">
          <Inbox className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-medium text-ink">{emptyText}</p>
        <p className="mt-1 text-[13px] text-ink-3">Try another filter or search term.</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-[12px] tracking-wide text-ink-3 uppercase">
              {columns.map((c, i) => (
                <th key={c.key} className={cn("py-3 pr-4 font-medium whitespace-nowrap", i === 0 && "pl-5", c.from && fromCls[c.from], c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("group transition", onRowClick && "cursor-pointer hover:bg-surface-2")}>
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("py-3 pr-4 align-middle", i === 0 && "pl-5", c.from && fromCls[c.from], c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn("px-4 py-3.5", onRowClick && "cursor-pointer active:bg-surface-2")}>
            {mobile(r)}
          </li>
        ))}
      </ul>
      {footer}
    </Card>
  );
}

/* Varied widths so the placeholder reads like text, not a grid of bars. */
const SKELETON_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-16"];

function DataTableSkeleton<T>({ columns, rows, footer }: { columns: Column<T>[]; rows: number; footer?: ReactNode }) {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-[12px] tracking-wide text-ink-3 uppercase">
              {columns.map((c, i) => (
                <th key={c.key} className={cn("py-3 pr-4 font-medium whitespace-nowrap", i === 0 && "pl-5", c.from && fromCls[c.from], c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r} style={{ opacity: 1 - r * (0.5 / rows) }}>
                {columns.map((c, i) => (
                  <td key={c.key} className={cn("h-[61px] py-3 pr-4 align-middle", i === 0 && "pl-5", c.from && fromCls[c.from], c.className)}>
                    {i === 0 ? (
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                        <div className="space-y-2"><Skeleton className="h-3.5 w-36" /><Skeleton className="h-3 w-24" /></div>
                      </div>
                    ) : c.header === "" ? null : (
                      <Skeleton className={cn("h-3.5", SKELETON_WIDTHS[(r + i) % SKELETON_WIDTHS.length])} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {Array.from({ length: Math.min(rows, 6) }, (_, r) => (
          <li key={r} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-40" /><Skeleton className="h-3 w-28" /></div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </li>
        ))}
      </ul>
      {footer}
    </Card>
  );
}

export function TableFooter({ shown, total, label = "records" }: { shown: number; total: number; label?: string }) {
  return (
    <div className="tabular border-t border-line px-5 py-3 text-[13px] text-ink-3">
      Showing {shown} of {total} {label}
    </div>
  );
}

/* ---------------- Cells ---------------- */

export function PersonCell({ e, sub, size = "md" }: { e: Pick<Employee, "name" | "hue"> & { id?: string }; sub?: ReactNode; size?: "sm" | "md" }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={e.name} hue={e.hue} size={size} />
      <div className="min-w-0">
        <div className="truncate font-semibold text-ink">{e.name}</div>
        {sub && <div className="truncate text-[12px] text-ink-3">{sub}</div>}
      </div>
    </div>
  );
}

export const approvalTone: Record<Approval, "warn" | "ok" | "bad"> = { Pending: "warn", Approved: "ok", Rejected: "bad" };

export function ApprovalBadge({ status }: { status: Approval }) {
  return (
    <Badge tone={approvalTone[status]} dot>
      {status}
    </Badge>
  );
}

export function ApproveReject({ onApprove, onReject, compact }: { onApprove: () => void; onReject: () => void; compact?: boolean }) {
  return (
    <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
      <Button size="sm" variant="secondary" onClick={onReject} aria-label="Reject" className={cn(compact && "w-8 justify-center px-0")}>
        {compact ? <X className="h-3.5 w-3.5" /> : "Reject"}
      </Button>
      <Button size="sm" variant="primary" onClick={onApprove} aria-label="Approve" className={cn(compact && "w-8 justify-center px-0")}>
        <Check className="h-3.5 w-3.5" />
        {!compact && "Approve"}
      </Button>
    </div>
  );
}

/** Local approval state layered over seed data. */
export function useDecisions<T extends { id: string; status: Approval }>(seed: T[]) {
  const [overrides, setOverrides] = useState<Record<string, Approval>>({});
  const rows = seed.map((r) => (overrides[r.id] ? { ...r, status: overrides[r.id]! } : r));
  const decide = (ids: string[], status: Approval) => setOverrides((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, status])) }));
  return { rows, decide };
}

/* ---------------- Drawer ---------------- */

export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade bg-black/35 backdrop-blur-[2px]" onClick={onClose} />
      <aside
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[92dvh] animate-slide-up flex-col rounded-t-3xl bg-surface shadow-pop",
          "sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:animate-slide-in sm:rounded-none sm:rounded-l-3xl",
          wide ? "sm:w-[560px]" : "sm:w-[460px]",
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[13px] text-ink-3">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-ink-2 hover:bg-surface-3 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>*]:flex-1 [&>*]:justify-center">{footer}</div>}
      </aside>
    </div>
  );
}

export function DetailList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 py-3 text-sm">
          <dt className="text-ink-3">{k}</dt>
          <dd className="text-right font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition", checked ? "bg-ink" : "bg-line-strong")}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-surface shadow-soft transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

/** Filters rows by a free-text term against the given fields. */
export function matches(term: string, ...fields: (string | undefined | null)[]) {
  const t = term.trim().toLowerCase();
  return !t || fields.some((f) => f?.toLowerCase().includes(t));
}

export function FormSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
