"use client";

import { AlertTriangle, FilePlus2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { DataTable, Drawer, ModuleHeader, PersonCell, SearchBox, Segments, StatStrip, Switch, TableFooter, Toolbar, matches, type Column } from "@/components/employees/module-kit";
import { Badge, Button, Field, Input } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { employees } from "@/lib/data";
import { contracts as seed, type Contract } from "@/lib/module-data";
import { daysUntil, formatDate } from "@/lib/utils";

type Filter = "all" | Contract["status"];
const statusTone = { Active: "ok", Expiring: "warn", Expired: "bad", Draft: "neutral" } as const;

export function View() {
  const [rows, setRows] = useState(seed);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState<{ mode: "new" | "renew"; contract?: Contract } | null>(null);

  const count = (s: Contract["status"]) => rows.filter((r) => r.status === s).length;
  const expiring = rows.filter((r) => r.status === "Expiring");
  const list = rows.filter((r) => (filter === "all" || r.status === filter) && matches(q, r.employee.name, r.employee.code, r.kind));

  const columns: Column<Contract>[] = [
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={r.employee.designation} /> },
    { key: "kind", header: "Type", cell: (r) => <span className="text-[13px] font-medium text-ink">{r.kind}</span> },
    { key: "period", header: "Period", cell: (r) => <Period c={r} /> },
    { key: "leaves", header: "Leaves", from: "lg", cell: (r) => <span className="text-[13px] text-ink-2">{r.hasLeaves ? "Entitled" : "Not entitled"}</span> },
    { key: "status", header: "Status", cell: (r) => <Badge tone={statusTone[r.status]} dot>{r.status}{!r.signed && " · unsigned"}</Badge> },
    {
      key: "act",
      header: "",
      className: "text-right",
      cell: (r) =>
        r.end && r.status !== "Active" ? (
          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setDrawer({ mode: "renew", contract: r }); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Renew
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Contracts"
        description="Every employment agreement, with expiry tracking so renewals never slip."
        actions={<Button variant="primary" onClick={() => setDrawer({ mode: "new" })}><FilePlus2 className="h-4 w-4" /> New contract</Button>}
      />
      <StatStrip
        items={[
          { label: "Active", value: count("Active"), hint: "Currently in force", tone: "ok" },
          { label: "Expiring ≤ 30 days", value: count("Expiring"), hint: "Renew or close", tone: "warn" },
          { label: "Expired", value: count("Expired"), hint: "Needs action", tone: "bad" },
          { label: "Drafts", value: count("Draft"), hint: "Awaiting signature", tone: "ink" },
        ]}
      />
      {expiring.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-warn/30 bg-warn-soft p-4 sm:flex-row sm:items-center">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
          <p className="flex-1 text-sm text-ink">
            <span className="font-semibold">{expiring.length} contracts expire this month</span> — {expiring.slice(0, 3).map((c) => c.employee.name).join(", ")}
            {expiring.length > 3 && ` and ${expiring.length - 3} more`}.
          </p>
          <Button size="sm" variant="secondary" onClick={() => setFilter("Expiring")}>Review</Button>
        </div>
      )}
      <Toolbar>
        <Segments
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "Active", label: "Active", count: count("Active") },
            { value: "Expiring", label: "Expiring", count: count("Expiring") },
            { value: "Expired", label: "Expired", count: count("Expired") },
            { value: "Draft", label: "Drafts", count: count("Draft") },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Search name, ID or type" />
      </Toolbar>
      <DataTable
        rows={list}
        columns={columns}
        footer={<TableFooter shown={list.length} total={rows.length} label="contracts" />}
        mobile={(r) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <PersonCell e={r.employee} sub={r.kind} />
              <Badge tone={statusTone[r.status]} dot>{r.status}</Badge>
            </div>
            <Period c={r} />
          </div>
        )}
      />
      {drawer && (
        <ContractDrawer
          mode={drawer.mode}
          contract={drawer.contract}
          onClose={() => setDrawer(null)}
          onSave={(c) => {
            setRows((all) => (all.some((x) => x.id === c.id) ? all.map((x) => (x.id === c.id ? c : x)) : [c, ...all]));
            setDrawer(null);
            toast(drawer.mode === "renew" ? `Contract renewed for ${c.employee.name}` : "Contract created");
          }}
        />
      )}
    </div>
  );
}

function Period({ c }: { c: Contract }) {
  if (!c.end) return <span className="tabular text-[13px] text-ink-2">Since {formatDate(c.start, { month: "short", year: "numeric" })} · open-ended</span>;
  const total = Math.max(1, daysUntil(c.end, c.start));
  const left = daysUntil(c.end);
  const pct = Math.min(100, Math.max(0, ((total - left) / total) * 100));
  return (
    <div className="w-full max-w-[220px]">
      <div className="tabular mb-1 flex justify-between text-[12px] text-ink-3">
        <span>{formatDate(c.start, { month: "short", year: "2-digit" })}</span>
        <span className={left < 0 ? "font-semibold text-bad" : left <= 30 ? "font-semibold text-warn" : ""}>
          {left < 0 ? `Ended ${-left}d ago` : `${left}d left`}
        </span>
        <span>{formatDate(c.end, { month: "short", year: "2-digit" })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className={left < 0 ? "h-full bg-bad" : left <= 30 ? "h-full bg-warn" : "h-full bg-ink"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ContractDrawer({ mode, contract, onClose, onSave }: { mode: "new" | "renew"; contract?: Contract; onClose: () => void; onSave: (c: Contract) => void }) {
  const [employeeId, setEmployeeId] = useState(contract?.employee.id ?? "");
  const [kind, setKind] = useState<Contract["kind"]>(contract?.kind ?? "Fixed-term");
  const [start, setStart] = useState(contract?.end ?? "2026-11-01");
  const [end, setEnd] = useState("2027-10-31");
  const [hasLeaves, setHasLeaves] = useState(contract?.hasLeaves ?? true);
  const [error, setError] = useState("");

  function save() {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return setError("Choose an employee");
    if (kind !== "Permanent" && end <= start) return setError("End date must be after start date");
    onSave({
      id: contract?.id ?? `CT-${Date.now()}`,
      employee,
      kind,
      start,
      end: kind === "Permanent" ? null : end,
      hasLeaves,
      status: "Active",
      signed: false,
    });
  }

  return (
    <Drawer
      title={mode === "renew" ? "Renew contract" : "New contract"}
      subtitle={contract ? `${contract.employee.name} · previous ended ${contract.end ? formatDate(contract.end) : "—"}` : "Draft is sent for e-signature after saving"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{mode === "renew" ? "Renew & send" : "Create & send"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Employee" htmlFor="ce" error={error && !employeeId ? error : undefined}>
          <Select inputId="ce" value={employeeId} onChange={setEmployeeId} disabled={mode === "renew"} invalid={!!error && !employeeId} placeholder="Select employee…" options={employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.code}` }))} />
        </Field>
        <Field label="Contract type" htmlFor="ck">
          <div className="grid grid-cols-2 gap-2">
            {(["Permanent", "Fixed-term", "Consultant", "Internship"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={kind === k ? "h-11 rounded-xl border border-ink bg-ink text-[13px] font-medium text-canvas" : "h-11 rounded-xl border border-line text-[13px] font-medium text-ink-2 hover:border-line-strong"}
              >
                {k}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" htmlFor="cs"><Input id="cs" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          {kind !== "Permanent" && (
            <Field label="End date" htmlFor="cen" error={error && employeeId ? error : undefined}><Input id="cen" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          )}
        </div>
        <div className="flex items-center justify-between rounded-xl border border-line p-4">
          <div>
            <div className="text-sm font-medium text-ink">Leave entitlement</div>
            <div className="text-[12px] text-ink-3">Accrue annual, sick and casual leave</div>
          </div>
          <Switch checked={hasLeaves} onChange={setHasLeaves} label="Leave entitlement" />
        </div>
      </div>
    </Drawer>
  );
}
