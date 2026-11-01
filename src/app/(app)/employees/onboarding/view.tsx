"use client";

import { ArrowRight, CalendarDays, Check, FileCheck2, Mail, Phone, UserPlus } from "lucide-react";
import { useState } from "react";
import { DetailList, Drawer, FormSection, ModuleHeader, SearchBox, Segments, StatStrip, Toolbar, matches } from "@/components/employees/module-kit";
import { Avatar, Badge, Button, Card, ProgressBar } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { hiredCandidates as seed, type HiredCandidate } from "@/lib/module-data";
import { cn, daysUntil, formatDate } from "@/lib/utils";

const STEPS: HiredCandidate["status"][] = ["Offer accepted", "Documents pending", "Ready to onboard", "Converted"];
const REQUIRED_DOCS = ["CNIC copy", "Degree", "Experience letter", "Bank details", "Signed contract"];
const tone = { "Offer accepted": "info", "Documents pending": "warn", "Ready to onboard": "accent", Converted: "ok" } as const;

export function View() {
  const [rows, setRows] = useState(seed);
  const [filter, setFilter] = useState<HiredCandidate["status"] | "all">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  const n = (s: HiredCandidate["status"]) => rows.filter((r) => r.status === s).length;
  const list = rows.filter((r) => (filter === "all" || r.status === filter) && matches(q, r.name, r.designation, r.department, r.email));
  const patch = (id: string, p: Partial<HiredCandidate>) => setRows((all) => all.map((r) => (r.id === id ? { ...r, ...p } : r)));

  function convert(c: HiredCandidate) {
    patch(c.id, { status: "Converted" });
    toast(`${c.name} is now an employee — welcome email sent`);
  }

  return (
    <div className="space-y-5">
      <ModuleHeader title="Hired candidates" description="People who accepted an offer. Collect their documents, then convert them into employees in one click." />
      <StatStrip
        items={[
          { label: "Offer accepted", value: n("Offer accepted"), hint: "Just signed", tone: "info" },
          { label: "Documents pending", value: n("Documents pending"), hint: "Chase before joining", tone: "warn" },
          { label: "Ready to onboard", value: n("Ready to onboard"), hint: "Convert to employee", tone: "ok" },
          { label: "Joining ≤ 14 days", value: rows.filter((r) => r.status !== "Converted" && daysUntil(r.joiningDate) <= 14).length, hint: "Prepare laptops & access", tone: "violet" },
        ]}
      />
      <Toolbar>
        <Segments value={filter} onChange={setFilter} options={[{ value: "all", label: "All", count: rows.length }, ...STEPS.map((s) => ({ value: s, label: s, count: n(s) }))]} />
        <SearchBox value={q} onChange={setQ} placeholder="Name, role or email" />
      </Toolbar>

      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {list.map((c) => {
          const step = STEPS.indexOf(c.status);
          const days = daysUntil(c.joiningDate);
          return (
            <li key={c.id}>
              <Card className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => setOpenId(c.id)} className="flex min-w-0 items-center gap-3 text-left">
                    <Avatar name={c.name} hue={c.hue} size="lg" />
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold text-ink hover:underline">{c.name}</div>
                      <div className="truncate text-[13px] text-ink-2">{c.designation}</div>
                      <div className="text-[12px] text-ink-3">{c.department}</div>
                    </div>
                  </button>
                  <Badge tone={tone[c.status]}>{c.status}</Badge>
                </div>

                <div className="mt-4 flex gap-1">
                  {STEPS.map((s, i) => <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-ink" : "bg-surface-3")} />)}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                  <div>
                    <div className="text-ink-3">Joining</div>
                    <div className="tabular font-medium text-ink">{formatDate(c.joiningDate, { day: "numeric", month: "short" })}{c.status !== "Converted" && <span className={days <= 7 ? " text-warn" : " text-ink-3"}> · {days}d</span>}</div>
                  </div>
                  <div>
                    <div className="text-ink-3">Documents</div>
                    <div className="tabular font-medium text-ink">{c.docs}/{REQUIRED_DOCS.length}</div>
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  {c.status === "Ready to onboard" ? (
                    <Button variant="primary" className="w-full justify-center" onClick={() => convert(c)}><UserPlus className="h-4 w-4" /> Convert to employee</Button>
                  ) : c.status === "Converted" ? (
                    <div className="flex h-10 items-center justify-center gap-2 rounded-xl bg-ok-soft text-[13px] font-medium text-ok"><Check className="h-4 w-4" /> Added to directory</div>
                  ) : (
                    <Button variant="secondary" className="w-full justify-center" onClick={() => setOpenId(c.id)}>Review documents <ArrowRight className="h-4 w-4" /></Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <Card className="px-6 py-14 text-center text-sm text-ink-3">No candidates in this stage.</Card>}

      {open && (
        <Drawer
          title={open.name}
          subtitle={`${open.designation} · ${open.department}`}
          onClose={() => setOpenId(null)}
          footer={
            open.status === "Converted" ? undefined : (
              <>
                <Button variant="secondary" onClick={() => toast(`Reminder sent to ${open.email}`, "info")}>Remind</Button>
                <Button variant="primary" disabled={open.docs < REQUIRED_DOCS.length} onClick={() => { convert(open); setOpenId(null); }}>
                  <UserPlus className="h-4 w-4" /> Convert
                </Button>
              </>
            )
          }
        >
          <div className="space-y-6">
            <FormSection title={`Documents · ${open.docs}/${REQUIRED_DOCS.length}`}>
              <ProgressBar value={(open.docs / REQUIRED_DOCS.length) * 100} tone={open.docs === REQUIRED_DOCS.length ? "ok" : "warn"} className="mb-3" />
              <ul className="space-y-2">
                {REQUIRED_DOCS.map((d, i) => {
                  const done = i < open.docs;
                  return (
                    <li key={d}>
                      <button
                        onClick={() => {
                          const docs = done ? i : i + 1;
                          patch(open.id, { docs, status: open.status === "Converted" ? "Converted" : docs === REQUIRED_DOCS.length ? "Ready to onboard" : docs > 0 ? "Documents pending" : "Offer accepted" });
                        }}
                        className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm", done ? "border-transparent bg-ok-soft" : "border-line hover:border-line-strong")}
                      >
                        <FileCheck2 className={cn("h-4 w-4", done ? "text-ok" : "text-ink-3")} />
                        <span className={cn("flex-1", done ? "text-ink-2" : "font-medium text-ink")}>{d}</span>
                        <span className="text-[12px] text-ink-3">{done ? "Received" : "Mark received"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </FormSection>
            <FormSection title="Details">
              <DetailList
                rows={[
                  ["Email", <span key="e" className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-ink-3" />{open.email}</span>],
                  ["Phone", <span key="p" className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-ink-3" />{open.phone}</span>],
                  ["Offer accepted", formatDate(open.offerAccepted)],
                  ["Joining date", <span key="j" className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-ink-3" />{formatDate(open.joiningDate)}</span>],
                ]}
              />
            </FormSection>
          </div>
        </Drawer>
      )}
    </div>
  );
}
