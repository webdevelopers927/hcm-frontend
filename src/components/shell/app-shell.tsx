"use client";

import { Bell, CalendarDays, Clock3, LayoutGrid, LogOut, Menu, Search, Settings, User, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark, ThemeToggle } from "@/components/ui/brand";
import { Avatar, Kbd } from "@/components/ui/primitives";
import { Toaster } from "@/components/ui/toast";
import { useSession } from "@/components/session/session-provider";
import { hueFor } from "@/lib/api/display";
import { employees } from "@/lib/data";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { MobileDrawer, Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted preference after hydration
      setCollapsed(localStorage.getItem("sidebar") === "collapsed");
    } catch {}
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar", c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  }

  const closeDrawer = useCallback(() => setDrawer(false), []);
  const closePalette = useCallback(() => setPalette(false), []);

  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      <MobileDrawer open={drawer} onClose={closeDrawer} />
      <CommandPalette open={palette} onClose={closePalette} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        <main className="flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-7 lg:pb-12">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>

      <BottomNav onMore={() => setDrawer(true)} />
      <Toaster />
    </div>
  );
}

function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <button onClick={onMenu} aria-label="Open menu" className="-ml-1 rounded-xl p-2 text-ink-2 hover:bg-surface-3 lg:hidden">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="lg:hidden" aria-label="Home">
          <LogoMark className="h-7 w-7" />
        </Link>

        <button
          onClick={onSearch}
          className="ml-auto flex h-10 items-center gap-2.5 rounded-xl text-sm text-ink-3 transition sm:ml-0 sm:w-full sm:max-w-sm sm:border sm:border-line sm:bg-surface sm:px-3 sm:shadow-soft sm:hover:border-line-strong"
          aria-label="Search"
        >
          <Search className="h-[18px] w-[18px] max-sm:mx-2.5 max-sm:text-ink-2" />
          <span className="hidden flex-1 text-left sm:block">Search people, pages…</span>
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="flex items-center gap-1 sm:ml-auto">
          <ThemeToggle />
          <Notifications />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const notifications = [
  { id: 1, who: employees[7]!, text: "requested 5 days of annual leave", time: "8m", unread: true },
  { id: 2, who: employees[14]!, text: "completed onboarding checklist", time: "1h", unread: true },
  { id: 3, who: employees[21]!, text: "uploaded a medical certificate", time: "3h", unread: false },
  { id: 4, who: employees[30]!, text: "accepted the offer for Product Designer", time: "1d", unread: false },
];

function Notifications() {
  const { open, setOpen, ref } = usePopover();
  const unread = notifications.filter((n) => n.unread).length;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-3 hover:text-ink"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-bad ring-2 ring-canvas" />}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[68px] z-40 animate-rise rounded-2xl border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:top-12 sm:right-0 sm:w-[380px]">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-[15px] font-semibold text-ink">Notifications</h3>
            <button className="text-[12px] font-medium text-ink-3 hover:text-ink">Mark all read</button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto p-2">
            {notifications.map((n) => (
              <li key={n.id} className="flex gap-3 rounded-xl p-2.5 hover:bg-surface-2">
                <Avatar name={n.who.name} hue={n.who.hue} size="sm" />
                <div className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">
                  <span className="font-semibold text-ink">{n.who.name}</span> {n.text}
                  <div className="mt-0.5 text-[12px] text-ink-3">{n.time} ago</div>
                </div>
                {n.unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-info" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { open, setOpen, ref } = usePopover();
  const { user, signOut } = useSession();
  const name = user?.name ?? "…";
  const links = [
    ...(user?.employee_id ? [{ icon: User, label: "My profile", href: `/employees/${user.employee_id}` }] : []),
    { icon: Settings, label: "Preferences", href: "#" },
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Account menu" aria-expanded={open} className="ml-1 rounded-full ring-offset-2 ring-offset-canvas hover:ring-2 hover:ring-line-strong">
        <Avatar name={name} hue={hueFor(user?.id ?? 0)} size="sm" />
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-40 w-60 animate-rise rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
          <div className="px-3 py-2.5">
            <div className="text-sm font-semibold text-ink">{name}</div>
            <div className="truncate text-[12px] text-ink-3">{user?.email}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          {links.map((i) => (
            <Link key={i.label} href={i.href} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              <i.icon className="h-4 w-4" /> {i.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-bad hover:bg-bad-soft">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const items = [
    { href: "/dashboard", label: "Home", icon: LayoutGrid },
    { href: "/employees", label: "People", icon: Users },
  ];
  const tab = (href: string) => pathname === href || pathname.startsWith(href + "/");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Primary">
      <div className="grid h-16 grid-cols-5 items-center">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={cn("flex flex-col items-center gap-1 text-[11px] font-medium", tab(i.href) ? "text-ink" : "text-ink-3")}>
            <i.icon className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
        <div className="flex justify-center">
          <button aria-label="Clock in" className="-mt-7 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-float ring-4 ring-canvas">
            <Clock3 className="h-6 w-6" />
          </button>
        </div>
        <span className="flex flex-col items-center gap-1 text-[11px] font-medium text-ink-3">
          <CalendarDays className="h-5 w-5" />
          Time off
        </span>
        <button onClick={onMore} className="flex flex-col items-center gap-1 text-[11px] font-medium text-ink-3">
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
