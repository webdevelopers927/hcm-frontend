/*
 * Mock data layer. Shapes mirror what the HCM backend returns so these
 * functions can be swapped for real fetches later without touching the UI.
 */

export type EmployeeStatus = "Active" | "Probation" | "On leave" | "Notice period" | "Inactive";
export type WorkMode = "Onsite" | "Remote" | "Hybrid";
export type Department =
  | "Engineering"
  | "Design"
  | "Sales"
  | "Customer Success"
  | "Finance"
  | "People"
  | "Operations"
  | "Marketing";

export type Employee = {
  id: string;
  code: string;
  machineUid: string;
  name: string;
  pseudoName: string;
  email: string;
  phone: string;
  designation: string;
  department: Department;
  status: EmployeeStatus;
  workMode: WorkMode;
  shift: string;
  campaign: string;
  location: string;
  joinDate: string;
  managerId: string | null;
  gender: "Male" | "Female";
  cnic: string;
  birthday: string;
  hue: number;
  attendanceRate: number;
  leaveBalance: number;
};

// Deterministic PRNG so server and client render identical data.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const rand = seeded(42);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;

const firstMale = ["Hassan", "Ali", "Usman", "Bilal", "Hamza", "Zain", "Faisal", "Saad", "Omar", "Danish", "Arslan", "Taha", "Rehan", "Fahad", "Junaid", "Imran", "Kashif", "Shayan"];
const firstFemale = ["Ayesha", "Fatima", "Maryam", "Hira", "Sana", "Zoya", "Mahnoor", "Iqra", "Amna", "Noor", "Areeba", "Sidra", "Laiba", "Rabia", "Khadija", "Eman"];
const last = ["Abbas", "Khan", "Malik", "Qureshi", "Siddiqui", "Sheikh", "Butt", "Chaudhry", "Raza", "Hussain", "Javed", "Mirza", "Ahmed", "Farooq", "Iqbal", "Rizvi", "Anwar", "Haider"];

const roles: Record<Department, string[]> = {
  Engineering: ["Senior Software Engineer", "Software Engineer", "Frontend Engineer", "DevOps Engineer", "QA Engineer", "Engineering Manager"],
  Design: ["Product Designer", "UX Researcher", "Brand Designer"],
  Sales: ["Account Executive", "Sales Development Rep", "Sales Lead"],
  "Customer Success": ["Support Specialist", "CS Manager", "Onboarding Specialist"],
  Finance: ["Accountant", "Payroll Specialist", "Finance Manager"],
  People: ["HR Business Partner", "Talent Acquisition", "People Ops Lead"],
  Operations: ["Operations Analyst", "Office Manager", "IT Administrator"],
  Marketing: ["Content Strategist", "Growth Marketer", "Marketing Lead"],
};

const departments = Object.keys(roles) as Department[];
const deptWeights: Department[] = [
  "Engineering", "Engineering", "Engineering", "Engineering", "Design", "Sales", "Sales",
  "Customer Success", "Customer Success", "Customer Success", "Finance", "People", "Operations", "Marketing",
];
const statuses: EmployeeStatus[] = ["Active", "Active", "Active", "Active", "Active", "Active", "Active", "Probation", "Probation", "On leave", "Notice period", "Inactive"];
const modes: WorkMode[] = ["Onsite", "Onsite", "Hybrid", "Hybrid", "Remote"];
const shifts = ["Morning · 09:00–18:00", "Evening · 14:00–23:00", "Night · 21:00–06:00", "Flexible"];
const campaigns = ["Core Platform", "Atlas", "Helios", "Internal", "Northstar", "—"];
const locations = ["Lahore", "Lahore", "Karachi", "Islamabad", "Remote"];

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function makeEmployees(count: number): Employee[] {
  const list: Employee[] = [];
  for (let i = 0; i < count; i++) {
    const gender = rand() > 0.42 ? "Male" : "Female";
    const first = pick(gender === "Male" ? firstMale : firstFemale);
    const surname = pick(last);
    const name = `${first} ${surname}`;
    const department = i === 0 ? "People" : pick(deptWeights);
    const designation = i === 0 ? "People Ops Lead" : pick(roles[department]);
    const year = 2019 + Math.floor(rand() * 8);
    const month = 1 + Math.floor(rand() * 12);
    const joinDate = `${Math.min(year, 2026)}-${pad(year === 2026 ? Math.min(month, 10) : month)}-${pad(1 + Math.floor(rand() * 27))}`;
    const status: EmployeeStatus = i === 0 ? "Active" : year === 2026 && month >= 7 ? "Probation" : pick(statuses);
    list.push({
      id: String(1001 + i),
      code: `NW-${1001 + i}`,
      machineUid: String(2400 + i * 3),
      name,
      pseudoName: first,
      email: `${first}.${surname}`.toLowerCase() + "@northwind.pk",
      phone: `+92 3${Math.floor(rand() * 5)}${Math.floor(rand() * 10)} ${pad(Math.floor(rand() * 9999999), 7)}`,
      designation,
      department,
      status,
      workMode: pick(modes),
      shift: pick(shifts),
      campaign: pick(campaigns),
      location: pick(locations),
      joinDate,
      managerId: i < 6 ? null : String(1001 + Math.floor(rand() * 6)),
      gender,
      cnic: `35202-${pad(Math.floor(rand() * 9999999), 7)}-${Math.floor(rand() * 9)}`,
      birthday: `${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`,
      hue: Math.floor(rand() * 360),
      attendanceRate: Math.round(82 + rand() * 18),
      leaveBalance: Math.floor(rand() * 18),
    });
  }
  return list;
}

export const employees: Employee[] = makeEmployees(64);
export const currentUser = employees[0]!;
export const DEPARTMENTS = departments;
export const STATUSES: EmployeeStatus[] = ["Active", "Probation", "On leave", "Notice period", "Inactive"];
export const WORK_MODES: WorkMode[] = ["Onsite", "Hybrid", "Remote"];

export function getEmployee(id: string) {
  return employees.find((e) => e.id === id);
}

export function getManager(e: Employee) {
  return e.managerId ? getEmployee(e.managerId) : undefined;
}

export function getReports(e: Employee) {
  return employees.filter((x) => x.managerId === e.id);
}

/* ---------- dashboard aggregates ---------- */

export const headcountTrend = [
  { m: "Dec", hires: 3, exits: 1, total: 49 },
  { m: "Jan", hires: 4, exits: 2, total: 51 },
  { m: "Feb", hires: 2, exits: 0, total: 53 },
  { m: "Mar", hires: 5, exits: 3, total: 55 },
  { m: "Apr", hires: 1, exits: 1, total: 55 },
  { m: "May", hires: 3, exits: 2, total: 56 },
  { m: "Jun", hires: 4, exits: 1, total: 59 },
  { m: "Jul", hires: 6, exits: 2, total: 63 },
  { m: "Aug", hires: 2, exits: 3, total: 62 },
  { m: "Sep", hires: 3, exits: 2, total: 63 },
  { m: "Oct", hires: 2, exits: 1, total: 64 },
  { m: "Nov", hires: 1, exits: 1, total: 64 },
];

export const attendanceToday = {
  onTime: 41,
  late: 7,
  halfDay: 2,
  onLeave: 6,
  absent: 3,
  notIn: 5,
};

export const weeklyAttendance = [
  { d: "Mon", rate: 94 },
  { d: "Tue", rate: 96 },
  { d: "Wed", rate: 91 },
  { d: "Thu", rate: 93 },
  { d: "Fri", rate: 88 },
];

export type LeaveRequest = {
  id: string;
  employeeId: string;
  type: "Annual" | "Sick" | "Casual" | "WFH";
  from: string;
  to: string;
  days: number;
  reason: string;
};

export const leaveRequests: LeaveRequest[] = [
  { id: "L1", employeeId: "1008", type: "Annual", from: "2026-11-10", to: "2026-11-14", days: 5, reason: "Family wedding in Multan" },
  { id: "L2", employeeId: "1015", type: "Sick", from: "2026-11-02", to: "2026-11-02", days: 1, reason: "Fever, doctor's note attached" },
  { id: "L3", employeeId: "1022", type: "WFH", from: "2026-11-04", to: "2026-11-05", days: 2, reason: "Internet installation at home" },
  { id: "L4", employeeId: "1031", type: "Casual", from: "2026-11-06", to: "2026-11-06", days: 1, reason: "Personal errand" },
];

export const openRoles = [
  { title: "Senior Backend Engineer", dept: "Engineering", applicants: 48, stage: [48, 21, 9, 3] },
  { title: "Product Designer", dept: "Design", applicants: 31, stage: [31, 12, 5, 2] },
  { title: "Account Executive", dept: "Sales", applicants: 22, stage: [22, 10, 4, 1] },
];

export const announcements = [
  { id: "a1", title: "Q4 town hall moves to Thursday, 4 PM", meta: "People team · 2h ago", tag: "Event" },
  { id: "a2", title: "Updated reimbursement policy is live", meta: "Finance · Yesterday", tag: "Policy" },
  { id: "a3", title: "Office closed on 9 Nov for Iqbal Day", meta: "Operations · 2d ago", tag: "Holiday" },
];

export function onLeaveToday() {
  return employees.filter((e) => e.status === "On leave").slice(0, 6);
}

export function onBreakNow() {
  return employees.filter((e) => e.status === "Active").slice(9, 13).map((e, i) => ({ employee: e, minutes: [4, 11, 18, 26][i]! }));
}

export function upcomingCelebrations() {
  const bdays = employees.slice(3, 6).map((e, i) => ({ employee: e, kind: "Birthday" as const, when: ["Today", "Tomorrow", "Nov 5"][i]! }));
  const annis = employees
    .filter((e) => e.joinDate.slice(5, 7) === "11")
    .slice(0, 2)
    .map((e) => ({ employee: e, kind: "Anniversary" as const, when: `Nov ${Number(e.joinDate.slice(8, 10))}`, years: 2026 - Number(e.joinDate.slice(0, 4)) }));
  return [...bdays, ...annis];
}

export function departmentBreakdown() {
  const counts = new Map<Department, number>();
  for (const e of employees) counts.set(e.department, (counts.get(e.department) ?? 0) + 1);
  return [...counts.entries()].map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count);
}
