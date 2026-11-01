"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-ink" />
      <path d="M9 22V10h3.2v5.1L17 10h3.9l-5.3 5.6L21.4 22h-4l-3.9-4.6-1.3 1.3V22z" className="fill-canvas" />
      <circle cx="23.5" cy="9.5" r="2.5" fill="var(--accent)" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && <span className="text-[17px] font-semibold tracking-tight text-ink">{BRAND.name}</span>}
    </span>
  );
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}

export function useIsDark() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const dark = useIsDark();
  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-3 hover:text-ink", className)}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
