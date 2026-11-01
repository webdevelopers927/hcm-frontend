"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/* Smooth path through points using a Catmull-Rom → Bézier conversion. */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function Sparkline({ data, className, stroke = "var(--ink)" }: { data: number[]; className?: string; stroke?: string }) {
  const id = useId();
  const w = 100;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)] as [number, number]);
  const line = smoothPath(pts);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-24", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

type Series = { key: string; label: string; color: string };

/**
 * Responsive area/bar combo: headcount as a smooth area, hires/exits as
 * paired bars along the baseline. Hover reveals a crosshair + tooltip.
 */
export function HeadcountChart({ data }: { data: { m: string; hires: number; exits: number; total: number }[] }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 240;
  const pad = { t: 16, r: 8, b: 28, l: 32 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const minT = Math.floor((Math.min(...data.map((d) => d.total)) - 6) / 5) * 5;
  const maxT = Math.ceil((Math.max(...data.map((d) => d.total)) + 2) / 5) * 5;
  const x = (i: number) => pad.l + (i + 0.5) * (iw / data.length);
  const y = (v: number) => pad.t + ih - ((v - minT) / (maxT - minT)) * ih;
  const pts = data.map((d, i) => [x(i), y(d.total)] as [number, number]);
  const line = smoothPath(pts);
  const maxBar = Math.max(...data.map((d) => Math.max(d.hires, d.exits)));
  const barH = (v: number) => (v / maxBar) * ih * 0.32;
  const ticks = Array.from({ length: 4 }, (_, i) => minT + ((maxT - minT) / 3) * i);
  const series: Series[] = [
    { key: "total", label: "Headcount", color: "var(--ink)" },
    { key: "hires", label: "Hires", color: "var(--ok)" },
    { key: "exits", label: "Exits", color: "var(--bad)" },
  ];

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap gap-4 px-1 text-[12px] text-ink-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none" onMouseLeave={() => setHover(null)} role="img" aria-label="Headcount over the last 12 months">
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-3 text-[11px] tabular">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.m}>
            <rect x={x(i) - 7} y={pad.t + ih - barH(d.hires)} width={6} height={barH(d.hires)} rx={2} fill="var(--ok)" opacity={hover === null || hover === i ? 0.9 : 0.35} />
            <rect x={x(i) + 1} y={pad.t + ih - barH(d.exits)} width={6} height={barH(d.exits)} rx={2} fill="var(--bad)" opacity={hover === null || hover === i ? 0.75 : 0.3} />
            <text x={x(i)} y={H - 8} textAnchor="middle" className={cn("text-[11px]", hover === i ? "fill-ink font-semibold" : "fill-ink-3")}>
              {d.m}
            </text>
          </g>
        ))}
        <path d={`${line} L${x(data.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2.25" strokeLinecap="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--ink-3)" strokeDasharray="2 3" />
            <circle cx={x(hover)} cy={y(data[hover]!.total)} r={5} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2.5} />
          </g>
        )}
        {data.map((d, i) => (
          <rect key={d.m} x={pad.l + i * (iw / data.length)} y={0} width={iw / data.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-[132px] -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-[12px] shadow-float"
          style={{ left: `clamp(70px, ${(x(hover) / W) * 100}%, calc(100% - 70px))` }}
        >
          <div className="mb-1 font-semibold text-ink">{data[hover]!.m} 2026</div>
          <Row color="var(--ink)" label="Headcount" value={data[hover]!.total} />
          <Row color="var(--ok)" label="Hires" value={`+${data[hover]!.hires}`} />
          <Row color="var(--bad)" label="Exits" value={`−${data[hover]!.exits}`} />
        </div>
      )}
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-ink-2">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular font-medium text-ink">{value}</span>
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 12, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}
