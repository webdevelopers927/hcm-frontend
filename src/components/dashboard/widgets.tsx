"use client";

import { ArrowUpRight, Cake, Check, Coffee, Fingerprint, LogOut, Megaphone, PartyPopper, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/hooks/use-now";
import { useSession } from "@/components/session/session-provider";
import { HeadcountChart, Ring, Sparkline } from "@/components/charts/charts";
import { Avatar, AvatarStack, Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import {
  announcements,
  attendanceToday,
  departmentBreakdown,
  getEmployee,
  headcountTrend,
  leaveRequests,
  onBreakNow,
  onLeaveToday,
  openRoles,
  upcomingCelebrations,
  type LeaveRequest,
} from "@/lib/data";
import { cn, formatDate } from "@/lib/utils";

/* ---------------- Greeting ---------------- */

export function Greeting() {
  const ts = useNow();
  const now = ts ? new Date(ts) : null;
  const hour = now?.getHours() ?? 9;
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const { user } = useSession();
  const first = user?.name.split(" ")[0] ?? "";
  return (
    <div className="flex flex-col justify-between gap-6 py-1 sm:flex-row sm:items-end lg:py-3">
      <div>
        <p className="text-[13px] font-medium text-ink-3">
          {now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : " "}
        </p>
        <h1 className="mt-1.5 font-display text-[40px] leading-[1.02] tracking-tight text-ink sm:text-[52px]">
          Good {part}, <span className="italic">{first}.</span>
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-ink-2">
          <span className="font-semibold text-ink">4 approvals</span> need you today, and{" "}
          <span className="font-semibold text-ink">3 people</span> are celebrating something this week.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary">
          <Megaphone className="h-4 w-4" /> Announce
        </Button>
        <Link href="/employees/new">
          <Button variant="primary">
            <Plus className="h-4 w-4" /> Add employee
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ---------------- Clock in ---------------- */

type ClockState = "out" | "in" | "break";

export function ClockCard() {
  const [state, setState] = useState<ClockState>("out");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const now = useNow() ?? 0;

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const clock = now ? new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const shiftPct = Math.min(100, (elapsed / (9 * 3600)) * 100);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#15171c] p-5 text-[#f2f2ee] shadow-float dark:bg-surface-3 sm:p-6">
      <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-[#c8f169] opacity-20 blur-3xl" />
      <div className="relative flex items-center justify-between text-[12px] text-white/60">
        <span>Morning shift · 09:00 – 18:00</span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium",
            state === "in" && "bg-[#c8f169]/15 text-[#c8f169]",
            state === "break" && "bg-amber-400/15 text-amber-300",
            state === "out" && "bg-white/10 text-white/70",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full bg-current", state !== "out" && "animate-pulse")} />
          {state === "in" ? "Working" : state === "break" ? "On break" : "Not clocked in"}
        </span>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-4">
        <div>
          <div className="text-[12px] text-white/50">{state === "out" ? "Local time" : "Time worked"}</div>
          <div className="tabular mt-1 font-mono text-[44px] leading-none font-medium tracking-tight">
            {state === "out" ? clock : `${hh}:${mm}`}
            {state !== "out" && <span className="text-2xl text-white/40">:{ss}</span>}
          </div>
        </div>
        <Fingerprint className="h-10 w-10 text-white/15" />
      </div>

      <div className="relative mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#c8f169] transition-all duration-1000" style={{ width: `${shiftPct}%` }} />
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-2">
        {state === "out" ? (
          <button
            onClick={() => {
              setStartedAt(Date.now());
              setState("in");
            }}
            className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#c8f169] text-sm font-semibold text-[#15171c] transition hover:brightness-95 active:scale-[0.99]"
          >
            <Fingerprint className="h-4 w-4" /> Clock in
          </button>
        ) : (
          <>
            <button
              onClick={() => setState((s) => (s === "break" ? "in" : "break"))}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-medium transition hover:bg-white/15"
            >
              <Coffee className="h-4 w-4" /> {state === "break" ? "Resume" : "Break"}
            </button>
            <button
              onClick={() => {
                setStartedAt(null);
                setState("out");
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-[#15171c] transition hover:bg-white/90"
            >
              <LogOut className="h-4 w-4" /> Clock out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- KPIs ---------------- */

const kpis = [
  { label: "Headcount", value: "64", delta: "+2", note: "vs last month", up: true, spark: headcountTrend.map((d) => d.total) },
  { label: "Present today", value: "50", delta: "92%", note: "attendance rate", up: true, spark: [88, 91, 93, 90, 94, 96, 92] },
  { label: "Open roles", value: "7", delta: "101", note: "active applicants", up: true, spark: [3, 4, 4, 6, 5, 7, 7] },
  { label: "Attrition (YTD)", value: "4.8%", delta: "−1.2pt", note: "vs last year", up: true, spark: [7, 6.5, 6.1, 5.8, 5.5, 5.1, 4.8] },
];

export function KpiRow() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {kpis.map((k, i) => (
        <Card key={k.label} className="animate-rise p-4 sm:p-5" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="flex items-start justify-between gap-2">
            <span className="text-[13px] font-medium text-ink-2">{k.label}</span>
            <Sparkline data={k.spark} className="hidden h-7 w-16 sm:block" />
          </div>
          <div className="tabular mt-3 text-[30px] leading-none font-semibold tracking-tight text-ink sm:text-[34px]">{k.value}</div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
            <span className={cn("tabular rounded-md px-1.5 py-0.5 font-semibold", k.up ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad")}>{k.delta}</span>
            <span className="text-ink-3">{k.note}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Headcount ---------------- */

export function HeadcountCard() {
  const [range, setRange] = useState<"6m" | "12m">("12m");
  const data = range === "12m" ? headcountTrend : headcountTrend.slice(-6);
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Workforce growth"
        subtitle="Headcount, hires and exits"
        action={
          <div className="flex rounded-lg border border-line bg-surface-2 p-0.5 text-[12px] font-medium">
            {(["6m", "12m"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cn("rounded-md px-2.5 py-1 transition", range === r ? "bg-surface text-ink shadow-soft" : "text-ink-3 hover:text-ink")}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        }
      />
      <div className="px-3 pt-4 pb-3 sm:px-5">
        <HeadcountChart data={data} />
      </div>
    </Card>
  );
}

/* ---------------- Attendance ---------------- */

export function AttendanceCard() {
  const a = attendanceToday;
  const total = Object.values(a).reduce((s, v) => s + v, 0);
  const present = a.onTime + a.late + a.halfDay;
  const rows = [
    { label: "On time", value: a.onTime, color: "var(--ok)" },
    { label: "Late", value: a.late, color: "var(--warn)" },
    { label: "Half day", value: a.halfDay, color: "var(--info)" },
    { label: "On leave", value: a.onLeave, color: "var(--violet)" },
    { label: "Absent", value: a.absent, color: "var(--bad)" },
    { label: "Not in yet", value: a.notIn, color: "var(--line-strong)" },
  ];
  return (
    <Card className="flex flex-col">
      <CardHeader title="Today’s attendance" subtitle={`${present} of ${total} present`} action={<Badge tone="ok" dot>Live</Badge>} />
      <div className="flex items-center justify-center py-5">
        <Ring value={Math.round((present / total) * 100)} size={148} stroke={14}>
          <div className="tabular text-[34px] leading-none font-semibold tracking-tight text-ink">{Math.round((present / total) * 100)}%</div>
          <div className="mt-1 text-[12px] text-ink-3">present</div>
        </Ring>
      </div>
      <div className="mx-5 flex h-2 overflow-hidden rounded-full">
        {rows.map((r) => (
          <div key={r.label} style={{ width: `${(r.value / total) * 100}%`, background: r.color }} title={`${r.label}: ${r.value}`} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 pt-4 pb-5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between text-[13px]">
            <span className="inline-flex items-center gap-2 text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
              {r.label}
            </span>
            <span className="tabular font-semibold text-ink">{r.value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Approvals ---------------- */

const leaveTone: Record<LeaveRequest["type"], "info" | "bad" | "warn" | "violet"> = {
  Annual: "info",
  Sick: "bad",
  Casual: "warn",
  WFH: "violet",
};

export function ApprovalsCard() {
  const [decided, setDecided] = useState<Record<string, "approved" | "declined">>({});
  const pending = leaveRequests.filter((r) => !decided[r.id]).length;
  return (
    <Card className="flex flex-col">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            Needs your approval
            {pending > 0 && <span className="tabular rounded-md bg-accent px-1.5 text-[12px] font-semibold text-accent-ink">{pending}</span>}
          </span>
        }
        subtitle="Time off and remote requests"
        action={
          <button className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink">
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        }
      />
      <ul className="mt-3 divide-y divide-line">
        {leaveRequests.map((r) => {
          const e = getEmployee(r.employeeId)!;
          const d = decided[r.id];
          return (
            <li key={r.id} className={cn("flex flex-col gap-3 px-5 py-4 transition sm:flex-row sm:items-center", d && "opacity-60")}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={e.name} hue={e.hue} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/employees/${e.id}`} className="truncate text-sm font-semibold text-ink hover:underline">
                      {e.name}
                    </Link>
                    <Badge tone={leaveTone[r.type]}>{r.type}</Badge>
                  </div>
                  <div className="mt-0.5 truncate text-[13px] text-ink-3">
                    <span className="tabular font-medium text-ink-2">
                      {formatDate(r.from, { day: "numeric", month: "short" })}
                      {r.days > 1 && ` – ${formatDate(r.to, { day: "numeric", month: "short" })}`}
                    </span>{" "}
                    · {r.days}d · {r.reason}
                  </div>
                </div>
              </div>
              {d ? (
                <Badge tone={d === "approved" ? "ok" : "neutral"} className="self-start sm:self-center">
                  {d === "approved" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {d === "approved" ? "Approved" : "Declined"}
                </Badge>
              ) : (
                <div className="flex gap-2 pl-[52px] sm:pl-0">
                  <Button size="sm" variant="secondary" onClick={() => setDecided((s) => ({ ...s, [r.id]: "declined" }))}>
                    Decline
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => setDecided((s) => ({ ...s, [r.id]: "approved" }))}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------- Who's away ---------------- */

export function AwayCard() {
  const leave = onLeaveToday();
  const breaks = onBreakNow();
  return (
    <Card className="flex flex-col">
      <CardHeader title="Who’s away" subtitle="Out today and on break right now" />
      <div className="px-5 pt-4">
        <div className="flex items-center justify-between rounded-xl bg-surface-2 p-3">
          <div>
            <div className="text-[13px] font-medium text-ink">On leave today</div>
            <div className="text-[12px] text-ink-3">{leave.length} people</div>
          </div>
          <AvatarStack people={leave} max={5} />
        </div>
      </div>
      <div className="px-5 pt-5 pb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">On break</div>
      <ul className="px-2 pb-3">
        {breaks.map(({ employee: e, minutes }) => (
          <li key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
            <Avatar name={e.name} hue={e.hue} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink">{e.name}</div>
              <div className="truncate text-[12px] text-ink-3">{e.department}</div>
            </div>
            <span className={cn("tabular inline-flex items-center gap-1 text-[12px] font-medium", minutes > 20 ? "text-warn" : "text-ink-2")}>
              <Coffee className="h-3.5 w-3.5" /> {minutes}m
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Departments ---------------- */

export function DepartmentsCard() {
  const rows = departmentBreakdown();
  const max = rows[0]?.count ?? 1;
  return (
    <Card>
      <CardHeader title="Teams" subtitle={`${rows.length} departments`} />
      <ul className="space-y-3 px-5 pt-4 pb-5">
        {rows.map((r) => (
          <li key={r.dept}>
            <Link href={`/employees?dept=${encodeURIComponent(r.dept)}`} className="group block">
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink-2 group-hover:text-ink">{r.dept}</span>
                <span className="tabular font-semibold text-ink">{r.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-ink transition-all group-hover:bg-accent" style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Hiring ---------------- */

export function HiringCard() {
  const stages = ["Applied", "Screen", "Interview", "Offer"];
  return (
    <Card>
      <CardHeader title="Hiring pipeline" subtitle="Top open roles" action={<Badge tone="accent">7 open</Badge>} />
      <ul className="space-y-4 px-5 pt-4 pb-5">
        {openRoles.map((r) => (
          <li key={r.title}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0 truncate text-[13px] font-semibold text-ink">{r.title}</div>
              <div className="shrink-0 text-[12px] text-ink-3">{r.dept}</div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {r.stage.map((n, i) => (
                <div key={stages[i]} className="text-center">
                  <div
                    className="tabular flex h-8 items-center justify-center rounded-md text-[12px] font-semibold"
                    style={{
                      background: `color-mix(in oklab, var(--accent) ${100 - i * 22}%, var(--surface-3))`,
                      color: "var(--accent-ink)",
                    }}
                  >
                    {n}
                  </div>
                  <div className="mt-1 text-[10px] text-ink-3">{stages[i]}</div>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Celebrations + news ---------------- */

export function MomentsCard() {
  const items = upcomingCelebrations();
  return (
    <Card>
      <CardHeader title="Moments" subtitle="Birthdays, anniversaries & news" />
      <ul className="px-2 pt-3">
        {items.map((c) => (
          <li key={c.employee.id + c.kind} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
            <Avatar name={c.employee.name} hue={c.employee.hue} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink">{c.employee.name}</div>
              <div className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                {c.kind === "Birthday" ? <Cake className="h-3.5 w-3.5" /> : <PartyPopper className="h-3.5 w-3.5" />}
                {c.kind === "Birthday" ? "Birthday" : `${"years" in c ? c.years : ""} yr work anniversary`}
              </div>
            </div>
            <span className={cn("text-[12px] font-medium", c.when === "Today" ? "rounded-md bg-accent px-1.5 py-0.5 text-accent-ink" : "text-ink-3")}>{c.when}</span>
          </li>
        ))}
      </ul>
      <div className="mx-5 my-3 h-px bg-line" />
      <ul className="space-y-3 px-5 pb-5">
        {announcements.map((a) => (
          <li key={a.id} className="flex gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-ink" />
            <div className="min-w-0">
              <div className="text-[13px] leading-snug font-medium text-ink">{a.title}</div>
              <div className="mt-0.5 text-[12px] text-ink-3">{a.meta}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
