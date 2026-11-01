"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type Toast = { id: number; text: string; tone: "ok" | "bad" | "info" };

let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Fire-and-forget feedback, callable from anywhere on the client. */
export function toast(text: string, tone: Toast["tone"] = "ok") {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, text, tone }].slice(-3);
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3200);
}

const EMPTY: Toast[] = [];

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => EMPTY,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:right-6 md:bottom-6 md:left-auto md:items-end">
      {list.map((t) => {
        const Icon = t.tone === "ok" ? CheckCircle2 : t.tone === "bad" ? XCircle : Info;
        return (
          <div key={t.id} className="pointer-events-auto flex animate-rise items-center gap-2.5 rounded-xl bg-[#15171c] px-4 py-3 text-sm font-medium text-[#f2f2ee] shadow-pop dark:bg-surface-3">
            <Icon className={cn("h-4 w-4", t.tone === "ok" && "text-[#c8f169]", t.tone === "bad" && "text-[#f07373]", t.tone === "info" && "text-[#7c97f5]")} />
            {t.text}
          </div>
        );
      })}
    </div>
  );
}
