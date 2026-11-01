"use client";

import { CheckCheck, Download } from "lucide-react";
import { useState } from "react";
import { ApprovalBadge, ApproveReject, DataTable, ModuleHeader, PersonCell, SearchBox, Segments, StatStrip, TableFooter, Toolbar, matches, useDecisions, type Column } from "@/components/employees/module-kit";
import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { overtime as seed, type Approval, type OvertimeEntry } from "@/lib/module-data";
import { formatDate } from "@/lib/utils";

function Hours({ r }: { r: OvertimeEntry }) {
  const total = r.regularHours + r.overtimeHours;
  return (
    <div className="w-44">
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-3">
        <span className="bg-ink-3/50" style={{ width: `${(r.regularHours / 13) * 100}%` }} />
        <span className="bg-accent" style={{ width: `${(r.overtimeHours / 13) * 100}%` }} />
      </div>
      <div className="tabular mt-1 flex justify-between text-[12px]">
        <span className="text-ink-3">{r.regularHours}h shift</span>
        <span className="font-semibold text-ink">+{r.overtimeHours}h · {total}h</span>
      </div>
    </div>
  );
}

export function View() {
  const { rows, decide } = useDecisions(seed);
  const [filter, setFilter] = useState<Approval | "all">("Pending");
  const [q, setQ] = useState("");

  const sum = (s: Approval) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.overtimeHours, 0);
  const n = (s: Approval) => rows.filter((r) => r.status === s).length;
  const list = rows.filter((r) => (filter === "all" || r.status === filter) && matches(q, r.employee.name, r.employee.department, r.reason));
  const pending = list.filter((r) => r.status === "Pending");

  const act = (r: OvertimeEntry, s: Approval) => {
    decide([r.id], s);
    toast(`${r.overtimeHours}h overtime ${s.toLowerCase()} for ${r.employee.name}`, s === "Approved" ? "ok" : "bad");
  };

  const columns: Column<OvertimeEntry>[] = [
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={`${r.employee.designation} · ${r.employee.department}`} /> },
    { key: "date", header: "Date", cell: (r) => <span className="tabular text-[13px] text-ink">{formatDate(r.date, { weekday: "short", day: "numeric", month: "short" })}</span> },
    { key: "hours", header: "Hours", cell: (r) => <Hours r={r} /> },
    { key: "reason", header: "Reason", from: "lg", cell: (r) => <span className="text-[13px] text-ink-2">{r.reason}</span> },
    { key: "status", header: "", className: "text-right", cell: (r) => (r.status === "Pending" ? <div className="flex justify-end"><ApproveReject compact onApprove={() => act(r, "Approved")} onReject={() => act(r, "Rejected")} /></div> : <ApprovalBadge status={r.status} />) },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Overtime"
        description="Review extra hours against each person's regular shift before they reach payroll."
        actions={
          <>
            <Button variant="secondary"><Download className="h-4 w-4" /> Export</Button>
            <Button
              variant="primary"
              disabled={pending.length === 0}
              onClick={() => {
                decide(pending.map((r) => r.id), "Approved");
                toast(`${pending.length} overtime requests approved`);
              }}
            >
              <CheckCheck className="h-4 w-4" /> Approve all ({pending.length})
            </Button>
          </>
        }
      />
      <StatStrip
        items={[
          { label: "Pending", value: `${sum("Pending")}h`, hint: `${n("Pending")} requests`, tone: "warn" },
          { label: "Approved (Oct)", value: `${sum("Approved")}h`, hint: "Sent to payroll", tone: "ok" },
          { label: "Rejected", value: `${sum("Rejected")}h`, hint: `${n("Rejected")} requests`, tone: "bad" },
          { label: "Avg per request", value: `${(rows.reduce((a, r) => a + r.overtimeHours, 0) / rows.length).toFixed(1)}h`, hint: "Last 30 days", tone: "info" },
        ]}
      />
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
        <SearchBox value={q} onChange={setQ} placeholder="Employee, department, reason" />
      </Toolbar>
      <DataTable
        rows={list}
        columns={columns}
        emptyText="No overtime requests in this view"
        footer={<TableFooter shown={list.length} total={rows.length} label="requests" />}
        mobile={(r) => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <PersonCell e={r.employee} sub={`${formatDate(r.date, { day: "numeric", month: "short" })} · ${r.reason}`} />
              {r.status !== "Pending" && <ApprovalBadge status={r.status} />}
            </div>
            <Hours r={r} />
            {r.status === "Pending" && <ApproveReject onApprove={() => act(r, "Approved")} onReject={() => act(r, "Rejected")} />}
          </div>
        )}
      />
    </div>
  );
}
