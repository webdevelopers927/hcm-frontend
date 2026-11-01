import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { cn, initials } from "@/lib/utils";
import type { EmployeeStatus, WorkMode } from "@/lib/data";

/* ---------- Button ---------- */

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:opacity-90 shadow-soft",
  accent: "bg-accent text-accent-ink hover:brightness-95 shadow-soft",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong shadow-soft",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "bg-bad text-white hover:opacity-90",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-xl justify-center",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ className, variant = "secondary", size = "md", ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center font-medium whitespace-nowrap transition-all outline-none select-none",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
});

/* ---------- Card ---------- */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-soft", className)} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Avatar ---------- */

const avatarSizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 text-lg",
  xl: "h-24 w-24 text-3xl",
};

export function Avatar({
  name,
  hue,
  size = "md",
  ring,
  src,
  className,
}: {
  name: string;
  hue: number;
  size?: keyof typeof avatarSizes;
  ring?: boolean;
  src?: string | null;
  className?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar host isn't known yet, so next/image can't be configured
      <img src={src} alt="" className={cn("shrink-0 rounded-full object-cover", ring && "ring-2 ring-surface", avatarSizes[size], className)} />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight text-white",
        ring && "ring-2 ring-surface",
        avatarSizes[size],
        className,
      )}
      style={{
        background: `linear-gradient(140deg, oklch(0.72 0.13 ${hue}) 0%, oklch(0.5 0.14 ${(hue + 40) % 360}) 100%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = "sm" }: { people: { name: string; hue: number }[]; max?: number; size?: "xs" | "sm" }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex -space-x-2">
      {shown.map((p) => (
        <Avatar key={p.name} name={p.name} hue={p.hue} size={size} ring />
      ))}
      {rest > 0 && (
        <span className={cn("inline-flex items-center justify-center rounded-full bg-surface-3 font-semibold text-ink-2 ring-2 ring-surface", size === "xs" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-[11px]")}>
          +{rest}
        </span>
      )}
    </div>
  );
}

/* ---------- Badges ---------- */

type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "violet" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  violet: "bg-violet-soft text-violet",
  accent: "bg-accent-soft text-ink",
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const statusTone: Record<EmployeeStatus, Tone> = {
  Active: "ok",
  Probation: "info",
  "On leave": "warn",
  "Notice period": "violet",
  Inactive: "neutral",
};

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <Badge tone={statusTone[status]} dot>
      {status}
    </Badge>
  );
}

const modeTone: Record<WorkMode, Tone> = { Onsite: "neutral", Hybrid: "accent", Remote: "info" };

export function ModeBadge({ mode }: { mode: WorkMode }) {
  return <Badge tone={modeTone[mode]}>{mode}</Badge>;
}

/* ---------- Form fields ---------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 outline-none transition sm:text-sm",
        "focus:border-ink focus:ring-4 focus:ring-accent/40",
        invalid ? "border-bad focus:border-bad focus:ring-bad/15" : "border-line hover:border-line-strong",
        className,
      )}
      {...props}
    />
  );
});

export function Field({ label, hint, error, htmlFor, children, className }: { label: string; hint?: ReactNode; error?: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {hint}
      </div>
      {children}
      {error && (
        <p role="alert" className="text-[12px] font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-3">{children}</kbd>;
}

export function ProgressBar({ value, tone = "ink", className }: { value: number; tone?: "ink" | "ok" | "warn" | "bad" | "accent"; className?: string }) {
  const color = { ink: "bg-ink", ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", accent: "bg-accent" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
