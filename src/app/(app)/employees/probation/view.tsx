"use client";

import { BellRing, CheckCircle2, Clock, MessageCircleQuestion } from "lucide-react";
import { useState } from "react";
import { Ring } from "@/components/charts/charts";
import { DataTable, DetailList, Drawer, FormSection, ModuleHeader, PersonCell, SearchBox, Segments, StatStrip, TableFooter, Toolbar, matches, type Column } from "@/components/employees/module-kit";
import { Avatar, Badge, Button, ProgressBar } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { probationCycles as seed, type ProbationCycle } from "@/lib/module-data";
import { cn, daysUntil, formatDate } from "@/lib/utils";

type Stage = "manager" | "hr" | "clarification" | "closed";

function stageOf(c: ProbationCycle): Stage {
  if (c.hrStatus === "Closed") return "closed";
  if (c.hrStatus === "Clarification") return "clarification";
  return c.managerStatus === "Submitted" ? "hr" : "manager";
}

const recTone = { Confirm: "ok", Extend: "warn", Terminate: "bad" } as const;

export function View() {
  const [rows, setRows] = useState(seed);
  const [stage, setStage] = useState<Stage | "all">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<ProbationCycle | null>(null);

  const n = (s: Stage) => rows.filter((r) => stageOf(r) === s).length;
  const list = rows.filter((r) => (stage === "all" || stageOf(r) === stage) && matches(q, r.employee.name, r.employee.code, r.manager.name));

  function close(c: ProbationCycle, outcome: string) {
    setRows((all) => all.map((x) => (x.id === c.id ? { ...x, hrStatus: outcome === "Clarification requested" ? "Clarification" : "Closed" } : x)));
    setOpen(null);
    toast(`${c.employee.name}: ${outcome}`);
  }

  const columns: Column<ProbationCycle>[] = [
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={r.employee.designation} /> },
    { key: "window", header: "Window", cell: (r) => <Window c={r} /> },
    { key: "mgr", header: "Manager review", from: "lg", cell: (r) => <ManagerCell c={r} /> },
    { key: "rec", header: "Recommendation", cell: (r) => (r.recommendation ? <Badge tone={recTone[r.recommendation]}>{r.recommendation}</Badge> : <span className="text-[13px] text-ink-3">—</span>) },
    { key: "stage", header: "Stage", cell: (r) => <StageBadge s={stageOf(r)} /> },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Probation"
        description="Track every probation window, collect manager evaluations and close each cycle with a clear decision."
        actions={<Button variant="secondary" onClick={() => toast(`Reminders sent to ${n("manager")} managers`, "info")}><BellRing className="h-4 w-4" /> Remind managers</Button>}
      />
      <StatStrip
        items={[
          { label: "Awaiting manager", value: n("manager"), hint: "Evaluation not submitted", tone: "warn" },
          { label: "Awaiting HR", value: n("hr"), hint: "Ready for your decision", tone: "info" },
          { label: "Clarification", value: n("clarification"), hint: "Sent back to manager", tone: "violet" },
          { label: "Closed this cycle", value: n("closed"), hint: "Confirmed, extended or exited", tone: "ok" },
        ]}
      />
      <Toolbar>
        <Segments
          value={stage}
          onChange={setStage}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "manager", label: "Awaiting manager", count: n("manager") },
            { value: "hr", label: "Awaiting HR", count: n("hr") },
            { value: "clarification", label: "Clarification", count: n("clarification") },
            { value: "closed", label: "Closed", count: n("closed") },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Employee or manager" />
      </Toolbar>
      <DataTable
        rows={list}
        columns={columns}
        onRowClick={setOpen}
        footer={<TableFooter shown={list.length} total={rows.length} label="cycles" />}
        mobile={(r) => (
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <PersonCell e={r.employee} sub={`Manager: ${r.manager.name}`} />
              <StageBadge s={stageOf(r)} />
            </div>
            <Window c={r} />
          </div>
        )}
      />
      {open && <ProbationDrawer c={open} onClose={() => setOpen(null)} onDecide={(o) => close(open, o)} />}
    </div>
  );
}

function StageBadge({ s }: { s: Stage }) {
  const map = {
    manager: ["warn", "Awaiting manager"],
    hr: ["info", "Awaiting HR"],
    clarification: ["violet", "Clarification"],
    closed: ["ok", "Closed"],
  } as const;
  return <Badge tone={map[s][0]} dot>{map[s][1]}</Badge>;
}

function Window({ c }: { c: ProbationCycle }) {
  const total = Math.max(1, daysUntil(c.end, c.start));
  const left = daysUntil(c.end);
  return (
    <div className="w-full max-w-[200px]">
      <div className="tabular mb-1 flex justify-between text-[12px]">
        <span className="text-ink-3">{formatDate(c.start, { day: "numeric", month: "short" })} – {formatDate(c.end, { day: "numeric", month: "short" })}</span>
        <span className={cn("font-medium", left <= 14 ? "text-warn" : "text-ink-2")}>{left > 0 ? `${left}d` : "Ended"}</span>
      </div>
      <ProgressBar value={((total - left) / total) * 100} tone={left <= 14 ? "warn" : "ink"} />
    </div>
  );
}

function ManagerCell({ c }: { c: ProbationCycle }) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={c.manager.name} hue={c.manager.hue} size="xs" />
      <div className="min-w-0">
        <div className="truncate text-[13px] text-ink">{c.manager.name}</div>
        <div className="flex items-center gap-1 text-[12px] text-ink-3">
          {c.managerStatus === "Submitted" ? <CheckCircle2 className="h-3 w-3 text-ok" /> : <Clock className="h-3 w-3" />}
          {c.managerStatus}
          {c.score !== null && ` · ${c.score}/100`}
        </div>
      </div>
    </div>
  );
}

function ProbationDrawer({ c, onClose, onDecide }: { c: ProbationCycle; onClose: () => void; onDecide: (outcome: string) => void }) {
  const stage = stageOf(c);
  const criteria = [
    ["Quality of work", 4],
    ["Ownership", 5],
    ["Collaboration", 4],
    ["Learning speed", 3],
    ["Attendance & punctuality", 5],
  ] as const;
  return (
    <Drawer
      wide
      title={c.employee.name}
      subtitle={`${c.employee.designation} · ${c.cycle}`}
      onClose={onClose}
      footer={
        stage === "hr" ? (
          <>
            <Button variant="secondary" onClick={() => onDecide("Clarification requested")}><MessageCircleQuestion className="h-4 w-4" /> Clarify</Button>
            <Button variant="secondary" onClick={() => onDecide("Probation extended")}>Extend</Button>
            <Button variant="primary" onClick={() => onDecide("Employment confirmed")}>Confirm</Button>
          </>
        ) : stage === "manager" ? (
          <Button variant="primary" onClick={() => toast(`Reminder sent to ${c.manager.name}`, "info")}><BellRing className="h-4 w-4" /> Remind {c.manager.name.split(" ")[0]}</Button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-5 rounded-2xl bg-surface-2 p-4">
          <Ring value={c.score ?? 0} size={96} stroke={10}>
            <div className="tabular text-2xl font-semibold text-ink">{c.score ?? "—"}</div>
          </Ring>
          <div className="min-w-0">
            <div className="text-[12px] text-ink-3">Manager recommendation</div>
            <div className="mt-1">{c.recommendation ? <Badge tone={recTone[c.recommendation]}>{c.recommendation}</Badge> : <span className="text-sm text-ink-2">Not submitted yet</span>}</div>
            <div className="mt-2 text-[13px] text-ink-2">Evaluated by <span className="font-medium text-ink">{c.manager.name}</span></div>
          </div>
        </div>

        {c.managerStatus === "Submitted" && (
          <FormSection title="Evaluation">
            <ul className="space-y-3">
              {criteria.map(([label, score]) => (
                <li key={label} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-ink-2">{label}</span>
                  <span className="flex gap-1" aria-label={`${score} of 5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={cn("h-2 w-5 rounded-full", i < score ? "bg-ink" : "bg-surface-3")} />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <blockquote className="mt-4 rounded-xl border-l-2 border-ink bg-surface-2 p-3 text-[13px] leading-relaxed text-ink-2">
              “Picked up our stack quickly and shipped two features independently. Needs to communicate blockers earlier, but clearly a strong hire.”
            </blockquote>
          </FormSection>
        )}

        <FormSection title="Cycle">
          <DetailList
            rows={[
              ["Employee ID", c.employee.code],
              ["Probation start", formatDate(c.start)],
              ["Probation end", formatDate(c.end)],
              ["Cycle", c.cycle],
              ["HR status", c.hrStatus],
            ]}
          />
        </FormSection>
      </div>
    </Drawer>
  );
}
