"use client";

import { ArrowRight, CalendarClock, Check, Columns3, List, UserMinus } from "lucide-react";
import { useState } from "react";
import { DataTable, DetailList, Drawer, FormSection, ModuleHeader, PersonCell, StatStrip, TableFooter, selectCls, type Column } from "@/components/employees/module-kit";
import { Badge, Button, Card, Field, Input, ProgressBar } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { employees } from "@/lib/data";
import { OFFBOARD_STAGES, offboardings as seed, type OffboardStage, type Offboarding } from "@/lib/module-data";
import { cn, daysUntil, formatDate } from "@/lib/utils";

const typeTone = { Resignation: "info", Termination: "bad", "Contract end": "warn", Retirement: "violet" } as const;
const progress = (o: Offboarding) => (o.checklist.filter((c) => c.done).length / o.checklist.length) * 100;

export function View() {
  const [rows, setRows] = useState(seed);
  const [view, setView] = useState<"board" | "list">("board");
  const [openId, setOpenId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const open = rows.find((r) => r.id === openId) ?? null;

  const update = (o: Offboarding) => setRows((all) => all.map((x) => (x.id === o.id ? o : x)));
  const active = rows.filter((r) => r.stage !== "Completed");
  const leavingThisMonth = active.filter((r) => daysUntil(r.lastWorkingDay) <= 30);

  const columns: Column<Offboarding>[] = [
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={r.employee.designation} /> },
    { key: "type", header: "Type", cell: (r) => <Badge tone={typeTone[r.type]}>{r.type}</Badge> },
    { key: "stage", header: "Stage", cell: (r) => <span className="text-[13px] font-medium text-ink">{r.stage}</span> },
    { key: "lwd", header: "Last working day", from: "lg", cell: (r) => <span className="tabular text-[13px] text-ink-2">{formatDate(r.lastWorkingDay)}</span> },
    { key: "check", header: "Checklist", cell: (r) => <div className="w-28"><ProgressBar value={progress(r)} tone={progress(r) === 100 ? "ok" : "ink"} /></div> },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Off-boarding"
        description="Resignations, terminations and contract ends — with a checklist so nothing walks out the door."
        actions={
          <>
            <div className="flex rounded-xl border border-line bg-surface p-0.5 shadow-soft">
              {([["board", Columns3], ["list", List]] as const).map(([v, Icon]) => (
                <button key={v} onClick={() => setView(v)} aria-label={`${v} view`} aria-pressed={view === v} className={cn("inline-flex h-9 w-10 items-center justify-center rounded-lg", view === v ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink")}>
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            <Button variant="primary" onClick={() => setStarting(true)}><UserMinus className="h-4 w-4" /> Start off-boarding</Button>
          </>
        }
      />
      <StatStrip
        items={[
          { label: "In progress", value: active.length, hint: "Across all stages", tone: "info" },
          { label: "Leaving ≤ 30 days", value: leavingThisMonth.length, hint: "Plan handovers now", tone: "warn" },
          { label: "Pending clearance", value: rows.filter((r) => r.stage === "Clearance").length, hint: "Assets & access", tone: "violet" },
          { label: "Completed", value: rows.filter((r) => r.stage === "Completed").length, hint: "This quarter", tone: "ok" },
        ]}
      />

      {view === "board" ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid w-max grid-flow-col auto-cols-[270px] gap-4 xl:w-full xl:auto-cols-fr">
            {OFFBOARD_STAGES.map((stage) => {
              const items = rows.filter((r) => r.stage === stage);
              return (
                <div key={stage} className="flex flex-col rounded-2xl bg-surface-3/60 p-2">
                  <div className="flex items-center justify-between px-2 py-2">
                    <span className="text-[13px] font-semibold text-ink">{stage}</span>
                    <span className="tabular rounded-md bg-surface px-1.5 text-[12px] font-semibold text-ink-2">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((o) => (
                      <button key={o.id} onClick={() => setOpenId(o.id)} className="block w-full text-left">
                        <Card className="p-3.5 transition hover:-translate-y-0.5 hover:shadow-float">
                          <PersonCell e={o.employee} sub={o.employee.department} size="sm" />
                          <div className="mt-3 flex items-center justify-between text-[12px]">
                            <Badge tone={typeTone[o.type]}>{o.type}</Badge>
                            <span className="tabular inline-flex items-center gap-1 text-ink-3"><CalendarClock className="h-3.5 w-3.5" />{formatDate(o.lastWorkingDay, { day: "numeric", month: "short" })}</span>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <ProgressBar value={progress(o)} tone={progress(o) === 100 ? "ok" : "ink"} />
                            <span className="tabular text-[11px] text-ink-3">{o.checklist.filter((c) => c.done).length}/{o.checklist.length}</span>
                          </div>
                        </Card>
                      </button>
                    ))}
                    {items.length === 0 && <div className="rounded-xl border border-dashed border-line-strong p-4 text-center text-[12px] text-ink-3">No one here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          onRowClick={(r) => setOpenId(r.id)}
          footer={<TableFooter shown={rows.length} total={rows.length} label="cases" />}
          mobile={(r) => (
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <PersonCell e={r.employee} sub={`${r.stage} · LWD ${formatDate(r.lastWorkingDay, { day: "numeric", month: "short" })}`} />
                <Badge tone={typeTone[r.type]}>{r.type}</Badge>
              </div>
              <ProgressBar value={progress(r)} />
            </div>
          )}
        />
      )}

      {open && <CaseDrawer o={open} onClose={() => setOpenId(null)} onChange={update} />}
      {starting && (
        <StartDrawer
          onClose={() => setStarting(false)}
          onSave={(o) => {
            setRows((all) => [o, ...all]);
            setStarting(false);
            toast(`Off-boarding started for ${o.employee.name}`);
          }}
        />
      )}
    </div>
  );
}

function CaseDrawer({ o, onClose, onChange }: { o: Offboarding; onClose: () => void; onChange: (o: Offboarding) => void }) {
  const idx = OFFBOARD_STAGES.indexOf(o.stage);
  const next = OFFBOARD_STAGES[idx + 1] as OffboardStage | undefined;
  return (
    <Drawer
      wide
      title={o.employee.name}
      subtitle={`${o.type} · ${o.employee.designation}`}
      onClose={onClose}
      footer={
        next ? (
          <Button
            variant="primary"
            onClick={() => {
              onChange({ ...o, stage: next });
              toast(`${o.employee.name} moved to ${next}`);
            }}
          >
            Move to {next} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="secondary" onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="space-y-6">
        <ol className="flex items-center gap-1">
          {OFFBOARD_STAGES.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col items-center gap-1.5 text-center">
              <span className={cn("h-1.5 w-full rounded-full", i <= idx ? "bg-ink" : "bg-surface-3")} />
              <span className={cn("text-[10px] leading-tight sm:text-[11px]", i === idx ? "font-semibold text-ink" : "text-ink-3")}>{s}</span>
            </li>
          ))}
        </ol>

        <FormSection title="Exit checklist">
          <ul className="space-y-2">
            {o.checklist.map((c, i) => (
              <li key={c.label}>
                <button
                  onClick={() => onChange({ ...o, checklist: o.checklist.map((x, k) => (k === i ? { ...x, done: !x.done } : x)) })}
                  className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", c.done ? "border-transparent bg-ok-soft" : "border-line hover:border-line-strong")}
                >
                  <span className={cn("inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", c.done ? "border-ok bg-ok text-white" : "border-line-strong")}>
                    {c.done && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className={cn("flex-1 text-sm", c.done ? "text-ink-2 line-through" : "font-medium text-ink")}>{c.label}</span>
                  <span className="text-[12px] text-ink-3">{c.owner}</span>
                </button>
              </li>
            ))}
          </ul>
        </FormSection>

        <FormSection title="Dates">
          <DetailList
            rows={[
              ["Submitted", formatDate(o.submittedAt)],
              ["Effective date", formatDate(o.effectiveDate)],
              ["Last working day", `${formatDate(o.lastWorkingDay)} · ${daysUntil(o.lastWorkingDay) >= 0 ? `in ${daysUntil(o.lastWorkingDay)}d` : "passed"}`],
              ["Employment status", o.employee.status],
            ]}
          />
        </FormSection>
      </div>
    </Drawer>
  );
}

function StartDrawer({ onClose, onSave }: { onClose: () => void; onSave: (o: Offboarding) => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<Offboarding["type"]>("Resignation");
  const [submitted, setSubmitted] = useState("2026-11-01");
  const [effective, setEffective] = useState("2026-11-01");
  const [lwd, setLwd] = useState("2026-12-01");
  const [error, setError] = useState("");

  function save() {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return setError("Choose an employee");
    onSave({
      id: `OB-${Date.now()}`,
      employee,
      type,
      stage: "Resigned",
      submittedAt: submitted,
      effectiveDate: effective,
      lastWorkingDay: lwd,
      checklist: ["Handover document", "Laptop & assets returned", "Access revoked", "Final settlement", "Experience letter issued"].map((label, k) => ({ label, done: false, owner: ["Manager", "IT", "IT", "Finance", "People"][k]! })),
    });
  }

  return (
    <Drawer
      title="Start off-boarding"
      subtitle="Creates the exit checklist and notifies IT, Finance and the manager"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={save}>Start off-boarding</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Employee" htmlFor="oe" error={error}>
          <select id="oe" className={selectCls} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee…</option>
            {employees.filter((e) => e.status !== "Inactive").map((e) => <option key={e.id} value={e.id}>{e.name} · {e.code}</option>)}
          </select>
        </Field>
        <Field label="Reason" htmlFor="ot">
          <select id="ot" className={selectCls} value={type} onChange={(e) => setType(e.target.value as Offboarding["type"])}>
            {["Resignation", "Termination", "Contract end", "Retirement"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Submitted" htmlFor="os"><Input id="os" type="date" value={submitted} onChange={(e) => setSubmitted(e.target.value)} /></Field>
          <Field label="Effective" htmlFor="oef"><Input id="oef" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} /></Field>
          <Field label="Last working day" htmlFor="ol"><Input id="ol" type="date" value={lwd} onChange={(e) => setLwd(e.target.value)} /></Field>
        </div>
      </div>
    </Drawer>
  );
}
