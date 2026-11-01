"use client";

import { ArrowRight, CalendarRange, Coffee, Users } from "lucide-react";
import { useState } from "react";
import { DataTable, Drawer, ModuleHeader, PersonCell, SearchBox, Segments, TableFooter, Toolbar, matches, selectCls, type Column } from "@/components/employees/module-kit";
import { Button, Card, Field, Input } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { shiftAssignments as seed, shifts, type Shift, type ShiftAssignment } from "@/lib/module-data";
import { cn, formatDate } from "@/lib/utils";

const toH = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3)) / 60;

/** Draws a shift on a 24h track; overnight shifts wrap to the start. */
function Track({ shift, className }: { shift: Shift; className?: string }) {
  const s = toH(shift.start);
  const e = toH(shift.end);
  const segs = e > s ? [[s, e]] : [[s, 24], [0, e]];
  return (
    <div className={cn("relative h-2.5 rounded-full bg-surface-3", className)}>
      {segs.map(([a, b]) => (
        <span key={a} className="absolute inset-y-0 rounded-full" style={{ left: `${(a! / 24) * 100}%`, width: `${((b! - a!) / 24) * 100}%`, background: shift.color }} />
      ))}
    </div>
  );
}

function ShiftChip({ shift }: { shift: Shift }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-[12px] font-medium text-ink">
      <span className="h-2 w-2 rounded-full" style={{ background: shift.color }} />
      {shift.name}
    </span>
  );
}

export function View() {
  const [rows, setRows] = useState(seed);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const list = rows.filter((r) => (filter === "all" || r.shift.id === filter) && matches(q, r.employee.name, r.employee.code, r.employee.department, r.division));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const columns: Column<ShiftAssignment>[] = [
    {
      key: "sel",
      header: <input type="checkbox" aria-label="Select all" className="h-4 w-4 accent-[var(--ink)]" checked={list.length > 0 && list.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(list.map((r) => r.id)) : new Set())} />,
      className: "w-10",
      cell: (r) => <input type="checkbox" aria-label={`Select ${r.employee.name}`} className="h-4 w-4 accent-[var(--ink)]" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />,
    },
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={r.employee.code} /> },
    { key: "dept", header: "Department", from: "lg", cell: (r) => <div className="text-[13px]"><div className="text-ink">{r.employee.department}</div><div className="text-ink-3">{r.division} division</div></div> },
    {
      key: "shift",
      header: "Shift",
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {r.previous && <><span className="text-[12px] text-ink-3 line-through">{r.previous.name}</span><ArrowRight className="h-3 w-3 text-ink-3" /></>}
          <ShiftChip shift={r.shift} />
        </div>
      ),
    },
    { key: "time", header: "Timing", from: "xl", cell: (r) => <div className="w-40"><Track shift={r.shift} /><div className="tabular mt-1 text-[12px] text-ink-3">{r.shift.start} – {r.shift.end}</div></div> },
    { key: "from", header: "Effective from", cell: (r) => <span className="tabular text-[13px] text-ink-2">{formatDate(r.effectiveFrom)}</span> },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Shift records"
        description="Who works when. Assign shifts in bulk and keep a history of every change."
        actions={<Button variant="primary" onClick={() => setAssigning(true)}><CalendarRange className="h-4 w-4" /> Assign shift</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {shifts.map((s) => {
          const count = rows.filter((r) => r.shift.id === s.id).length;
          return (
            <button key={s.id} onClick={() => setFilter(filter === s.id ? "all" : s.id)} className="text-left">
              <Card className={cn("p-4 transition hover:shadow-float", filter === s.id && "ring-2 ring-ink")}>
                <div className="flex items-center justify-between">
                  <ShiftChip shift={s} />
                  <span className="tabular inline-flex items-center gap-1 text-[13px] font-semibold text-ink"><Users className="h-3.5 w-3.5 text-ink-3" />{count}</span>
                </div>
                <div className="tabular mt-3 text-xl font-semibold tracking-tight text-ink">{s.start} – {s.end}</div>
                <Track shift={s} className="mt-3" />
                <div className="tabular mt-1.5 flex justify-between text-[10px] text-ink-3"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
                <div className="mt-2 inline-flex items-center gap-1 text-[12px] text-ink-3"><Coffee className="h-3.5 w-3.5" />{s.breakMins} min break</div>
              </Card>
            </button>
          );
        })}
      </div>

      <Toolbar>
        <Segments value={filter} onChange={setFilter} options={[{ value: "all", label: "All shifts", count: rows.length }, ...shifts.map((s) => ({ value: s.id, label: s.name, count: rows.filter((r) => r.shift.id === s.id).length }))]} />
        <SearchBox value={q} onChange={setQ} placeholder="Name, ID, department" />
      </Toolbar>

      <DataTable
        rows={list}
        columns={columns}
        footer={<TableFooter shown={list.length} total={rows.length} label="assignments" />}
        mobile={(r) => (
          <div className="flex items-center gap-3">
            <input type="checkbox" aria-label={`Select ${r.employee.name}`} className="h-4 w-4 accent-[var(--ink)]" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <PersonCell e={r.employee} sub={`${r.shift.start} – ${r.shift.end}`} size="sm" />
                <ShiftChip shift={r.shift} />
              </div>
            </div>
          </div>
        )}
      />

      {selected.size > 0 && !assigning && (
        <div className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md animate-rise items-center gap-3 rounded-2xl bg-[#15171c] p-2 pl-4 text-[#f2f2ee] shadow-pop md:bottom-6 dark:bg-surface-3">
          <span className="tabular text-sm font-medium">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-[13px] text-white/60 hover:text-white">Clear</button>
          <button onClick={() => setAssigning(true)} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#c8f169] px-3 text-[13px] font-semibold text-[#15171c]">
            <CalendarRange className="h-4 w-4" /> Change shift
          </button>
        </div>
      )}

      {assigning && (
        <AssignDrawer
          count={selected.size}
          onClose={() => setAssigning(false)}
          onSave={(shift, from) => {
            setRows((all) => all.map((r) => (selected.has(r.id) ? { ...r, previous: r.shift.id === shift.id ? r.previous : r.shift, shift, effectiveFrom: from } : r)));
            toast(`${selected.size} people moved to ${shift.name} shift`);
            setSelected(new Set());
            setAssigning(false);
          }}
        />
      )}
    </div>
  );
}

function AssignDrawer({ count, onClose, onSave }: { count: number; onClose: () => void; onSave: (s: Shift, from: string) => void }) {
  const [shiftId, setShiftId] = useState(shifts[0]!.id);
  const [from, setFrom] = useState("2026-11-03");
  const shift = shifts.find((s) => s.id === shiftId)!;
  return (
    <Drawer
      title="Assign shift"
      subtitle={count ? `Applies to ${count} selected people` : "Select people in the table first"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!count} onClick={() => onSave(shift, from)}>Assign</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {shifts.map((s) => (
            <button key={s.id} onClick={() => setShiftId(s.id)} aria-pressed={shiftId === s.id} className={cn("w-full rounded-xl border p-3 text-left transition", shiftId === s.id ? "border-ink ring-1 ring-ink" : "border-line hover:border-line-strong")}>
              <div className="flex items-center justify-between">
                <ShiftChip shift={s} />
                <span className="tabular text-[13px] font-medium text-ink">{s.start} – {s.end}</span>
              </div>
              <Track shift={s} className="mt-2.5" />
            </button>
          ))}
        </div>
        <Field label="Effective from" htmlFor="sf"><Input id="sf" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Notify" htmlFor="sn">
          <select id="sn" className={selectCls} defaultValue="both">
            <option value="both">Employees and their managers</option>
            <option value="emp">Employees only</option>
            <option value="none">Don&apos;t notify</option>
          </select>
        </Field>
      </div>
    </Drawer>
  );
}
