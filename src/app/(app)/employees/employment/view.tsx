"use client";

import { Download, Info, Laptop } from "lucide-react";
import { useState } from "react";
import { DataTable, Drawer, FormSection, ModuleHeader, PersonCell, SearchBox, Segments, StatStrip, Switch, TableFooter, Toolbar, matches, type Column } from "@/components/employees/module-kit";
import { Badge, Button, Field, Input, ProgressBar } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { employees } from "@/lib/data";
import { employmentRecords, type EmploymentRecord } from "@/lib/module-data";
import { TODAY, daysUntil, formatDate } from "@/lib/utils";

type Filter = "all" | "probation" | "resigning" | "remote";

function probationState(r: EmploymentRecord) {
  const total = Math.max(1, daysUntil(r.probationEnd, r.probationStart));
  const left = daysUntil(r.probationEnd);
  return { left, pct: Math.min(100, Math.max(0, ((total - left) / total) * 100)), active: left > 0 && r.probationStart <= TODAY };
}

export function View() {
  const [rows, setRows] = useState(employmentRecords);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<EmploymentRecord | null>(null);

  const onProbation = rows.filter((r) => probationState(r).active);
  const resigning = rows.filter((r) => r.resignStatus !== "None");
  const remote = rows.filter((r) => r.remoteAccess);
  const endingSoon = onProbation.filter((r) => probationState(r).left <= 30);

  const list = rows
    .filter((r) => (filter === "probation" ? probationState(r).active : filter === "resigning" ? r.resignStatus !== "None" : filter === "remote" ? r.remoteAccess : true))
    .filter((r) => matches(q, r.employee.name, r.employee.code, r.employee.machineUid));

  const columns: Column<EmploymentRecord>[] = [
    { key: "emp", header: "Employee", cell: (r) => <PersonCell e={r.employee} sub={`${r.employee.code} · UID ${r.employee.machineUid}`} /> },
    {
      key: "prob",
      header: "Probation",
      cell: (r) => {
        const p = probationState(r);
        return p.active ? (
          <div className="w-40">
            <div className="mb-1 flex justify-between text-[12px]">
              <span className="font-medium text-ink">{r.probationMonths} months</span>
              <span className={p.left <= 30 ? "font-semibold text-warn" : "text-ink-3"}>{p.left}d left</span>
            </div>
            <ProgressBar value={p.pct} tone={p.left <= 30 ? "warn" : "ink"} />
          </div>
        ) : (
          <span className="text-[13px] text-ink-3">Completed {formatDate(r.probationEnd, { month: "short", year: "numeric" })}</span>
        );
      },
    },
    {
      key: "contract",
      header: "Contract",
      from: "lg",
      cell: (r) => (
        <span className="tabular text-[13px] text-ink-2">
          {formatDate(r.contractFrom, { month: "short", year: "numeric" })} → {r.contractTo ? formatDate(r.contractTo, { month: "short", year: "numeric" }) : "Open-ended"}
        </span>
      ),
    },
    { key: "rep", header: "Reports to", from: "xl", cell: (r) => <span className="text-[13px] text-ink-2">{r.reportsTo?.name ?? "—"}</span> },
    { key: "remote", header: "Remote", cell: (r) => (r.remoteAccess ? <Badge tone="info"><Laptop className="h-3 w-3" /> Allowed</Badge> : <span className="text-[13px] text-ink-3">—</span>) },
    {
      key: "resign",
      header: "Resignation",
      cell: (r) =>
        r.resignStatus === "None" ? (
          <span className="text-[13px] text-ink-3">—</span>
        ) : (
          <div>
            <Badge tone={r.resignStatus === "Accepted" ? "violet" : "warn"} dot>{r.resignStatus}</Badge>
            {r.lastWorkingDay && <div className="tabular mt-1 text-[12px] text-ink-3">LWD {formatDate(r.lastWorkingDay, { day: "numeric", month: "short" })}</div>}
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Employment"
        description="Probation, contract dates, reporting lines, remote access and resignations — one row per person."
        actions={<Button variant="secondary"><Download className="h-4 w-4" /> Export</Button>}
      />
      <StatStrip
        items={[
          { label: "On probation", value: onProbation.length, hint: `${endingSoon.length} ending in 30 days`, tone: "info" },
          { label: "Ending soon", value: endingSoon.length, hint: "Evaluation needed", tone: "warn" },
          { label: "Resignations", value: resigning.length, hint: "Submitted or accepted", tone: "violet" },
          { label: "Remote access", value: remote.length, hint: "Hybrid & remote", tone: "ok" },
        ]}
      />
      <Toolbar>
        <Segments
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "probation", label: "On probation", count: onProbation.length },
            { value: "resigning", label: "Resigning", count: resigning.length },
            { value: "remote", label: "Remote access", count: remote.length },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Name, ID or machine UID" />
      </Toolbar>
      <DataTable
        rows={list}
        columns={columns}
        onRowClick={setEditing}
        footer={<TableFooter shown={list.length} total={rows.length} />}
        mobile={(r) => {
          const p = probationState(r);
          return (
            <div className="space-y-2.5">
              <PersonCell e={r.employee} sub={r.employee.designation} />
              <div className="flex flex-wrap gap-1.5">
                {p.active && <Badge tone={p.left <= 30 ? "warn" : "info"}>Probation · {p.left}d left</Badge>}
                {r.remoteAccess && <Badge tone="info">Remote</Badge>}
                {r.resignStatus !== "None" && <Badge tone="violet">Resign {r.resignStatus.toLowerCase()}</Badge>}
              </div>
            </div>
          );
        }}
      />
      {editing && (
        <EmploymentDrawer
          record={editing}
          onClose={() => setEditing(null)}
          onSave={(r) => {
            setRows((all) => all.map((x) => (x.id === r.id ? r : x)));
            setEditing(null);
            toast(`Employment updated for ${r.employee.name}`);
          }}
        />
      )}
    </div>
  );
}

function EmploymentDrawer({ record, onClose, onSave }: { record: EmploymentRecord; onClose: () => void; onSave: (r: EmploymentRecord) => void }) {
  const [r, setR] = useState(record);
  const set = <K extends keyof EmploymentRecord>(k: K, v: EmploymentRecord[K]) => setR((x) => ({ ...x, [k]: v }));
  return (
    <Drawer
      wide
      title={`Edit employment`}
      subtitle={`${r.employee.name} · ${r.employee.code}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onSave(r)}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-6">
        <FormSection title="Probation">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Duration" htmlFor="pd">
              <Select inputId="pd" value={String(r.probationMonths)} onChange={(v) => set("probationMonths", Number(v))} options={[1, 2, 3, 6].map((m) => ({ value: String(m), label: `${m} months` }))} />
            </Field>
            <Field label="Start date" htmlFor="ps"><Input id="ps" type="date" value={r.probationStart} onChange={(e) => set("probationStart", e.target.value)} /></Field>
            <Field label="End date" htmlFor="pe"><Input id="pe" type="date" value={r.probationEnd} onChange={(e) => set("probationEnd", e.target.value)} /></Field>
          </div>
        </FormSection>

        <FormSection title="Contract & reporting">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contract from" htmlFor="cf"><Input id="cf" type="date" value={r.contractFrom} onChange={(e) => set("contractFrom", e.target.value)} /></Field>
            <Field label="Contract to" htmlFor="ctt" hint={<span className="text-[12px] text-ink-3">Blank = open-ended</span>}>
              <Input id="ctt" type="date" value={r.contractTo ?? ""} onChange={(e) => set("contractTo", e.target.value || null)} />
            </Field>
            <Field label="Team reporting" htmlFor="tr" className="sm:col-span-2">
              <Select inputId="tr" value={r.reportsTo?.id ?? ""} onChange={(v) => set("reportsTo", employees.find((x) => x.id === v) ?? null)} clearable placeholder="No manager" options={employees.slice(0, 12).map((m) => ({ value: m.id, label: `${m.name} — ${m.designation}` }))} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Remote access" action={<Switch checked={r.remoteAccess} onChange={(v) => set("remoteAccess", v)} label="Remote access" />}>
          {r.remoteAccess ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Allowed from" htmlFor="rf"><Input id="rf" type="date" value={r.remoteFrom ?? ""} onChange={(e) => set("remoteFrom", e.target.value)} /></Field>
              <Field label="Allowed till" htmlFor="rt"><Input id="rt" type="date" value={r.remoteTill ?? ""} onChange={(e) => set("remoteTill", e.target.value)} /></Field>
            </div>
          ) : (
            <p className="text-[13px] text-ink-3">Employee can only clock in from office locations.</p>
          )}
        </FormSection>

        <FormSection title="Resignation">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Status" htmlFor="rs">
              <Select inputId="rs" value={r.resignStatus} onChange={(v) => set("resignStatus", v as EmploymentRecord["resignStatus"])} options={["None", "Submitted", "Accepted"].map((s) => ({ value: s, label: s }))} />
            </Field>
            {r.resignStatus !== "None" && (
              <>
                <Field label="Submitted on" htmlFor="rsd"><Input id="rsd" type="date" value={r.resignDate ?? ""} onChange={(e) => set("resignDate", e.target.value)} /></Field>
                <Field label="Last working day" htmlFor="lwd"><Input id="lwd" type="date" value={r.lastWorkingDay ?? ""} onChange={(e) => set("lastWorkingDay", e.target.value)} /></Field>
              </>
            )}
          </div>
        </FormSection>

        <p className="flex gap-2 rounded-xl bg-info-soft p-3 text-[13px] text-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" /> Date changes apply from the dates you set, not from today.
        </p>
      </div>
    </Drawer>
  );
}

