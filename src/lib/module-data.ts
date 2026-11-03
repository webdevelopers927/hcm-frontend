/*
 * Mock records for the Employees module sub-pages. Every record points at a
 * real mock employee so names, avatars and links stay consistent.
 */
import { employees, type Employee } from "./data";

const E = (i: number) => employees[i % employees.length]!;
const pad = (n: number) => String(n).padStart(2, "0");
const day = (m: number, d: number, y = 2026) => `${y}-${pad(m)}-${pad(d)}`;

export type Approval = "Pending" | "Approved" | "Rejected";

/* ---------- Employment ---------- */
export type EmploymentRecord = {
  id: string;
  employee: Employee;
  probationStart: string;
  probationEnd: string;
  probationMonths: number;
  contractFrom: string;
  contractTo: string | null;
  resignStatus: "None" | "Submitted" | "Accepted";
  resignDate: string | null;
  lastWorkingDay: string | null;
  remoteAccess: boolean;
  remoteFrom: string | null;
  remoteTill: string | null;
  reportsTo: Employee | null;
};

export const employmentRecords: EmploymentRecord[] = employees.slice(0, 40).map((e, i) => {
  const months = [3, 3, 6, 3][i % 4]!;
  const start = e.joinDate;
  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  const resign = e.status === "Notice period" ? "Accepted" : i % 17 === 5 ? "Submitted" : "None";
  return {
    id: `EM-${2000 + i}`,
    employee: e,
    probationStart: start,
    probationEnd: end.toISOString().slice(0, 10),
    probationMonths: months,
    contractFrom: start,
    contractTo: i % 3 === 0 ? null : day(12, 31, 2026 + (i % 2)),
    resignStatus: resign,
    resignDate: resign === "None" ? null : day(10, 10 + (i % 15)),
    lastWorkingDay: resign === "None" ? null : day(11, 20 + (i % 9)),
    remoteAccess: e.workMode !== "Onsite",
    remoteFrom: e.workMode !== "Onsite" ? day(1, 1) : null,
    remoteTill: e.workMode !== "Onsite" ? day(12, 31) : null,
    reportsTo: e.managerId ? employees.find((x) => x.id === e.managerId) ?? null : null,
  };
});

/* ---------- Credentials ---------- */
export type Credential = {
  id: string;
  employee: Employee;
  username: string;
  state: "Active" | "Invited" | "Locked" | "Never sent";
  twoFactor: boolean;
  deviceBound: boolean;
  lastLogin: string | null;
  createdAt: string;
};
export const credentials: Credential[] = employees.map((e, i) => {
  const state = (["Active", "Active", "Active", "Active", "Invited", "Active", "Locked", "Never sent"] as const)[i % 8]!;
  return {
    id: `CR-${500 + i}`,
    employee: e,
    username: e.email,
    state,
    twoFactor: i % 3 !== 1,
    deviceBound: i % 4 === 0,
    lastLogin: state === "Active" ? `${(i % 9) + 1}${i % 2 ? "h" : "d"} ago` : null,
    createdAt: e.joinDate,
  };
});

/* ---------- Promotions ---------- */
export type Promotion = {
  id: string;
  employee: Employee;
  from: string;
  to: string;
  effectiveDate: string;
  raisePct: number;
  status: Approval;
  note: string;
};
export const promotions: Promotion[] = [
  [2, "Software Engineer", "Senior Software Engineer", day(12, 1), 18, "Pending", "Led the payments migration end-to-end"],
  [6, "Support Specialist", "CS Manager", day(11, 1), 22, "Approved", "Consistently top CSAT for 3 quarters"],
  [9, "Product Designer", "Senior Product Designer", day(1, 1, 2027), 15, "Pending", "Owns the design system"],
  [13, "Accountant", "Finance Manager", day(10, 1), 25, "Approved", "Closed books 4 days faster"],
  [17, "Sales Development Rep", "Account Executive", day(11, 15), 20, "Rejected", "Revisit after Q1 targets"],
  [22, "QA Engineer", "Senior QA Engineer", day(12, 1), 12, "Pending", "Built the automation suite"],
  [27, "Content Strategist", "Marketing Lead", day(9, 1), 30, "Approved", "Grew organic traffic 3×"],
].map(([n, from, to, eff, pct, status, note], i) => ({
  id: `PR-${100 + i}`,
  employee: E(n as number),
  from: from as string,
  to: to as string,
  effectiveDate: eff as string,
  raisePct: pct as number,
  status: status as Approval,
  note: note as string,
}));

/* ---------- Probation ---------- */
export type ProbationCycle = {
  id: string;
  employee: Employee;
  manager: Employee;
  start: string;
  end: string;
  cycle: string;
  managerStatus: "Not started" | "In progress" | "Submitted";
  recommendation: "Confirm" | "Extend" | "Terminate" | null;
  hrStatus: "Pending" | "Clarification" | "Closed";
  score: number | null;
};
export const probationCycles: ProbationCycle[] = employees
  .filter((e) => e.status === "Probation")
  .concat(employees.slice(40, 46))
  .slice(0, 12)
  .map((e, i) => {
    const managerStatus = (["Submitted", "In progress", "Not started", "Submitted", "Submitted", "In progress"] as const)[i % 6]!;
    return {
      id: `PB-${400 + i}`,
      employee: e,
      manager: E(i % 6),
      start: day(8 + (i % 3), 1 + i),
      end: day(11 + (i % 3 === 2 ? 1 : 0), 1 + i * 2),
      cycle: i % 4 === 3 ? "Extension · 2nd cycle" : "Standard · 3 months",
      managerStatus,
      recommendation: managerStatus === "Submitted" ? ((["Confirm", "Confirm", "Extend", "Confirm", "Terminate"] as const)[i % 5] ?? "Confirm") : null,
      hrStatus: managerStatus !== "Submitted" ? "Pending" : i % 5 === 2 ? "Clarification" : i % 3 === 0 ? "Closed" : "Pending",
      score: managerStatus === "Submitted" ? 62 + ((i * 11) % 34) : null,
    };
  });

/* ---------- Overtime ---------- */
export type OvertimeEntry = { id: string; employee: Employee; date: string; regularHours: number; overtimeHours: number; reason: string; status: Approval };
export const overtime: OvertimeEntry[] = Array.from({ length: 18 }, (_, i) => ({
  id: `OT-${600 + i}`,
  employee: E(i * 3 + 1),
  date: day(10, 31 - i),
  regularHours: 9,
  overtimeHours: [1.5, 2, 3, 2.5, 4, 1, 2][i % 7]!,
  reason: ["Release deployment", "Month-end close", "Client escalation", "Inventory audit", "Hotfix on-call", "Campaign launch"][i % 6]!,
  status: (i < 7 ? "Pending" : i % 5 === 0 ? "Rejected" : "Approved") as Approval,
}));

/* ---------- Stars redemption ---------- */
export type Redemption = { id: string; employee: Employee; offer: string; stars: number; balance: number; requestedAt: string; status: Approval };
export const redemptions: Redemption[] = Array.from({ length: 12 }, (_, i) => ({
  id: `RD-${800 + i}`,
  employee: E(i * 5 + 2),
  offer: ["Extra day off", "Foodpanda voucher · PKR 3,000", "Noise-cancelling headphones", "Gym membership · 1 month", "Lunch with the CEO", "Course budget · PKR 15,000"][i % 6]!,
  stars: [120, 40, 300, 80, 60, 200][i % 6]!,
  balance: 140 + ((i * 47) % 300),
  requestedAt: day(10, 28 - i * 2 > 0 ? 28 - i * 2 : 1),
  status: (i < 5 ? "Pending" : i % 4 === 0 ? "Rejected" : "Approved") as Approval,
}));

/* ---------- Gate passes ---------- */
export type GatePass = {
  id: string;
  employee: Employee;
  date: string;
  from: string;
  to: string;
  reason: string;
  managerStatus: "Pending" | "Approved" | "Rejected" | "Auto-approved";
  hrStatus: Approval;
};
export const gatePasses: GatePass[] = Array.from({ length: 14 }, (_, i) => ({
  id: `GP-${200 + i}`,
  employee: E(i * 4 + 3),
  date: day(11, 1 + Math.floor(i / 3)),
  from: ["11:00", "13:30", "15:00", "10:15", "16:00"][i % 5]!,
  to: ["12:00", "14:30", "16:30", "11:00", "17:30"][i % 5]!,
  reason: ["Bank visit", "Doctor appointment", "Child's school meeting", "NADRA office", "Personal errand"][i % 5]!,
  managerStatus: (["Approved", "Pending", "Approved", "Auto-approved", "Rejected"] as const)[i % 5]!,
  hrStatus: (i < 6 ? "Pending" : i % 4 === 0 ? "Rejected" : "Approved") as Approval,
}));

/* ---------- Wishes ---------- */
export type Wish = { id: string; sender: Employee; recipient: Employee; event: "Birthday" | "Work anniversary" | "Promotion" | "Welcome"; message: string; at: string; reactions: number };
export const wishes: Wish[] = Array.from({ length: 16 }, (_, i) => ({
  id: `WS-${i}`,
  sender: E(i * 7 + 5),
  recipient: E([3, 4, 5, 6][i % 4]!),
  event: (["Birthday", "Work anniversary", "Birthday", "Promotion", "Welcome"] as const)[i % 5]!,
  message: [
    "Happy birthday! Have an amazing year ahead 🎉",
    "Three years of making this team better — thank you!",
    "Wishing you the best day. Cake is on you 🍰",
    "So well deserved. Congratulations on the new role!",
    "Welcome aboard! Ping me if you need anything.",
    "Many happy returns of the day!",
  ][i % 6]!,
  at: `${i < 4 ? i + 1 : i}${i < 4 ? "h" : "d"} ago`,
  reactions: (i * 7) % 23,
}));

/* ---------- Hired candidates ---------- */
export type HiredCandidate = {
  id: string;
  name: string;
  hue: number;
  email: string;
  phone: string;
  designation: string;
  department: string;
  offerAccepted: string;
  joiningDate: string;
  status: "Offer accepted" | "Documents pending" | "Ready to onboard" | "Converted";
  docs: number;
};
export const hiredCandidates: HiredCandidate[] = [
  ["Mahnoor Rizvi", "Product Designer", "Design", "Ready to onboard", 5],
  ["Shayan Mirza", "Senior Backend Engineer", "Engineering", "Documents pending", 2],
  ["Laiba Anwar", "Account Executive", "Sales", "Offer accepted", 0],
  ["Taha Haider", "DevOps Engineer", "Engineering", "Ready to onboard", 5],
  ["Eman Qureshi", "Support Specialist", "Customer Success", "Converted", 5],
  ["Rehan Iqbal", "Payroll Specialist", "Finance", "Documents pending", 3],
  ["Khadija Farooq", "Talent Acquisition", "People", "Offer accepted", 1],
].map(([name, designation, department, status, docs], i) => ({
  id: `HC-${50 + i}`,
  name: name as string,
  hue: (i * 53 + 20) % 360,
  email: (name as string).toLowerCase().replace(" ", ".") + "@gmail.com",
  phone: `+92 30${i} 55${pad(i * 7)}${pad(i * 3)}12`,
  designation: designation as string,
  department: department as string,
  offerAccepted: day(10, 5 + i * 3),
  joiningDate: day(11, 10 + i * 2),
  status: status as HiredCandidate["status"],
  docs: docs as number,
}));

/* ---------- HR documents ---------- */
export type HrDoc = { id: string; employee: Employee; type: string; file: string; size: string; uploadedAt: string; expires: string | null };
export const DOC_TYPES = ["Contract", "Offer letter", "CNIC", "Degree", "Experience letter", "Medical", "NDA", "Warning letter"];
export const hrDocs: HrDoc[] = Array.from({ length: 30 }, (_, i) => {
  const type = DOC_TYPES[i % DOC_TYPES.length]!;
  const kb = 80 + ((i * 137) % 1900);
  return {
    id: `HD-${1000 + i}`,
    employee: E(i * 2),
    type,
    file: `${type.replace(/\s/g, "-").toLowerCase()}_${E(i * 2).pseudoName.toLowerCase()}.${type === "CNIC" ? "jpg" : "pdf"}`,
    size: kb >= 1000 ? `${(kb / 1000).toFixed(1)} MB` : `${kb} KB`,
    uploadedAt: day(1 + (i % 10), 1 + (i % 27)),
    expires: type === "CNIC" ? day(3, 14, 2029) : type === "Contract" ? day(12, 31, 2026) : null,
  };
});
