"use client";

import { ChevronDown, ChevronsLeft, LifeBuoy, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo, LogoMark } from "@/components/ui/brand";
import { Avatar } from "@/components/ui/primitives";
import { useSession } from "@/components/session/session-provider";
import { hueFor } from "@/lib/api/display";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, SETTINGS_ITEM, activeEmployeePage, type NavItem } from "./nav";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-300 lg:flex",
        collapsed ? "w-[76px]" : "w-[260px]",
      )}
    >
      <div className={cn("flex h-16 items-center", collapsed ? "justify-center" : "justify-between px-5")}>
        <Link href="/dashboard" aria-label="Home">
          {collapsed ? <LogoMark /> : <Logo />}
        </Link>
        {!collapsed && (
          <button onClick={onToggle} aria-label="Collapse sidebar" className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink">
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>
      {collapsed && (
        <button onClick={onToggle} aria-label="Expand sidebar" className="mx-auto mb-2 rounded-lg p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink">
          <ChevronsLeft className="h-4 w-4 rotate-180" />
        </button>
      )}
      <NavBody collapsed={collapsed} />
    </aside>
  );
}

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    onClose();
    // close whenever the route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="absolute inset-0 animate-fade bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-[300px] animate-[slide-in-left_0.3s_cubic-bezier(0.2,0.8,0.2,1)] flex-col bg-surface shadow-pop">
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-2 text-ink-2 hover:bg-surface-3">
            <X className="h-5 w-5" />
          </button>
        </div>
        <NavBody collapsed={false} />
      </div>
    </div>
  );
}

function NavBody({ collapsed }: { collapsed: boolean }) {
  const { user } = useSession();
  return (
    <>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && <div className="px-3 pb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{section.title}</div>}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>{item.groups && !collapsed ? <NavModule item={item} /> : <NavLink item={item} collapsed={collapsed} />}</li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        {!collapsed && (
          <div className="rounded-2xl bg-surface-2 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <LifeBuoy className="h-4 w-4" /> Need a hand?
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-3">Our team replies in under 10 minutes during business hours.</p>
          </div>
        )}
        <NavLink item={SETTINGS_ITEM} collapsed={collapsed} />
        <div className={cn("flex items-center gap-3 rounded-xl p-2", collapsed && "justify-center")}>
          <Avatar name={user?.name ?? "…"} hue={hueFor(user?.id ?? 0)} size="sm" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-semibold text-ink">{user?.name ?? "Loading…"}</div>
              <div className="truncate text-[12px] text-ink-3">{user?.email}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/** An expandable module (e.g. Employees) with grouped sub-pages. */
function NavModule({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const inModule = pathname === item.href || pathname.startsWith(item.href + "/");
  const [open, setOpen] = useState(inModule);
  const [prevIn, setPrevIn] = useState(inModule);
  // Auto-expand when navigating into the module (adjusting state during render).
  if (inModule !== prevIn) {
    setPrevIn(inModule);
    if (inModule) setOpen(true);
  }
  const current = activeEmployeePage(pathname);
  const Icon = item.icon;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "group flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition",
          inModule ? "text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", inModule ? "text-ink" : "text-ink-3 group-hover:text-ink")} />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown className={cn("h-4 w-4 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="relative mt-0.5 ml-[21px] space-y-3 border-l border-line py-1 pl-3">
          {item.groups!.map((g) => (
            <div key={g.title}>
              <div className="px-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-ink-3 uppercase">{g.title}</div>
              <ul>
                {g.items.map((sub) => {
                  const active = inModule && current.href === sub.href;
                  return (
                    <li key={sub.href}>
                      <Link
                        href={sub.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] transition",
                          active ? "bg-surface-3 font-semibold text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                        )}
                      >
                        {active && <span className="absolute top-1.5 bottom-1.5 -left-[13px] w-0.5 rounded-full bg-ink" />}
                        <span className="flex-1 truncate">{sub.label}</span>
                        {sub.count !== undefined && <span className={cn("tabular rounded-md px-1.5 text-[10px] font-semibold", active ? "bg-accent text-accent-ink" : "bg-surface-3 text-ink-2")}>{sub.count}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  const content = (
    <>
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-ink" : "text-ink-3 group-hover:text-ink")} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.count !== undefined && (
        <span className={cn("tabular rounded-md px-1.5 text-[11px] font-semibold", active ? "bg-accent text-accent-ink" : "bg-surface-3 text-ink-2")}>{item.count}</span>
      )}
      {!collapsed && !item.ready && item.count === undefined && <span className="text-[10px] font-semibold tracking-wide text-ink-3 uppercase">Soon</span>}
      {collapsed && item.count !== undefined && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />}
    </>
  );
  const cls = cn(
    "group relative flex h-10 items-center gap-3 rounded-xl text-[14px] font-medium transition",
    collapsed ? "justify-center" : "px-3",
    active ? "bg-surface-3 text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
    !item.ready && "cursor-default",
  );
  if (!item.ready) {
    return (
      <span className={cls} title={collapsed ? `${item.label} (coming soon)` : undefined} aria-disabled>
        {content}
      </span>
    );
  }
  return (
    <Link href={item.href} className={cls} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined}>
      {active && !collapsed && <span className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-ink" />}
      {content}
    </Link>
  );
}
