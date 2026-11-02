import type {
  ChildPayload,
  DocumentDetail,
  EmployeeDetail,
  EmployeePayload,
  EmployeeSummary,
  FileRef,
  IdName,
  SpousePayload,
  Upload,
  WorkExperiencePayload,
} from "@/lib/api/types";

/*
 * Pure model of the employee form: state shape, API detail ⇄ state, per-section
 * diffs (what a Save sends), merging a save response back in, and the
 * completeness rules behind the progress bar and the "you missed this" hints.
 */

/* ---------- sections ---------- */

export const SECTIONS = [
  { id: "personal", label: "Personal", hint: "Identity & origin" },
  { id: "positional", label: "Positional", hint: "Role, team & access" },
  { id: "contact", label: "Contact", hint: "Phones & addresses" },
  { id: "family", label: "Family", hint: "Spouses & children" },
  { id: "other", label: "Other", hint: "Passport & licence" },
  { id: "qualification", label: "Qualification", hint: "Education" },
  { id: "experience", label: "Work experience", hint: "Past employers" },
  { id: "documents", label: "Documents", hint: "Files on record" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];
export const isSectionId = (v: string | null): v is SectionId => SECTIONS.some((s) => s.id === v);

/* ---------- state ---------- */

const STR_KEYS = [
  // personal
  "salutation", "first_name", "middle_name", "last_name", "pseudo_name", "father_husband_name", "gender", "birth_date",
  "cnic", "cnic_expiry", "personal_email", "marital_status", "religion", "blood_group",
  // positional
  "division_id", "email", "department_id", "designation_id", "employment_status_id", "shift_id", "duty_type", "work_mode", "campaign_id",
  "location_id", "machine_uid", "probation_start_date", "probation_duration_id", "confirmation_date", "join_date",
  "separation_date", "resigned_date", "last_working_day", "reason_for_resignation", "remote_access_from", "remote_access_until",
  // contact
  "phone", "secondary_phone", "landline", "permanent_address", "present_address", "emergency_contact_name",
  "emergency_contact_phone", "emergency_contact_relation",
  // other
  "passport_no", "passport_expiry", "driving_license_no", "driving_license_expiry",
] as const;
export type StrKey = (typeof STR_KEYS)[number];

const ID_KEYS = new Set<StrKey>(["division_id", "department_id", "designation_id", "employment_status_id", "shift_id", "campaign_id", "location_id", "probation_duration_id"]);
/** National ids: the form only ever holds a *new* value; blank keeps what's stored. */
export const SECRET_KEYS = ["cnic", "passport_no", "driving_license_no"] as const;
export type SecretKey = (typeof SECRET_KEYS)[number];
const isSecret = (k: string): k is SecretKey => (SECRET_KEYS as readonly string[]).includes(k);
const PHONE_KEYS = new Set<StrKey>(["phone", "secondary_phone", "landline", "emergency_contact_phone"]);

export type RefKey = "country" | "state" | "city" | "nationality";
export type CountryPick = IdName & { phone_code?: string | null };

let seq = 0;
/** Client-only row key, stable across saves (React key + DOM ids). */
export const rowKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

export type PendingFile = { upload: Upload; preview?: string };
export type FileRefLike = { name: string; size: number };

export type ChildRow = { key: string; id?: number; full_name: string; birth_date: string };
export type SpouseRow = { key: string; id?: number; full_name: string; birth_date: string; cnic: string; cnic_masked: string | null; children: ChildRow[] };
export type QualRow = { key: string; id?: number; institution: string; degree_program: IdName | null; start_date: string; end_date: string; year: string };
export type ExpRow = {
  key: string;
  id?: number;
  company_name: string;
  designation: string;
  last_salary: string;
  country: CountryPick | null;
  state: IdName | null;
  city: IdName | null;
  period_from: string;
  period_to: string;
  contact_person_name: string;
  contact_person_email: string;
  contact_person_phone: string;
  letter: FileRef | null;
  letterPending: PendingFile | null;
  letterRemoved: boolean;
  reason_for_leaving: string;
  description: string;
};
export type DocRow = { key: string; id?: number; title: string; file: DocumentDetail | null; pending: PendingFile | null };

export type FormState = Record<StrKey, string> & {
  avatar: { pending: PendingFile | null; removed: boolean };
  country: CountryPick | null;
  state: IdName | null;
  city: IdName | null;
  nationality: IdName | null;
  reports_to: EmployeeSummary | null;
  indirect_reports_to: EmployeeSummary | null;
  has_team_authority: boolean;
  remote_access: boolean;
  permanent_remote_access: boolean;
  has_work_experience: boolean;
  spouses: SpouseRow[];
  qualifications: QualRow[];
  work_experiences: ExpRow[];
  documents: DocRow[];
};
export type FormKey = keyof FormState;

export const SECTION_KEYS: Record<SectionId, FormKey[]> = {
  personal: ["avatar", "salutation", "first_name", "middle_name", "last_name", "pseudo_name", "father_husband_name", "gender", "birth_date", "cnic", "cnic_expiry", "personal_email", "country", "state", "city", "nationality", "marital_status", "religion", "blood_group"],
  positional: [
    "division_id", "email", "department_id", "designation_id", "employment_status_id", "shift_id", "duty_type", "work_mode", "campaign_id", "location_id",
    "machine_uid", "probation_start_date", "probation_duration_id", "confirmation_date", "join_date", "separation_date", "resigned_date", "last_working_day", "reason_for_resignation", "reports_to",
    "indirect_reports_to", "has_team_authority", "remote_access", "permanent_remote_access", "remote_access_from", "remote_access_until",
  ],
  contact: ["phone", "secondary_phone", "landline", "permanent_address", "present_address", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation"],
  family: ["spouses"],
  other: ["passport_no", "passport_expiry", "driving_license_no", "driving_license_expiry"],
  qualification: ["qualifications"],
  experience: ["has_work_experience", "work_experiences"],
  documents: ["documents"],
};

/* ---------- formatting ---------- */

/** "+923001234567" → "+92 300 1234567" (groups the national part when the dial code is known). */
export function formatPhone(e164: string | null, dialCode?: string | null) {
  if (!e164) return "";
  if (!dialCode || !e164.startsWith(`+${dialCode}`)) return e164;
  const rest = e164.slice(dialCode.length + 1);
  const national = dialCode === "92" && rest.length === 10 ? `${rest.slice(0, 3)} ${rest.slice(3)}` : rest.replace(/(\d{3})(?=\d{4,})/g, "$1 ");
  return `+${dialCode} ${national}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------- detail → state ---------- */

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const ref = (v: IdName | null | undefined): IdName | null => (v ? { id: v.id, name: v.name } : null);
const salary = (v: string | null) => (v ? v.replace(/\.00$/, "") : "");

export function fromDetail(d: EmployeeDetail | null): FormState {
  const strings = Object.fromEntries(STR_KEYS.map((k) => [k, ""])) as Record<StrKey, string>;
  if (!d) {
    return {
      ...strings,
      work_mode: "onsite",
      avatar: { pending: null, removed: false },
      country: null, state: null, city: null, nationality: null,
      reports_to: null, indirect_reports_to: null,
      has_team_authority: false, remote_access: false, permanent_remote_access: false, has_work_experience: false,
      spouses: [], qualifications: [], work_experiences: [], documents: [],
    };
  }
  const dial = d.country?.phone_code;
  for (const k of STR_KEYS) {
    if (isSecret(k)) continue;
    const v = d[k];
    strings[k] = PHONE_KEYS.has(k) ? formatPhone(v as string | null, dial) : str(v);
  }
  return {
    ...strings,
    avatar: { pending: null, removed: false },
    country: d.country ? { id: d.country.id, name: d.country.name, phone_code: d.country.phone_code } : null,
    state: ref(d.state),
    city: ref(d.city),
    nationality: ref(d.nationality),
    reports_to: d.reports_to,
    indirect_reports_to: d.indirect_reports_to,
    has_team_authority: d.has_team_authority,
    remote_access: d.remote_access,
    permanent_remote_access: d.permanent_remote_access,
    has_work_experience: d.has_work_experience,
    spouses: d.spouses.map((s) => ({
      key: rowKey(), id: s.id, full_name: str(s.full_name), birth_date: str(s.birth_date), cnic: "", cnic_masked: s.cnic_masked,
      children: s.children.map((c) => ({ key: rowKey(), id: c.id, full_name: str(c.full_name), birth_date: str(c.birth_date) })),
    })),
    qualifications: d.qualifications.map((q) => ({
      key: rowKey(), id: q.id, institution: str(q.institution), degree_program: ref(q.degree_program), start_date: str(q.start_date), end_date: str(q.end_date), year: str(q.year),
    })),
    work_experiences: d.work_experiences.map((w) => ({
      key: rowKey(), id: w.id, company_name: str(w.company_name), designation: str(w.designation), last_salary: salary(w.last_salary),
      country: w.country ? { id: w.country.id, name: w.country.name, phone_code: w.country.phone_code } : null,
      state: ref(w.state), city: ref(w.city), period_from: str(w.period_from), period_to: str(w.period_to),
      contact_person_name: str(w.contact_person_name), contact_person_email: str(w.contact_person_email),
      contact_person_phone: formatPhone(w.contact_person_phone, w.country?.phone_code),
      letter: w.experience_letter, letterPending: null, letterRemoved: false,
      reason_for_leaving: str(w.reason_for_leaving), description: str(w.description),
    })),
    documents: d.documents.map((doc) => ({ key: rowKey(), id: doc.id, title: str(doc.title), file: doc, pending: null })),
  };
}

export const blankSpouse = (): SpouseRow => ({ key: rowKey(), full_name: "", birth_date: "", cnic: "", cnic_masked: null, children: [] });
export const blankChild = (): ChildRow => ({ key: rowKey(), full_name: "", birth_date: "" });
export const blankQual = (): QualRow => ({ key: rowKey(), institution: "", degree_program: null, start_date: "", end_date: "", year: "" });
export const blankExp = (): ExpRow => ({
  key: rowKey(), company_name: "", designation: "", last_salary: "", country: null, state: null, city: null, period_from: "", period_to: "",
  contact_person_name: "", contact_person_email: "", contact_person_phone: "", letter: null, letterPending: null, letterRemoved: false,
  reason_for_leaving: "", description: "",
});

/* ---------- state → payload ---------- */

const nn = (v: string) => (v.trim() === "" ? null : v.trim());
const idOrNull = (v: { id: number } | null) => v?.id ?? null;
const withId = (id?: number) => (id ? { id } : {});

function serializeList(key: "spouses" | "qualifications" | "work_experiences" | "documents", s: FormState): unknown[] {
  switch (key) {
    case "spouses":
      return s.spouses.map((sp): SpousePayload => ({
        ...withId(sp.id),
        full_name: nn(sp.full_name),
        birth_date: nn(sp.birth_date),
        ...(sp.cnic.trim() ? { cnic: sp.cnic.trim() } : {}),
        children: sp.children.map((c): ChildPayload => ({ ...withId(c.id), full_name: nn(c.full_name), birth_date: nn(c.birth_date) })),
      }));
    case "qualifications":
      return s.qualifications.map((q) => ({
        ...withId(q.id), institution: nn(q.institution), degree_program_id: idOrNull(q.degree_program),
        start_date: nn(q.start_date), end_date: nn(q.end_date), year: q.year ? Number(q.year) : null,
      }));
    case "work_experiences":
      return s.work_experiences.map((w): WorkExperiencePayload => ({
        ...withId(w.id),
        company_name: nn(w.company_name),
        designation: nn(w.designation),
        last_salary: w.last_salary ? Number(w.last_salary.replace(/,/g, "")) : null,
        country_id: idOrNull(w.country),
        state_id: idOrNull(w.state),
        city_id: idOrNull(w.city),
        period_from: nn(w.period_from),
        period_to: nn(w.period_to),
        contact_person_name: nn(w.contact_person_name),
        contact_person_email: nn(w.contact_person_email),
        contact_person_phone: nn(w.contact_person_phone),
        ...(w.letterPending ? { experience_letter_upload_id: w.letterPending.upload.id } : w.letterRemoved ? { experience_letter_upload_id: null } : {}),
        reason_for_leaving: nn(w.reason_for_leaving),
        description: nn(w.description),
      }));
    case "documents":
      return s.documents.map((d) => ({ ...withId(d.id), title: nn(d.title), ...(d.pending ? { upload_id: d.pending.upload.id } : {}) }));
  }
}

/** The payload entries one form key produces. Empty = "send nothing". */
function entries(key: FormKey, s: FormState): [string, unknown][] {
  switch (key) {
    case "avatar":
      return s.avatar.pending ? [["avatar_upload_id", s.avatar.pending.upload.id]] : s.avatar.removed ? [["avatar_upload_id", null]] : [];
    case "country":
    case "state":
    case "city":
    case "nationality":
      return [[`${key}_id`, idOrNull(s[key])]];
    case "reports_to":
    case "indirect_reports_to":
      return [[`${key}_id`, idOrNull(s[key])]];
    case "has_team_authority":
    case "remote_access":
    case "permanent_remote_access":
    case "has_work_experience":
      return [[key, s[key]]];
    case "work_experiences":
      // Only allowed while the toggle is on; turning it off deletes them server-side.
      return s.has_work_experience ? [[key, serializeList(key, s)]] : [];
    case "spouses":
    case "qualifications":
    case "documents":
      return [[key, serializeList(key, s)]];
    default: {
      const v = s[key];
      if (isSecret(key)) return v.trim() ? [[key, v.trim()]] : [];
      if (ID_KEYS.has(key)) return [[key, v ? Number(v) : null]];
      return [[key, nn(v)]];
    }
  }
}

/** Changed keys of one section, ready to PATCH. Empty object = nothing to save. */
export function sectionPayload(section: SectionId, current: FormState, baseline: FormState): EmployeePayload {
  const out: Record<string, unknown> = {};
  for (const key of SECTION_KEYS[section]) {
    const cur = entries(key, current);
    if (JSON.stringify(cur) !== JSON.stringify(entries(key, baseline))) for (const [k, v] of cur) out[k] = v;
  }
  return out as EmployeePayload;
}

export const isSectionDirty = (section: SectionId, current: FormState, baseline: FormState) => Object.keys(sectionPayload(section, current, baseline)).length > 0;

/* ---------- save response → state ---------- */

function keepKeys<T extends { key: string }>(fresh: T[], prev: T[]): T[] {
  return fresh.map((row, i) => (prev[i] ? { ...row, key: prev[i]!.key } : row));
}

/**
 * Applies a save response to one section. Keys the user changed again while the
 * request was in flight keep their newer local value (still dirty afterwards).
 */
export function mergeSection(section: SectionId, current: FormState, sent: FormState, fresh: FormState): FormState {
  const next = { ...current } as Record<FormKey, unknown>;
  for (const key of SECTION_KEYS[section]) {
    if (current[key] !== sent[key]) continue;
    if (key === "spouses") {
      next.spouses = keepKeys(fresh.spouses, current.spouses).map((sp, i) => ({ ...sp, children: keepKeys(sp.children, current.spouses[i]?.children ?? []) }));
    } else if (key === "qualifications" || key === "work_experiences" || key === "documents") {
      next[key] = keepKeys(fresh[key] as { key: string }[], current[key] as { key: string }[]);
    } else {
      next[key] = fresh[key];
    }
  }
  return next as FormState;
}

/* ---------- labels, sections and DOM ids for API keys ---------- */

const TOP_LABELS: Record<string, string> = {
  avatar: "Profile picture", salutation: "Salutation", first_name: "First name", middle_name: "Middle name", last_name: "Last name",
  pseudo_name: "Pseudo name", father_husband_name: "Father / husband name", gender: "Gender", birth_date: "Date of birth", cnic: "CNIC",
  cnic_expiry: "CNIC expiry", personal_email: "Personal email", country_id: "Country", state_id: "State / province", city_id: "City",
  nationality_id: "Nationality", marital_status: "Marital status", religion: "Religion", blood_group: "Blood group",
  division_id: "Division", email: "Business email", department_id: "Department", designation_id: "Designation", employment_status_id: "Employment status",
  shift_id: "Shift", duty_type: "Duty type", work_mode: "Work mode", campaign_id: "Campaign", location_id: "Location", machine_uid: "Machine UID",
  probation_start_date: "Probation start", probation_duration_id: "Probation duration", confirmation_date: "Confirmation date",
  join_date: "Date of joining", separation_date: "Separation date", resigned_date: "Resigned date", last_working_day: "Last working day", reason_for_resignation: "Reason for resignation", reports_to_id: "Reporting authority",
  indirect_reports_to_id: "Indirect reporting authority", has_team_authority: "Team authority", remote_access: "Remote access",
  permanent_remote_access: "Permanent remote access", remote_access_from: "Remote access from", remote_access_until: "Remote access till",
  phone: "Primary contact number", secondary_phone: "Secondary number", landline: "Landline", permanent_address: "Permanent address",
  present_address: "Present address", emergency_contact_name: "Emergency contact name", emergency_contact_phone: "Emergency contact number",
  emergency_contact_relation: "Emergency contact relation", passport_no: "Passport number", passport_expiry: "Passport expiry",
  driving_license_no: "Driving licence number", driving_license_expiry: "Driving licence expiry", has_work_experience: "Has work experience",
  work_experiences: "Work experience", spouses: "Spouses", qualifications: "Qualifications", documents: "Documents",
};

const ROW_LABELS: Record<string, string> = {
  full_name: "Full name", cnic: "CNIC", birth_date: "Date of birth", institution: "University / college", degree_program_id: "Degree program",
  start_date: "Start date", end_date: "End date", year: "Year", company_name: "Company", designation: "Designation", last_salary: "Last salary",
  country_id: "Country", state_id: "State", city_id: "City", period_from: "From", period_to: "To", contact_person_name: "Contact person",
  contact_person_email: "Contact email", contact_person_phone: "Contact number", experience_letter: "Experience letter",
  reason_for_leaving: "Reason for leaving", description: "Description", title: "Title", upload_id: "File",
};

/** Error/missing keys use the API's names; a couple are folded onto the control that owns them. */
export function normalizeKey(key: string) {
  return key.replace(/experience_letter_upload_id$/, "experience_letter").replace(/^avatar_upload_id$/, "avatar");
}

export function labelFor(key: string): string {
  const parts = key.split(".");
  const field = (f: string | undefined) => (f ? ROW_LABELS[f] ?? f.replace(/_/g, " ") : "");
  if (parts[0] === "spouses" && parts.length >= 3) {
    const sp = `Spouse ${Number(parts[1]) + 1}`;
    if (parts[2] === "children" && parts.length >= 5) return `${sp} · Child ${Number(parts[3]) + 1} · ${field(parts[4])}`;
    return `${sp} · ${field(parts[2])}`;
  }
  const lists: Record<string, string> = { qualifications: "Qualification", work_experiences: "Experience", documents: "Document" };
  if (lists[parts[0]!] && parts.length >= 3) return `${lists[parts[0]!]} ${Number(parts[1]) + 1} · ${field(parts[2])}`;
  return TOP_LABELS[parts[0]!] ?? parts[0]!.replace(/_/g, " ");
}

const API_TO_SECTION: Record<string, SectionId> = {};
for (const s of SECTIONS) {
  for (const k of SECTION_KEYS[s.id]) {
    const api = k === "country" || k === "state" || k === "city" || k === "nationality" || k === "reports_to" || k === "indirect_reports_to" ? `${k}_id` : k;
    API_TO_SECTION[api] = s.id;
  }
}

export function sectionOf(key: string): SectionId {
  return API_TO_SECTION[key.split(".")[0]!] ?? "personal";
}

export const fieldId = (key: string) => `ef-${key.replace(/\./g, "-")}`;

/* ---------- completeness ---------- */

export const REQUIRED = new Set(["first_name", "last_name", "email", "cnic", "department_id", "designation_id", "employment_status_id", "duty_type", "join_date"]);

const EXP_REQUIRED: (keyof ExpRow | "country_id" | "state_id" | "city_id" | "experience_letter")[] = [
  "company_name", "designation", "last_salary", "country_id", "state_id", "city_id", "period_from", "period_to",
  "contact_person_name", "contact_person_email", "contact_person_phone", "experience_letter", "reason_for_leaving",
];

export type Completeness = { missing: Record<string, string>; total: number };

/**
 * What still blocks "Submit", computed live from the form (so it updates as you
 * type) and topped up with any extra keys the server reported.
 */
/** The exit fields are needed only while the chosen status is a notice-period one. */
export const EXIT_FIELDS = ["resigned_date", "last_working_day", "reason_for_resignation"] as const;

export function completeness(s: FormState, detail: EmployeeDetail | null, noticeStatusIds: ReadonlySet<number> = new Set()): Completeness {
  const missing: Record<string, string> = {};
  let total = 0;
  const check = (key: string, filled: boolean, message?: string) => {
    total += 1;
    if (!filled) missing[key] = message ?? `${labelFor(key)} is required`;
  };
  const has = (v: string) => v.trim() !== "";

  for (const k of REQUIRED) {
    if (k === "cnic") check(k, has(s.cnic) || !!detail?.cnic_masked);
    else check(k, has(s[k as StrKey]));
  }
  if (s.employment_status_id && noticeStatusIds.has(Number(s.employment_status_id))) {
    for (const k of EXIT_FIELDS) check(k, has(s[k]));
  }
  if (s.remote_access) {
    check("remote_access_from", has(s.remote_access_from));
    if (!s.permanent_remote_access) check("remote_access_until", has(s.remote_access_until), "Remote access till is required unless access is permanent");
  }
  s.spouses.forEach((sp, i) => {
    check(`spouses.${i}.full_name`, has(sp.full_name));
    sp.children.forEach((c, j) => check(`spouses.${i}.children.${j}.full_name`, has(c.full_name)));
  });
  s.qualifications.forEach((q, i) => {
    check(`qualifications.${i}.institution`, has(q.institution));
    check(`qualifications.${i}.degree_program_id`, !!q.degree_program);
  });
  if (s.has_work_experience) {
    check("work_experiences", s.work_experiences.length > 0, "Add at least one work experience, or switch it off");
    s.work_experiences.forEach((w, i) => {
      for (const f of EXP_REQUIRED) {
        const filled =
          f === "country_id" ? !!w.country : f === "state_id" ? !!w.state : f === "city_id" ? !!w.city
          : f === "experience_letter" ? !!w.letterPending || (!!w.letter && !w.letterRemoved)
          : has(String(w[f] ?? ""));
        check(`work_experiences.${i}.${f}`, filled);
      }
    });
  }
  s.documents.forEach((d, i) => !d.file && check(`documents.${i}.upload_id`, !!d.pending, "Choose a file"));

  // Unknown top-level rules the server may add later.
  for (const [k, msgs] of Object.entries(detail?.missing_fields ?? {})) {
    if (k.includes(".") || k in missing || TOP_LABELS[k] === undefined) continue;
    const fk = (k.endsWith("_id") && !(STR_KEYS as readonly string[]).includes(k) ? k.slice(0, -3) : k) as FormKey;
    const v = s[fk];
    if (v === null || v === undefined || v === "" || v === false) missing[k] = msgs[0] ?? `${labelFor(k)} is required`;
  }
  return { missing, total: Math.max(total, Object.keys(missing).length) };
}

/** Maps a 422 body onto normalized field keys. */
export function mapErrors(errors: Record<string, string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, msgs] of Object.entries(errors)) if (msgs[0]) out[normalizeKey(k)] = msgs[0];
  return out;
}

export function firstSectionWith(keys: string[]): SectionId | null {
  for (const s of SECTIONS) if (keys.some((k) => sectionOf(k) === s.id)) return s.id;
  return null;
}

/** Checks the server would reject, shown inline before saving. */
export function clientErrors(s: FormState): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.resigned_date && s.last_working_day && s.last_working_day < s.resigned_date) out.last_working_day = "Can't be before the resigned date";
  return out;
}
