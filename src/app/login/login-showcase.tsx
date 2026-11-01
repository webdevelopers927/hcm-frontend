"use client";

import { CalendarCheck2, Check, Fingerprint, TrendingUp } from "lucide-react";
import { useNow } from "@/hooks/use-now";

/*
 * Right-hand marketing panel on the sign-in page. Deliberately always dark
 * (it does not follow the theme) so it reads as a product stage.
 */
export function LoginShowcase() {
  return (
    <aside className="relative hidden overflow-hidden bg-[#121318] text-[#f2f2ee] lg:block">
      {/* dotted grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(rgb(255 255 255 / 0.12) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at 60% 40%, black 30%, transparent 75%)",
        }}
      />
      <div className="absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-[#c8f169] opacity-[0.13] blur-[120px]" />

      <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
        <div className="max-w-lg">
          <p className="text-[13px] font-medium tracking-[0.18em] text-[#c8f169] uppercase">Human capital, re-thought</p>
          <h2 className="mt-5 font-display text-[54px] leading-[1.02] tracking-tight xl:text-[64px]">
            Every person, every shift, <span className="italic text-[#c8f169]">one calm place.</span>
          </h2>
        </div>

        <div className="relative mx-auto my-10 h-[360px] w-full max-w-[520px]">
          <ClockCard />
          <ApprovalCard />
          <AttendanceCard />
        </div>

        <div className="grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
          {[
            ["2 min", "average leave approval"],
            ["99.9%", "payroll accuracy"],
            ["0", "spreadsheets needed"],
          ].map(([k, v]) => (
            <div key={v}>
              <div className="font-display text-4xl">{k}</div>
              <div className="mt-1 text-[13px] text-white/55">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function ClockCard() {
  const now = useNow();
  const time = now ? new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--";
  return (
    <div className="absolute top-0 left-0 w-[290px] animate-rise rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl" style={{ animationDelay: "120ms" }}>
      <div className="flex items-center justify-between text-[12px] text-white/55">
        <span>Morning shift</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c8f169]/15 px-2 py-0.5 text-[#c8f169]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c8f169]" /> Live
        </span>
      </div>
      <div className="tabular mt-3 font-mono text-[40px] leading-none font-medium tracking-tight">{time}</div>
      <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#c8f169] py-3 text-sm font-semibold text-[#15171c]">
        <Fingerprint className="h-4 w-4" /> Clock in
      </button>
    </div>
  );
}

function ApprovalCard() {
  return (
    <div className="absolute top-[150px] right-0 w-[280px] animate-rise rounded-3xl border border-white/10 bg-[#f7f7f2] p-4 text-[#15171c] shadow-2xl" style={{ animationDelay: "260ms" }}>
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1f8a5b] text-white">
          <Check className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Leave approved</div>
          <div className="truncate text-[12px] text-[#474a52]">Ayesha Khan · 10–14 Nov · Annual</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#eeede6] px-3 py-2 text-[12px] text-[#474a52]">
        <CalendarCheck2 className="h-3.5 w-3.5" /> Team calendar updated automatically
      </div>
    </div>
  );
}

function AttendanceCard() {
  const pct = 92;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="absolute bottom-0 left-12 flex w-[300px] animate-rise items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl" style={{ animationDelay: "400ms" }}>
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#c8f169" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div>
        <div className="text-[12px] text-white/55">Present today</div>
        <div className="tabular font-display text-4xl">{pct}%</div>
        <div className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-[#c8f169]">
          <TrendingUp className="h-3.5 w-3.5" /> 3.1% vs last week
        </div>
      </div>
    </div>
  );
}
