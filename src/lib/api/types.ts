/* Exact response shapes of the Laravel API (v1). */

export type IdName = { id: number; name: string };
export type EmployeeStatus = "active" | "probation" | "on_leave" | "notice_period" | "inactive";
export type WorkMode = "onsite" | "hybrid" | "remote";
export type Gender = "male" | "female" | "other";
export type ShiftRef = { id: number; name: string; start: string; end: string };

export const PERMISSIONS = [
  "employees.view",
  "employees.create",
  "employees.update",
  "employees.delete",
  "employees.export",
  "employees.view-sensitive",
  "employees.reset-2fa",
  "employees.unbind-device",
  "employees.import",
  "divisions.manage",
  "degree-programs.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface User {
  id: number;
  name: string;
  email: string;
  employee_id: number | null;
  two_factor_enabled: boolean;
  roles: string[];
  permissions: string[];
}

export interface EmployeeListItem {
  id: number;
  code: string;
  machine_uid: string | null;
  name: string;
  pseudo_name: string | null;
  email: string;
  avatar_url: string | null;
  designation: IdName | null;
  department: IdName | null;
  status: EmployeeStatus;
  work_mode: WorkMode;
  shift: ShiftRef | null;
  campaign: IdName | null;
  location: IdName | null;
  join_date: string;
  two_factor_enabled: boolean;
  device_bound: boolean;
  can: { update: boolean; delete: boolean; reset_2fa: boolean; unbind_device: boolean };
}

export interface EmployeeSummary {
  id: number;
  name: string;
  designation: IdName | null;
  avatar_url: string | null;
}

export interface EmployeeProfile extends EmployeeListItem {
  phone: string | null;
  gender: Gender | null;
  birthday: string | null;
  reports_to: EmployeeSummary | null;
  direct_reports: EmployeeSummary[];
  employment: { join_date: string; status: EmployeeStatus };
  attendance_rate: null;
  leave_balances: null;
}

export interface EmployeeSensitive {
  employee_id: number;
  cnic: string | null;
  passport_no: string | null;
  driving_license_no: string | null;
  spouses: { id: number; cnic: string | null }[];
}

export interface EmployeeListResponse {
  data: EmployeeListItem[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  status_counts: Record<"all" | EmployeeStatus, number>;
}

export interface EmployeeFilters {
  departments: IdName[];
  designations: (IdName & { department_id: number | null })[];
  divisions: IdName[];
  campaigns: IdName[];
  shifts: ShiftRef[];
  locations: IdName[];
  statuses: { value: EmployeeStatus; label: string }[];
  work_modes: { value: WorkMode; label: string }[];
}

export interface BoundDevice {
  device_id: string;
  model: string;
  platform: "android" | "ios";
  bound_at: string;
}

export type BulkDeleteFailure = { id: number; reason: "not_found" | "cannot_delete_self" | "forbidden" };
export interface BulkDeleteResponse {
  deleted: number[];
  failed: BulkDeleteFailure[];
}

export type EmployeeSort = "name" | "-name" | "join_date" | "-join_date" | "department" | "-department" | "code" | "-code";

export interface EmployeeQuery {
  search?: string;
  status?: EmployeeStatus[];
  department_id?: number[];
  designation_id?: number[];
  division_id?: number[];
  campaign_id?: number[];
  shift_id?: number[];
  location_id?: number[];
  work_mode?: WorkMode[];
  sort?: EmployeeSort;
  page?: number;
  per_page?: number;
}

/* ---------- employee form: reference data ---------- */

export type Option<V extends string = string> = { value: V; label: string };

export type Salutation = "mr" | "mrs" | "ms" | "miss" | "dr" | "prof" | "engr";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed" | "separated";
export type Religion = "islam" | "christianity" | "hinduism" | "sikhism" | "buddhism" | "judaism" | "other" | "prefer_not_to_say";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type DutyType = "full_time" | "part_time" | "contract" | "freelance" | "internship" | "temporary" | "consultant";
export type EmergencyRelation = "father" | "mother" | "spouse" | "brother" | "sister" | "son" | "daughter" | "guardian" | "relative" | "friend" | "other";

export interface FormOptions {
  salutations: Option<Salutation>[];
  genders: Option<Gender>[];
  marital_statuses: Option<MaritalStatus>[];
  religions: Option<Religion>[];
  blood_groups: Option<BloodGroup>[];
  employment_statuses: Option<EmployeeStatus>[];
  duty_types: Option<DutyType>[];
  work_modes: Option<WorkMode>[];
  emergency_contact_relations: Option<EmergencyRelation>[];
  probation_durations: { id: number; name: string; months: number }[];
  degree_programs: IdName[];
  departments: IdName[];
  designations: (IdName & { department_id: number | null })[];
  divisions: IdName[];
  campaigns: IdName[];
  shifts: ShiftRef[];
  locations: IdName[];
}

export interface Country { id: number; name: string; iso2: string; iso3: string; phone_code: string | null; emoji: string | null }
export interface GeoState { id: number; country_id: number; name: string; code: string | null }
export interface City { id: number; state_id: number; name: string }
export interface Paginated<T> { data: T[]; meta: { current_page: number; last_page: number; per_page: number; total: number } }

/** Country as embedded in EmployeeDetail. */
export type CountryRef = { id: number; name: string; iso2: string; phone_code: string | null };

/* ---------- employee form: EmployeeDetail ---------- */

export interface FileRef { name: string; mime_type: string; size: number; download_url: string }

export interface ChildDetail { id: number; full_name: string | null; birth_date: string | null }
export interface SpouseDetail { id: number; full_name: string | null; cnic_masked: string | null; birth_date: string | null; children: ChildDetail[] }
export interface QualificationDetail {
  id: number;
  institution: string | null;
  degree_program_id: number | null;
  degree_program: IdName | null;
  start_date: string | null;
  end_date: string | null;
  year: number | null;
}
export interface WorkExperienceDetail {
  id: number;
  company_name: string | null;
  designation: string | null;
  /** Decimal string, e.g. "150000.00". */
  last_salary: string | null;
  country_id: number | null;
  country: CountryRef | null;
  state_id: number | null;
  state: IdName | null;
  city_id: number | null;
  city: IdName | null;
  period_from: string | null;
  period_to: string | null;
  contact_person_name: string | null;
  contact_person_email: string | null;
  contact_person_phone: string | null;
  experience_letter: FileRef | null;
  reason_for_leaving: string | null;
  description: string | null;
}
export interface DocumentDetail { id: number; title: string | null; name: string; mime_type: string; size: number; uploaded_at: string; download_url: string }

export interface EmployeeDetail {
  id: number;
  code: string | null;
  is_draft: boolean;
  created_by: IdName | null;
  created_at: string;
  updated_at: string;
  avatar_url: string | null;
  name: string | null;
  // Personal
  salutation: Salutation | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  pseudo_name: string | null;
  father_husband_name: string | null;
  gender: Gender | null;
  birth_date: string | null;
  cnic_masked: string | null;
  cnic_expiry: string | null;
  personal_email: string | null;
  country_id: number | null;
  country: CountryRef | null;
  state_id: number | null;
  state: IdName | null;
  city_id: number | null;
  city: IdName | null;
  nationality_id: number | null;
  nationality: IdName | null;
  marital_status: MaritalStatus | null;
  religion: Religion | null;
  blood_group: BloodGroup | null;
  // Positional
  machine_uid: string | null;
  email: string | null;
  department_id: number | null;
  designation_id: number | null;
  division_id: number | null;
  campaign_id: number | null;
  shift_id: number | null;
  location_id: number | null;
  work_mode: WorkMode | null;
  status: EmployeeStatus | null;
  duty_type: DutyType | null;
  join_date: string | null;
  probation_start_date: string | null;
  probation_duration_id: number | null;
  probation_end_date: string | null;
  confirmation_date: string | null;
  separation_date: string | null;
  reports_to_id: number | null;
  reports_to: EmployeeSummary | null;
  indirect_reports_to_id: number | null;
  indirect_reports_to: EmployeeSummary | null;
  has_team_authority: boolean;
  remote_access: boolean;
  permanent_remote_access: boolean;
  remote_access_from: string | null;
  remote_access_until: string | null;
  // Contact (phones are E.164)
  phone: string | null;
  secondary_phone: string | null;
  landline: string | null;
  permanent_address: string | null;
  present_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: EmergencyRelation | null;
  // Other
  passport_no_masked: string | null;
  passport_expiry: string | null;
  driving_license_no_masked: string | null;
  driving_license_expiry: string | null;
  // Lists
  spouses: SpouseDetail[];
  qualifications: QualificationDetail[];
  has_work_experience: boolean;
  work_experiences: WorkExperienceDetail[];
  documents: DocumentDetail[];
  /** Draft only: what still blocks submit, `{ field: [message] }`. `{}` for real employees. */
  missing_fields: Record<string, string[]>;
}

/* ---------- employee form: write payload (POST /employees/drafts, PATCH /employees/{id}) ---------- */

export interface ChildPayload { id?: number; full_name: string | null; birth_date: string | null }
export interface SpousePayload { id?: number; full_name: string | null; birth_date: string | null; cnic?: string; children: ChildPayload[] }
export interface QualificationPayload {
  id?: number;
  institution: string | null;
  degree_program_id: number | null;
  start_date: string | null;
  end_date: string | null;
  year: number | null;
}
export interface WorkExperiencePayload {
  id?: number;
  company_name: string | null;
  designation: string | null;
  last_salary: number | null;
  country_id: number | null;
  state_id: number | null;
  city_id: number | null;
  period_from: string | null;
  period_to: string | null;
  contact_person_name: string | null;
  contact_person_email: string | null;
  contact_person_phone: string | null;
  /** Omit to keep the stored letter; `null` removes it. */
  experience_letter_upload_id?: string | null;
  reason_for_leaving: string | null;
  description: string | null;
}
export interface DocumentPayload { id?: number; title: string | null; upload_id?: string }

/** Every key optional: PATCH changes only what is sent and `null` clears. Lists replace the whole list. */
export interface EmployeePayload {
  avatar_upload_id?: string | null;
  salutation?: Salutation | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  pseudo_name?: string | null;
  father_husband_name?: string | null;
  gender?: Gender | null;
  birth_date?: string | null;
  /** Send only when the user typed a new value. */
  cnic?: string;
  cnic_expiry?: string | null;
  personal_email?: string | null;
  country_id?: number | null;
  state_id?: number | null;
  city_id?: number | null;
  nationality_id?: number | null;
  marital_status?: MaritalStatus | null;
  religion?: Religion | null;
  blood_group?: BloodGroup | null;
  division_id?: number | null;
  email?: string | null;
  department_id?: number | null;
  designation_id?: number | null;
  status?: EmployeeStatus | null;
  shift_id?: number | null;
  duty_type?: DutyType | null;
  work_mode?: WorkMode | null;
  campaign_id?: number | null;
  location_id?: number | null;
  machine_uid?: string | null;
  probation_start_date?: string | null;
  probation_duration_id?: number | null;
  confirmation_date?: string | null;
  join_date?: string | null;
  separation_date?: string | null;
  reports_to_id?: number | null;
  indirect_reports_to_id?: number | null;
  has_team_authority?: boolean;
  remote_access?: boolean;
  permanent_remote_access?: boolean;
  remote_access_from?: string | null;
  remote_access_until?: string | null;
  phone?: string | null;
  secondary_phone?: string | null;
  landline?: string | null;
  permanent_address?: string | null;
  present_address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: EmergencyRelation | null;
  passport_no?: string;
  passport_expiry?: string | null;
  driving_license_no?: string;
  driving_license_expiry?: string | null;
  spouses?: SpousePayload[];
  qualifications?: QualificationPayload[];
  has_work_experience?: boolean;
  work_experiences?: WorkExperiencePayload[];
  documents?: DocumentPayload[];
}

export interface DraftListItem {
  id: number;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  department: IdName | null;
  designation: IdName | null;
  created_by: IdName | null;
  created_at: string;
  updated_at: string;
}

/* ---------- uploads ---------- */

export type UploadPurpose = "avatar" | "experience_letter" | "document";
export interface Upload { id: string; purpose: UploadPurpose; original_name: string; mime_type: string; size: number; expires_at: string }

/* ---------- admin lookups ---------- */

export interface Division { id: number; name: string; employees_count: number }
export interface DegreeProgram { id: number; name: string; qualifications_count: number }

/* ---------- bulk import ---------- */

export type ImportDryRunResponse = { message: string; dry_run: true; total_rows: number };
export type ImportCommitResponse = { message: string; dry_run: false; imported: number; employee_ids: number[] };
/** One row-level problem; `line` is the spreadsheet line (header = line 1). */
export type ImportRowError = { line: number; column: string; messages: string[] };
