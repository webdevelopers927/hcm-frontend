"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Avatar, Badge, Button, Card } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/api/client";
import { employmentStatusTone, hueFor, workModeLabel } from "@/lib/api/display";
import { employeeKeys, getEmployeeFilters } from "@/lib/api/employees";
import type { EmployeeSummary, EmploymentStatusRef, WorkMode } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Lookups for filters and forms. Rarely change, so cached for the session. */
export function useEmployeeFilters() {
  return useQuery({ queryKey: employeeKeys.filters, queryFn: ({ signal }) => getEmployeeFilters(signal), staleTime: Infinity, gcTime: Infinity });
}

/** Status shown as dot + name, so it never relies on colour alone. */
export function ApiStatusBadge({ status }: { status: EmploymentStatusRef | null }) {
  if (!status) return <Badge tone="neutral" dot>No status</Badge>;
  return <Badge tone={employmentStatusTone(status)} dot>{status.name}</Badge>;
}

const modeTone: Record<WorkMode, "neutral" | "accent" | "info"> = { onsite: "neutral", hybrid: "accent", remote: "info" };

export function ApiModeBadge({ mode }: { mode: WorkMode }) {
  const { data } = useEmployeeFilters();
  return <Badge tone={modeTone[mode]}>{workModeLabel(mode, data)}</Badge>;
}

export function EmployeeAvatar({ e, size = "md", className }: { e: { id: number; name: string; avatar_url: string | null }; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  return <Avatar name={e.name} hue={hueFor(e.id)} src={e.avatar_url} size={size} className={className} />;
}

export function SummaryRow({ e }: { e: EmployeeSummary }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <EmployeeAvatar e={e} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-ink">{e.name}</span>
        <span className="block truncate text-[12px] text-ink-3">{e.designation?.name ?? "—"}</span>
      </span>
    </span>
  );
}

export function ErrorState({ error, onRetry, title = "Couldn't load this" }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center" role="alert">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-bad-soft text-bad">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-ink-3">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("shimmer block rounded-md", className)} />;
}

/**
 * True once `busy` has lasted `delay` ms. Swapping rows for skeletons on a
 * fast response just flickers; this only shows them when the wait is felt.
 */
export function useSlow(busy: boolean, delay = 150) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setSlow(true), delay);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [busy, delay]);
  return busy && slow;
}

/** Keyboard-accessible confirm dialog (Esc cancels, focus starts on Cancel). */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 animate-fade bg-black/40 backdrop-blur-[2px]" onClick={() => !busy && onCancel()} />
      <div className="relative w-full max-w-md animate-rise rounded-3xl bg-surface p-6 shadow-pop">
        <h2 id="confirm-title" className="text-lg font-semibold text-ink">{title}</h2>
        {body && <div className="mt-1.5 text-sm text-ink-2">{body}</div>}
        {children}
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1 justify-center" onClick={onCancel} disabled={busy} autoFocus>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} className="flex-1 justify-center" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
