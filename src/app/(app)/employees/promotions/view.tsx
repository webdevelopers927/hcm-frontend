"use client";

import { ArrowRight, Info, Plus, TrendingUp } from "lucide-react";
import { useState } from "react";
import { ApprovalBadge, ApproveReject, DataTable, Drawer, ModuleHeader, PersonCell, SearchBox, Segments, StatStrip, TableFooter, Toolbar, matches, useDecisions, type Column } from "@/components/employees/module-kit";
import { Badge, Button, Field, Input } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { employees } from "@/lib/data";
import { promotions as seed, type Approval, type Promotion } from "@/lib/module-data";
import { TODAY, formatDate } from "@/lib/utils";

export function View() {
  const [extra, setExtra] = useState<Promotion[]>([]);
  const { rows, decide } = useDecisions([...extra, ...seed]);
  const [filter, setFilter] = useState<Approval | "all">("all");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const n = (s: Approval) => rows.filter((r) => r.status === s).length;
  const approved = rows.filter((r) => r.status === "Approved");
  const avgRaise = approved.length ? Math.round(approved.reduce((s, r) => s + r.raisePct, 0) / approved.length) : 0;
  const list = rows.filter((r) => (filter === "all" || r.status === filter) && matches(q, r.employee.name, r.from, r.to));

  const act = (r: Promotion, s: Approval) => {
    decide([r.id], s);
    toast(`${r.employee.name}'s promotion ${s.toLowerCase()}`, s === "Approved" ? "ok" : "bad");
  };

  const columns: Column<Promotion>[] = [
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={r.employee.department} /> },
    { key: "move", header: "Change", cell: (r) => <Move p={r} /> },
    { key: "raise", header: "Raise", cell: (r) => <Badge tone="ok"><TrendingUp className="h-3 w-3" /> {r.raisePct}%</Badge> },
    { key: "eff", header: "Effective", from: "lg", cell: (r) => <Effective date={r.effectiveDate} /> },
    { key: "why", header: "Reason", from: "xl", cell: (r) => <span className="line-clamp-1 max-w-[220px] text-[13px] text-ink-2">{r.note}</span> },
    { key: "status", header: "Status", cell: (r) => (r.status === "Pending" ? <ApproveReject compact onApprove={() => act(r, "Approved")} onReject={() => act(r, "Rejected")} /> : <ApprovalBadge status={r.status} />) },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Promotions"
        description="Recognise growth with a clear record of every role change, raise and the date it takes effect."
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Propose promotion</Button>}
      />
      <StatStrip
        items={[
          { label: "Pending approval", value: n("Pending"), hint: "Waiting on you", tone: "warn" },
          { label: "Approved (YTD)", value: n("Approved"), hint: "Across all teams", tone: "ok" },
          { label: "Average raise", value: `${avgRaise}%`, hint: "Approved promotions", tone: "info" },
          { label: "Rejected", value: n("Rejected"), hint: "With feedback", tone: "bad" },
        ]}
      />
      <Toolbar>
        <Segments
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "Pending", label: "Pending", count: n("Pending") },
            { value: "Approved", label: "Approved", count: n("Approved") },
            { value: "Rejected", label: "Rejected", count: n("Rejected") },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Employee or designation" />
      </Toolbar>
      <DataTable
        rows={list}
        columns={columns}
        footer={<TableFooter shown={list.length} total={rows.length} label="promotions" />}
        mobile={(r) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <PersonCell e={r.employee} sub={`+${r.raisePct}% · effective ${formatDate(r.effectiveDate, { day: "numeric", month: "short" })}`} />
              {r.status !== "Pending" && <ApprovalBadge status={r.status} />}
            </div>
            <Move p={r} />
            {r.status === "Pending" && <ApproveReject onApprove={() => act(r, "Approved")} onReject={() => act(r, "Rejected")} />}
          </div>
        )}
      />
      {creating && (
        <NewPromotion
          onClose={() => setCreating(false)}
          onSave={(p) => {
            setExtra((x) => [p, ...x]);
            setCreating(false);
            toast(`Promotion proposed for ${p.employee.name}`);
          }}
        />
      )}
    </div>
  );
}

function Move({ p }: { p: Pick<Promotion, "from" | "to"> }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[13px]">
      <span className="text-ink-3 line-through decoration-line-strong">{p.from}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-3" />
      <span className="font-semibold text-ink">{p.to}</span>
    </div>
  );
}

function Effective({ date }: { date: string }) {
  const future = date > TODAY;
  return (
    <div>
      <div className="tabular text-[13px] text-ink">{formatDate(date)}</div>
      <div className="text-[12px] text-ink-3">{future ? "Scheduled" : "In effect"}</div>
    </div>
  );
}

function NewPromotion({ onClose, onSave }: { onClose: () => void; onSave: (p: Promotion) => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [to, setTo] = useState("");
  const [effective, setEffective] = useState("2026-12-01");
  const [raise, setRaise] = useState("15");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const employee = employees.find((e) => e.id === employeeId);

  function save() {
    const e: Record<string, string> = {};
    if (!employee) e.employee = "Choose an employee";
    if (!to.trim()) e.to = "Enter the new designation";
    if (!effective) e.effective = "Pick an effective date";
    setErrors(e);
    if (Object.keys(e).length || !employee) return;
    onSave({ id: `PR-${Date.now()}`, employee, from: employee.designation, to, effectiveDate: effective, raisePct: Number(raise) || 0, status: "Pending", note: note || "—" });
  }

  return (
    <Drawer
      title="Propose promotion"
      subtitle="Goes to the department head and People team for approval"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Submit for approval</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Employee" htmlFor="pe" error={errors.employee}>
          <Select inputId="pe" value={employeeId} onChange={setEmployeeId} invalid={!!errors.employee} placeholder="Select employee…" options={employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.designation}` }))} />
        </Field>
        {employee && to && (
          <div className="rounded-xl bg-surface-2 p-3">
            <Move p={{ from: employee.designation, to }} />
          </div>
        )}
        <Field label="New designation" htmlFor="pt" error={errors.to}>
          <Input id="pt" value={to} onChange={(e) => setTo(e.target.value)} placeholder="e.g. Senior Product Designer" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Effective date" htmlFor="pd" error={errors.effective}>
            <Input id="pd" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} />
          </Field>
          <Field label="Salary raise (%)" htmlFor="pr">
            <Input id="pr" inputMode="numeric" value={raise} onChange={(e) => setRaise(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
        <Field label="Why now?" htmlFor="pn">
          <textarea
            id="pn"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Impact, scope change, feedback…"
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-ink focus:ring-4 focus:ring-accent/40"
          />
        </Field>
        <p className="flex gap-2 rounded-xl bg-info-soft p-3 text-[13px] text-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> The new title and salary apply on the effective date, not on approval.
        </p>
      </div>
    </Drawer>
  );
}
