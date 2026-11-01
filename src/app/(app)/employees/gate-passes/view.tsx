"use client";

import { ArrowRight, Clock } from "lucide-react";
import { useState } from "react";
import { ApprovalBadge, ApproveReject, DataTable, ModuleHeader, PersonCell, SearchBox, Segments, StatStrip, TableFooter, Toolbar, matches, useDecisions, type Column } from "@/components/employees/module-kit";
import { Avatar, Badge, Card, CardHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { gatePasses, type Approval, type GatePass } from "@/lib/module-data";
import { TODAY, formatDate } from "@/lib/utils";

const toH = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3)) / 60;
const mins = (g: GatePass) => Math.round((toH(g.to) - toH(g.from)) * 60);
const mgrTone = { Pending: "warn", Approved: "ok", Rejected: "bad", "Auto-approved": "info" } as const;

/** HR can only act after the manager has decided (or the request timed out). */
const hrCanAct = (g: GatePass) => g.hrStatus === "Pending" && (g.managerStatus === "Approved" || g.managerStatus === "Auto-approved");

export function View() {
  // useDecisions expects `status`; map hrStatus onto it.
  const { rows: raw, decide } = useDecisions(gatePasses.map((g) => ({ ...g, status: g.hrStatus })));
  const rows = raw.map((r) => ({ ...r, hrStatus: r.status }));
  const [filter, setFilter] = useState<Approval | "all">("Pending");
  const [q, setQ] = useState("");

  const today = rows.filter((r) => r.date === TODAY && r.managerStatus !== "Rejected");
  const n = (s: Approval) => rows.filter((r) => r.hrStatus === s).length;
  const list = rows.filter((r) => (filter === "all" || r.hrStatus === filter) && matches(q, r.employee.name, r.reason));

  const act = (r: GatePass, s: Approval) => {
    decide([r.id], s);
    toast(`Gate pass ${s.toLowerCase()} for ${r.employee.name}`, s === "Approved" ? "ok" : "bad");
  };

  const columns: Column<GatePass>[] = [
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={r.reason} /> },
    {
      key: "when",
      header: "Date & interval",
      cell: (r) => (
        <div className="tabular text-[13px]">
          <div className="text-ink">{formatDate(r.date, { weekday: "short", day: "numeric", month: "short" })}</div>
          <div className="text-ink-3">{r.from} – {r.to} · {mins(r)} min</div>
        </div>
      ),
    },
    { key: "chain", header: "Approval chain", cell: (r) => <Chain g={r} /> },
    {
      key: "act",
      header: "",
      className: "text-right",
      cell: (r) =>
        hrCanAct(r) ? <div className="flex justify-end"><ApproveReject compact onApprove={() => act(r, "Approved")} onReject={() => act(r, "Rejected")} /></div> : r.hrStatus === "Pending" ? <span className="text-[12px] text-ink-3">Waiting on manager</span> : null,
    },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader title="Gate passes" description="Short leaves during working hours. Managers approve first, then HR gives the final sign-off." />
      <StatStrip
        items={[
          { label: "Awaiting HR", value: rows.filter(hrCanAct).length, hint: "Manager already approved", tone: "warn" },
          { label: "Out today", value: today.length, hint: `${today.reduce((a, g) => a + mins(g), 0)} min in total`, tone: "info" },
          { label: "Approved", value: n("Approved"), hint: "This month", tone: "ok" },
          { label: "Rejected", value: n("Rejected"), hint: "This month", tone: "bad" },
        ]}
      />

      <Card>
        <CardHeader title="Today out of office" subtitle="09:00 – 18:00" />
        <div className="space-y-3 p-5">
          <div className="tabular ml-[132px] hidden justify-between text-[11px] text-ink-3 sm:flex">
            {[9, 11, 13, 15, 17].map((h) => <span key={h}>{String(h).padStart(2, "0")}:00</span>)}
          </div>
          {today.length === 0 && <p className="text-sm text-ink-3">Nobody has a gate pass today.</p>}
          {today.map((g) => {
            const left = ((toH(g.from) - 9) / 9) * 100;
            const width = ((toH(g.to) - toH(g.from)) / 9) * 100;
            return (
              <div key={g.id} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <div className="flex w-[120px] shrink-0 items-center gap-2">
                  <Avatar name={g.employee.name} hue={g.employee.hue} size="xs" />
                  <span className="truncate text-[13px] font-medium text-ink">{g.employee.pseudoName}</span>
                </div>
                <div className="relative h-7 flex-1 rounded-lg bg-surface-2">
                  {[1, 2, 3, 4].map((i) => <span key={i} className="absolute inset-y-0 w-px bg-line" style={{ left: `${i * 22.2}%` }} />)}
                  <span
                    className="tabular absolute inset-y-1 flex items-center justify-center overflow-hidden rounded-md px-1.5 text-[11px] font-semibold whitespace-nowrap text-accent-ink"
                    style={{ left: `${left}%`, width: `${width}%`, background: g.hrStatus === "Approved" ? "var(--accent)" : "color-mix(in oklab, var(--warn) 45%, var(--surface))" }}
                    title={`${g.from}–${g.to} · ${g.reason}`}
                  >
                    {g.from}–{g.to}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Toolbar>
        <Segments
          value={filter}
          onChange={setFilter}
          options={[
            { value: "Pending", label: "Pending", count: n("Pending") },
            { value: "Approved", label: "Approved", count: n("Approved") },
            { value: "Rejected", label: "Rejected", count: n("Rejected") },
            { value: "all", label: "All", count: rows.length },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Employee or reason" />
      </Toolbar>
      <DataTable
        rows={list}
        columns={columns}
        footer={<TableFooter shown={list.length} total={rows.length} label="gate passes" />}
        mobile={(r) => (
          <div className="space-y-2.5">
            <PersonCell e={r.employee} sub={r.reason} />
            <div className="tabular inline-flex items-center gap-1.5 text-[13px] text-ink-2"><Clock className="h-3.5 w-3.5" />{formatDate(r.date, { day: "numeric", month: "short" })} · {r.from}–{r.to}</div>
            <Chain g={r} />
            {hrCanAct(r) && <ApproveReject onApprove={() => act(r, "Approved")} onReject={() => act(r, "Rejected")} />}
          </div>
        )}
      />
    </div>
  );
}

function Chain({ g }: { g: GatePass }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={mgrTone[g.managerStatus]}>Manager · {g.managerStatus}</Badge>
      <ArrowRight className="h-3 w-3 text-ink-3" />
      {g.managerStatus === "Rejected" ? <Badge>HR · n/a</Badge> : <ApprovalBadge status={g.hrStatus} />}
    </div>
  );
}
