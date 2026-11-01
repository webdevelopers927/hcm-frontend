"use client";

import { ArrowRight, CornerDownLeft, Search, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { useQuery } from "@tanstack/react-query";
import { hueFor } from "@/lib/api/display";
import { listEmployees } from "@/lib/api/employees";
import { cn } from "@/lib/utils";
import { EMPLOYEE_PAGES, NAV_SECTIONS } from "./nav";

type Result =
  | { kind: "page"; label: string; href: string; icon: React.ComponentType<{ className?: string }> }
  | { kind: "person"; label: string; href: string; sub: string; hue: number }
  | { kind: "action"; label: string; href: string };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Palette onClose={onClose} />;
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [term, setTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const found = useQuery({
    queryKey: ["employees", "palette", term],
    queryFn: ({ signal }) => listEmployees({ search: term, per_page: 6 }, signal),
    enabled: term.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    const pages: Result[] = [...NAV_SECTIONS.flatMap((s) => s.items).filter((i) => !i.groups), ...EMPLOYEE_PAGES]
      .filter((i) => i.ready && (!term || i.label.toLowerCase().includes(term)))
      .map((i) => ({ kind: "page", label: i.label, href: i.href, icon: i.icon }));
    const actions: Result[] = [{ kind: "action" as const, label: "Add new employee", href: "/employees/new" }].filter(
      (a) => !term || a.label.toLowerCase().includes(term),
    );
    const people: Result[] =
      term && found.data
        ? found.data.data.map((e) => ({ kind: "person", label: e.name, href: `/employees/${e.id}`, sub: `${e.designation?.name ?? "—"} · ${e.code}`, hue: hueFor(e.id) }))
        : [];
    return [...people, ...actions, ...pages];
  }, [q, found.data]);

  function go(r: Result | undefined) {
    if (!r) return;
    onClose();
    router.push(r.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      go(results[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[10vh] sm:p-6 sm:pt-[14vh]" role="dialog" aria-modal="true" aria-label="Search">
      <div className="absolute inset-0 animate-fade bg-black/35 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-rise overflow-hidden rounded-2xl border border-line bg-surface shadow-pop" onKeyDown={onKey}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-[18px] w-[18px] text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Search people, pages, actions…"
            className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && <li className="px-3 py-10 text-center text-sm text-ink-3">No matches for “{q}”.</li>}
          {results.map((r, i) => (
            <li key={r.kind + r.href + r.label} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === active ? "bg-surface-3" : "")}
              >
                {r.kind === "person" && <Avatar name={r.label} hue={r.hue} size="sm" />}
                {r.kind === "page" && (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2">
                    <r.icon className="h-4 w-4 text-ink-2" />
                  </span>
                )}
                {r.kind === "action" && (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink">
                    <UserPlus className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{r.label}</span>
                  {r.kind === "person" && <span className="block truncate text-[12px] text-ink-3">{r.sub}</span>}
                </span>
                {i === active ? <CornerDownLeft className="h-4 w-4 text-ink-3" /> : <ArrowRight className="h-4 w-4 text-transparent" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-4 border-t border-line bg-surface-2 px-4 py-2.5 text-[12px] text-ink-3 sm:flex">
          <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> open</span>
        </div>
      </div>
    </div>
  );
}
