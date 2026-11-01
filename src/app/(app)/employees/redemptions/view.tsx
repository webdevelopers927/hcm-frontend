"use client";

import { AlertCircle, Gift, Star } from "lucide-react";
import { useState } from "react";
import { ApprovalBadge, ApproveReject, DataTable, ModuleHeader, PersonCell, SearchBox, Segments, StatStrip, TableFooter, Toolbar, matches, useDecisions, type Column } from "@/components/employees/module-kit";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { redemptions as seed, type Approval, type Redemption } from "@/lib/module-data";
import { formatDate } from "@/lib/utils";

function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span className={`tabular inline-flex items-center gap-1 font-semibold ${className ?? ""}`}>
      <Star className="h-3.5 w-3.5 fill-[var(--warn)] text-warn" />
      {n}
    </span>
  );
}

export function View() {
  const { rows, decide } = useDecisions(seed);
  const [filter, setFilter] = useState<Approval | "all">("Pending");
  const [q, setQ] = useState("");

  const n = (s: Approval) => rows.filter((r) => r.status === s).length;
  const list = rows.filter((r) => (filter === "all" || r.status === filter) && matches(q, r.employee.name, r.offer));
  const offers = [...new Set(rows.map((r) => r.offer))].map((o) => ({ offer: o, stars: rows.find((r) => r.offer === o)!.stars, count: rows.filter((r) => r.offer === o).length })).sort((a, b) => b.count - a.count);

  const act = (r: Redemption, s: Approval) => {
    decide([r.id], s);
    toast(s === "Approved" ? `${r.stars} stars deducted from ${r.employee.name}` : `Request from ${r.employee.name} rejected`, s === "Approved" ? "ok" : "bad");
  };

  const action = (r: Redemption, compact: boolean) => {
    if (r.status !== "Pending") return <ApprovalBadge status={r.status} />;
    if (r.balance < r.stars) return <Badge tone="bad"><AlertCircle className="h-3 w-3" /> Insufficient stars</Badge>;
    return <ApproveReject compact={compact} onApprove={() => act(r, "Approved")} onReject={() => act(r, "Rejected")} />;
  };

  const columns: Column<Redemption>[] = [
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={r.employee.department} /> },
    { key: "offer", header: "Offer", cell: (r) => <span className="inline-flex items-center gap-2 text-[13px] font-medium text-ink"><Gift className="h-4 w-4 text-ink-3" />{r.offer}</span> },
    { key: "cost", header: "Cost", cell: (r) => <Stars n={r.stars} className="text-[13px] text-ink" /> },
    { key: "bal", header: "Balance after", from: "lg", cell: (r) => <span className={`tabular text-[13px] ${r.balance - r.stars < 0 ? "font-semibold text-bad" : "text-ink-2"}`}>{r.balance} → {r.balance - r.stars}</span> },
    { key: "date", header: "Requested", from: "xl", cell: (r) => <span className="tabular text-[13px] text-ink-3">{formatDate(r.requestedAt, { day: "numeric", month: "short" })}</span> },
    { key: "act", header: "", className: "text-right", cell: (r) => <div className="flex justify-end">{action(r, true)}</div> },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader title="Star redemptions" description="People earn stars for great work and spend them on rewards. Approve requests and stars are deducted automatically." />
      <StatStrip
        items={[
          { label: "Pending", value: n("Pending"), hint: `${rows.filter((r) => r.status === "Pending").reduce((a, r) => a + r.stars, 0)} stars requested`, tone: "warn" },
          { label: "Stars redeemed", value: rows.filter((r) => r.status === "Approved").reduce((a, r) => a + r.stars, 0), hint: "This quarter", tone: "ok" },
          { label: "Approved", value: n("Approved"), hint: "Requests", tone: "info" },
          { label: "Rejected", value: n("Rejected"), hint: "Requests", tone: "bad" },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
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
            <SearchBox value={q} onChange={setQ} placeholder="Employee or offer" />
          </Toolbar>
          <DataTable
            rows={list}
            columns={columns}
            footer={<TableFooter shown={list.length} total={rows.length} label="requests" />}
            mobile={(r) => (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <PersonCell e={r.employee} sub={r.offer} />
                  <Stars n={r.stars} className="text-sm text-ink" />
                </div>
                {action(r, false)}
              </div>
            )}
          />
        </div>
        <Card className="self-start">
          <CardHeader title="Popular rewards" subtitle="By number of requests" />
          <ul className="space-y-1 p-2 pt-3">
            {offers.map((o) => (
              <li key={o.offer} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn"><Gift className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{o.offer}</div>
                  <div className="text-[12px] text-ink-3">{o.count} requests</div>
                </div>
                <Stars n={o.stars} className="text-[13px] text-ink" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
