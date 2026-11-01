"use client";

import { KeyRound, Link2Off, Lock, MailPlus, MoreHorizontal, ShieldCheck, ShieldOff, Smartphone, Unlock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DataTable, Drawer, ModuleHeader, PersonCell, SearchBox, Segments, StatStrip, TableFooter, Toolbar, matches, type Column } from "@/components/employees/module-kit";
import { Badge, Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { credentials as seed, type Credential } from "@/lib/module-data";
import { cn } from "@/lib/utils";

const stateTone = { Active: "ok", Invited: "info", Locked: "bad", "Never sent": "neutral" } as const;
type Filter = "all" | Credential["state"] | "no2fa";

type Action = { kind: "lock" | "unlock" | "reset2fa" | "unbind"; c: Credential };
const actionCopy: Record<Action["kind"], { title: string; body: string; cta: string }> = {
  lock: { title: "Lock account?", body: "They'll be signed out everywhere and can't sign in until unlocked.", cta: "Lock account" },
  unlock: { title: "Unlock account?", body: "They'll be able to sign in again with their existing password.", cta: "Unlock" },
  reset2fa: { title: "Reset two-factor?", body: "Their authenticator is removed. They'll set up 2FA again at next sign-in.", cta: "Reset 2FA" },
  unbind: { title: "Unbind mobile device?", body: "Mobile attendance stops working until they bind a new device.", cta: "Unbind device" },
};

export function View() {
  const [rows, setRows] = useState(seed);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<Action | null>(null);

  const patch = (id: string, p: Partial<Credential>) => setRows((all) => all.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const n = (s: Credential["state"]) => rows.filter((r) => r.state === s).length;
  const no2fa = rows.filter((r) => !r.twoFactor && r.state === "Active").length;
  const list = rows.filter((r) => (filter === "all" ? true : filter === "no2fa" ? !r.twoFactor && r.state === "Active" : r.state === filter) && matches(q, r.employee.name, r.username, r.employee.code));
  const unsent = rows.filter((r) => r.state === "Never sent");

  function invite(c: Credential) {
    patch(c.id, { state: "Invited" });
    toast(`Invite sent to ${c.username}`);
  }

  function confirmAction(a: Action) {
    const { kind, c } = a;
    if (kind === "lock") patch(c.id, { state: "Locked" });
    if (kind === "unlock") patch(c.id, { state: "Active" });
    if (kind === "reset2fa") patch(c.id, { twoFactor: false });
    if (kind === "unbind") patch(c.id, { deviceBound: false });
    toast(`${actionCopy[kind].cta} · ${c.employee.name}`, kind === "lock" ? "bad" : "ok");
    setPending(null);
  }

  const columns: Column<Credential>[] = [
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={r.username} /> },
    { key: "state", header: "Access", cell: (r) => <Badge tone={stateTone[r.state]} dot>{r.state}</Badge> },
    { key: "2fa", header: "2FA", cell: (r) => (r.twoFactor ? <span className="inline-flex items-center gap-1 text-[13px] text-ok"><ShieldCheck className="h-4 w-4" /> On</span> : <span className="inline-flex items-center gap-1 text-[13px] text-ink-3"><ShieldOff className="h-4 w-4" /> Off</span>) },
    { key: "dev", header: "Device", from: "lg", cell: (r) => (r.deviceBound ? <span className="inline-flex items-center gap-1 text-[13px] text-ink-2"><Smartphone className="h-4 w-4" /> Bound</span> : <span className="text-[13px] text-ink-3">—</span>) },
    { key: "last", header: "Last sign-in", from: "lg", cell: (r) => <span className="text-[13px] text-ink-2">{r.lastLogin ?? "Never"}</span> },
    { key: "act", header: "", className: "w-12", cell: (r) => <RowActions c={r} onInvite={() => invite(r)} onReset={() => toast(`Password reset link sent to ${r.username}`, "info")} onAction={(kind) => setPending({ kind, c: r })} /> },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Credentials"
        description="Who can sign in, how they're protected, and which phone they clock in from. Passwords are never shown — only reset."
        actions={
          <Button
            variant="primary"
            disabled={unsent.length === 0}
            onClick={() => {
              setRows((all) => all.map((r) => (r.state === "Never sent" ? { ...r, state: "Invited" } : r)));
              toast(`${unsent.length} invites sent`);
            }}
          >
            <MailPlus className="h-4 w-4" /> Invite all pending ({unsent.length})
          </Button>
        }
      />
      <StatStrip
        items={[
          { label: "Active logins", value: n("Active"), hint: `of ${rows.length} employees`, tone: "ok" },
          { label: "2FA coverage", value: `${Math.round((rows.filter((r) => r.twoFactor).length / rows.length) * 100)}%`, hint: `${no2fa} active users without 2FA`, tone: no2fa ? "warn" : "ok" },
          { label: "Invites pending", value: n("Invited") + n("Never sent"), hint: `${n("Never sent")} not sent yet`, tone: "info" },
          { label: "Locked", value: n("Locked"), hint: "Too many failed attempts", tone: "bad" },
        ]}
      />
      <Toolbar>
        <Segments
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "Active", label: "Active", count: n("Active") },
            { value: "Invited", label: "Invited", count: n("Invited") },
            { value: "Never sent", label: "Not invited", count: n("Never sent") },
            { value: "Locked", label: "Locked", count: n("Locked") },
            { value: "no2fa", label: "Without 2FA", count: no2fa },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Name, email or ID" />
      </Toolbar>
      <DataTable
        rows={list}
        columns={columns}
        footer={<TableFooter shown={list.length} total={rows.length} label="accounts" />}
        mobile={(r) => (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <PersonCell e={r.employee} sub={r.username} />
              <div className="mt-2 flex flex-wrap gap-1.5 pl-[52px]">
                <Badge tone={stateTone[r.state]} dot>{r.state}</Badge>
                <Badge tone={r.twoFactor ? "ok" : "neutral"}>2FA {r.twoFactor ? "on" : "off"}</Badge>
              </div>
            </div>
            <RowActions c={r} onInvite={() => invite(r)} onReset={() => toast(`Password reset link sent to ${r.username}`, "info")} onAction={(kind) => setPending({ kind, c: r })} />
          </div>
        )}
      />
      {pending && (
        <Drawer
          title={actionCopy[pending.kind].title}
          subtitle={`${pending.c.employee.name} · ${pending.c.username}`}
          onClose={() => setPending(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
              <Button variant={pending.kind === "unlock" ? "primary" : "danger"} onClick={() => confirmAction(pending)}>{actionCopy[pending.kind].cta}</Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">{actionCopy[pending.kind].body}</p>
        </Drawer>
      )}
    </div>
  );
}

function RowActions({ c, onInvite, onReset, onAction }: { c: Credential; onInvite: () => void; onReset: () => void; onAction: (k: Action["kind"]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const item = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40";
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={`Actions for ${c.employee.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute top-9 right-0 z-30 w-56 animate-rise rounded-xl border border-line bg-surface p-1 shadow-pop">
          {c.state === "Never sent" || c.state === "Invited" ? (
            <button className={item} onClick={run(onInvite)}><MailPlus className="h-4 w-4" /> {c.state === "Invited" ? "Resend invite" : "Send invite"}</button>
          ) : (
            <button className={item} onClick={run(onReset)}><KeyRound className="h-4 w-4" /> Send password reset</button>
          )}
          <button className={item} disabled={!c.twoFactor} onClick={run(() => onAction("reset2fa"))}><ShieldOff className="h-4 w-4" /> Reset 2FA</button>
          <button className={item} disabled={!c.deviceBound} onClick={run(() => onAction("unbind"))}><Link2Off className="h-4 w-4" /> Unbind mobile device</button>
          <div className="my-1 h-px bg-line" />
          {c.state === "Locked" ? (
            <button className={item} onClick={run(() => onAction("unlock"))}><Unlock className="h-4 w-4" /> Unlock account</button>
          ) : (
            <button className={cn(item, "text-bad hover:bg-bad-soft hover:text-bad")} disabled={c.state !== "Active"} onClick={run(() => onAction("lock"))}><Lock className="h-4 w-4" /> Lock account</button>
          )}
        </div>
      )}
    </div>
  );
}
