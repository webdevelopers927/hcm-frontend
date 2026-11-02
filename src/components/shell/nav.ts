import {
  BadgeCheck,
  BarChart3,
  BadgeInfo,
  Briefcase,
  CalendarDays,
  Clock3,
  DoorOpen,
  FileSignature,
  FilePen,
  FileText,
  Gift,
  GraduationCap,
  Hourglass,
  KeyRound,
  LayoutGrid,
  Layers,
  LogOut,
  PartyPopper,
  Settings,
  Star,
  Target,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  ready?: boolean;
  count?: number;
  /** Sub-pages, grouped. Turns the item into an expandable module. */
  groups?: { title: string; items: NavItem[] }[];
};

/** Employees module. Used by the sidebar and the in-module switcher. */
export const EMPLOYEE_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Directory",
    items: [
      { label: "All employees", href: "/employees", icon: Users, ready: true },
      { label: "Drafts", href: "/employees/drafts", icon: FilePen, ready: true },
      { label: "Hired candidates", href: "/employees/onboarding", icon: UserCheck, ready: true, count: 4 },
      { label: "Credentials", href: "/employees/credentials", icon: KeyRound, ready: true },
    ],
  },
  {
    title: "Lifecycle",
    items: [
      { label: "Employment", href: "/employees/employment", icon: UserCog, ready: true },
      { label: "Contracts", href: "/employees/contracts", icon: FileSignature, ready: true },
      { label: "Probation", href: "/employees/probation", icon: Hourglass, ready: true },
      { label: "Promotions", href: "/employees/promotions", icon: TrendingUp, ready: true },
      { label: "Off-boarding", href: "/employees/offboarding", icon: LogOut, ready: true },
    ],
  },
  {
    title: "Time",
    items: [
      { label: "Shift records", href: "/employees/shifts", icon: Clock3, ready: true },
      { label: "Overtime", href: "/employees/overtime", icon: BadgeCheck, ready: true, count: 7 },
      { label: "Gate passes", href: "/employees/gate-passes", icon: DoorOpen, ready: true, count: 6 },
    ],
  },
  {
    title: "Engagement & records",
    items: [
      { label: "Wishes", href: "/employees/wishes", icon: PartyPopper, ready: true },
      { label: "Star redemptions", href: "/employees/redemptions", icon: Star, ready: true, count: 5 },
      { label: "HR documents", href: "/employees/documents", icon: FileText, ready: true },
    ],
  },
  {
    title: "Setup",
    items: [
      { label: "Divisions", href: "/employees/divisions", icon: Layers, ready: true },
      { label: "Employment statuses", href: "/employees/employment-statuses", icon: BadgeInfo, ready: true },
      { label: "Degree programs", href: "/employees/degree-programs", icon: GraduationCap, ready: true },
    ],
  },
];

export const EMPLOYEE_PAGES = EMPLOYEE_GROUPS.flatMap((g) => g.items);

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutGrid, ready: true },
      { label: "Employees", href: "/employees", icon: Users, ready: true, groups: EMPLOYEE_GROUPS },
      { label: "Attendance", href: "/attendance", icon: Clock3 },
      { label: "Time off", href: "/leave", icon: CalendarDays, count: 4 },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Payroll", href: "/payroll", icon: Wallet },
      { label: "Hiring", href: "/hiring", icon: Briefcase, count: 12 },
      { label: "Performance", href: "/performance", icon: Target },
      { label: "Rewards", href: "/rewards", icon: Gift },
      { label: "Reports", href: "/reports", icon: BarChart3 },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { label: "Settings", href: "/settings", icon: Settings };

/** The sub-page that best matches the path (longest prefix wins). */
export function activeEmployeePage(pathname: string) {
  const exact = EMPLOYEE_PAGES.find((p) => p.href === pathname);
  if (exact) return exact;
  return [...EMPLOYEE_PAGES]
    .filter((p) => p.href !== "/employees" && pathname.startsWith(p.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0] ?? EMPLOYEE_PAGES[0]!;
}
