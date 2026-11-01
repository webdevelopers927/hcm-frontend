import { useSyncExternalStore } from "react";

/*
 * Shared 1-second clock. Returns null during SSR/hydration so time-based
 * UI never causes a hydration mismatch, then ticks on the client.
 */
let now: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow() {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
}
