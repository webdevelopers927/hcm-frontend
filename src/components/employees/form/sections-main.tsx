"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Camera, Copy, Hourglass, Loader2, Lock, ScrollText, Trash2, UserMinus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar, Button } from "@/components/ui/primitives";
import { formatCnicInput, hueFor, shiftLabel } from "@/lib/api/display";
import { employeeKeys, geoKeys, listEmployees, listNationalities, listStates, searchCities } from "@/lib/api/employees";
import type { Country, EmployeeDetail, ExitType, OffboardingStage, EmployeeSensitive, EmployeeSummary, FormOptions } from "@/lib/api/types";
import { cn, formatDate } from "@/lib/utils";
import { ConfirmDialog } from "../api-ui";
import { Combobox, F, FilePicker, SecretInput, Segmented, SelectInput, Switch, TextArea, TextInput, uploadHint, useUploader } from "./controls";
import { type CountryPick, type FormKey, type FormState, type SecretKey } from "./model";

export type Reveal = { data: EmployeeSensitive | null; loading: boolean; left: number; reveal: () => void; hide: () => void; allowed: boolean };

export type SectionProps = {
  form: FormState;
  set: <K extends FormKey>(key: K, value: FormState[K], clear?: string[]) => void;
  patch: (p: Partial<FormState>, clear?: string[]) => void;
  clearErrors: (prefix: string) => void;
  options: FormOptions;
  countries: Country[];
  detail: EmployeeDetail | null;
  employeeId: number | null;
  reveal: Reveal;
  missing: Record<string, string>;
};

const today = () => new Date().toISOString().slice(0, 10);

export function Group({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-[13px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const opts = (list: { value: string; label: string }[]) => list;
const idOpts = (list: { id: number; name: string }[]) => list.map((x) => ({ value: String(x.id), label: x.name }));

/** Dial code for a country chosen in the form (embedded ref or the loaded list). */
export function dialCode(country: CountryPick | null, countries: Country[]) {
  if (!country) return null;
  return country.phone_code ?? countries.find((c) => c.id === country.id)?.phone_code ?? null;
}

export function CountryOption({ c, countries }: { c: { id: number; name: string }; countries: Country[] }) {
  const full = countries.find((x) => x.id === c.id);
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden>{full?.emoji}</span>
      <span className="flex-1 truncate">{c.name}</span>
      {full?.phone_code && <span className="tabular text-[12px] text-ink-3">+{full.phone_code}</span>}
    </span>
  );
}

/** Country → state → city, each clearing the levels below it. */
export function GeoFields({
  prefix,
  country,
  state,
  city,
  countries,
  onCountry,
  onState,
  onCity,
}: {
  prefix: string;
  country: CountryPick | null;
  state: { id: number; name: string } | null;
  city: { id: number; name: string } | null;
  countries: Country[];
  onCountry: (c: CountryPick | null) => void;
  onState: (s: { id: number; name: string } | null) => void;
  onCity: (c: { id: number; name: string } | null) => void;
}) {
  const states = useQuery({
    queryKey: geoKeys.states(country?.id ?? 0),
    queryFn: ({ signal }) => listStates(country!.id, signal),
    enabled: !!country,
    staleTime: Infinity,
  });
  return (
    <>
      <Combobox
        name={`${prefix}country_id`}
        label="Country"
        value={country}
        items={countries}
        loading={countries.length === 0}
        onChange={(c) => onCountry(c ? { id: c.id, name: c.name, phone_code: c.phone_code } : null)}
        renderOption={(c) => <CountryOption c={c} countries={countries} />}
        placeholder="Search countries"
      />
      <Combobox
        name={`${prefix}state_id`}
        label="State / province"
        value={state}
        items={states.data ?? []}
        loading={states.isFetching}
        disabled={!country}
        onChange={onState}
        placeholder={country ? "Search states" : "Pick a country first"}
      />
      <Combobox
        name={`${prefix}city_id`}
        label="City"
        value={city}
        search={state ? { key: ["geo", "cities", state.id], fn: (term, signal) => searchCities(state.id, term, signal) } : undefined}
        disabled={!state}
        onChange={onCity}
        placeholder={state ? "Type to search cities" : "Pick a state first"}
        emptyText="No cities match"
      />
    </>
  );
}

/* ---------------- 1. Personal ---------------- */

export function PersonalSection(p: SectionProps) {
  const { form, set, patch, options, countries, detail, reveal } = p;
  const nationalities = useQuery({ queryKey: geoKeys.nationalities, queryFn: ({ signal }) => listNationalities(signal), staleTime: Infinity, gcTime: Infinity });
  const uploader = useUploader("avatar");
  const preview = form.avatar.pending?.preview ?? (form.avatar.removed ? null : detail?.avatar_url ?? null);
  const name = [form.first_name, form.last_name].filter(Boolean).join(" ") || "New hire";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-2/60 p-4 sm:flex-row sm:items-center" id="ef-avatar" tabIndex={-1}>
        <div className="relative">
          <Avatar name={name} hue={hueFor(p.employeeId ?? name.length)} src={preview} size="xl" />
          {uploader.busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </span>
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-ink">Profile picture</div>
          <p className="text-[12px] text-ink-3">{uploadHint("avatar")}. Shown on their profile and in the directory.</p>
          {form.avatar.pending && <p className="mt-1 text-[12px] font-medium text-warn">New picture: saved with your next save</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <FilePicker
              purpose="avatar"
              onFile={async (f) => {
                const up = await uploader.upload(f);
                if (up) {
                  if (form.avatar.pending?.preview) URL.revokeObjectURL(form.avatar.pending.preview);
                  set("avatar", { pending: up, removed: false }, ["avatar"]);
                }
              }}
            >
              {(open) => (
                <Button size="sm" variant="secondary" onClick={open} disabled={uploader.busy}>
                  <Camera className="h-3.5 w-3.5" /> {preview ? "Change" : "Upload"}
                </Button>
              )}
            </FilePicker>
            {preview && (
              <Button size="sm" variant="ghost" onClick={() => set("avatar", { pending: null, removed: !!detail?.avatar_url })}>
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <Group title="Name">
        <SelectInput name="salutation" label="Salutation" value={form.salutation} onChange={(v) => set("salutation", v)} options={opts(options.salutations)} />
        <TextInput name="pseudo_name" label="Pseudo name" value={form.pseudo_name} onChange={(v) => set("pseudo_name", v)} maxLength={100} hint="Optional" />
        <TextInput name="first_name" label="First name" value={form.first_name} onChange={(v) => set("first_name", v)} maxLength={100} />
        <TextInput name="middle_name" label="Middle name" value={form.middle_name} onChange={(v) => set("middle_name", v)} maxLength={100} />
        <TextInput name="last_name" label="Last name" value={form.last_name} onChange={(v) => set("last_name", v)} maxLength={100} />
        <TextInput name="father_husband_name" label="Father / husband name" value={form.father_husband_name} onChange={(v) => set("father_husband_name", v)} maxLength={200} />
      </Group>

      <Group title="Identity">
        <SecretInput
          name="cnic"
          label="CNIC"
          masked={detail?.cnic_masked ?? null}
          revealed={reveal.data?.cnic}
          value={form.cnic}
          onChange={(v) => set("cnic", v)}
          onReveal={reveal.allowed ? reveal.reveal : undefined}
          onHide={reveal.hide}
          revealing={reveal.loading}
          format={formatCnicInput}
          inputMode="numeric"
          placeholder="35202-1234567-1"
        />
        <TextInput name="cnic_expiry" label="CNIC expiry" type="date" value={form.cnic_expiry} onChange={(v) => set("cnic_expiry", v)} />
        <TextInput name="birth_date" label="Date of birth" type="date" value={form.birth_date} onChange={(v) => set("birth_date", v)} max={today()} />
        <TextInput name="personal_email" label="Personal email" type="email" value={form.personal_email} onChange={(v) => set("personal_email", v)} placeholder="name@gmail.com" />
        <Segmented name="gender" label="Gender" value={form.gender} onChange={(v) => set("gender", v)} options={opts(options.genders)} className="sm:col-span-2" />
      </Group>

      <Group title="Origin" description="Phone numbers in Contact are checked against this country.">
        <GeoFields
          prefix=""
          country={form.country}
          state={form.state}
          city={form.city}
          countries={countries}
          onCountry={(c) => patch({ country: c, state: null, city: null }, ["country_id", "state_id", "city_id"])}
          onState={(s) => patch({ state: s, city: null }, ["state_id", "city_id"])}
          onCity={(c) => set("city", c)}
        />
        <Combobox
          name="nationality_id"
          label="Nationality"
          value={form.nationality}
          items={nationalities.data ?? []}
          loading={nationalities.isPending}
          onChange={(v) => set("nationality", v)}
          placeholder="e.g. Pakistani"
        />
      </Group>

      <Group title="Background">
        <SelectInput name="marital_status" label="Marital status" value={form.marital_status} onChange={(v) => set("marital_status", v)} options={opts(options.marital_statuses)} />
        <SelectInput name="religion" label="Religion" value={form.religion} onChange={(v) => set("religion", v)} options={opts(options.religions)} />
        <SelectInput name="blood_group" label="Blood group" value={form.blood_group} onChange={(v) => set("blood_group", v)} options={opts(options.blood_groups)} />
      </Group>
    </div>
  );
}

/* ---------------- 2. Positional ---------------- */

const EXIT_TYPE_LABEL: Record<ExitType, string> = { resignation: "Resignation", termination: "Termination", contract_end: "Contract end", retirement: "Retirement" };
const STAGE_LABEL: Record<OffboardingStage, string> = { resigned: "Resigned", notice_period: "Notice period", clearance: "Clearance", completed: "Completed" };

function PersonPicker({ name, label, value, onChange, exclude, hint }: { name: string; label: string; value: EmployeeSummary | null; onChange: (v: EmployeeSummary | null) => void; exclude: number[]; hint?: string }) {
  return (
    <Combobox<EmployeeSummary>
      name={name}
      label={label}
      value={value}
      onChange={onChange}
      hint={hint}
      placeholder="Search by name, code or email"
      search={{
        key: [...employeeKeys.all, "picker", exclude.join(",")],
        fn: (term, signal) =>
          listEmployees({ search: term || undefined, per_page: 20 }, signal).then((r) =>
            r.data.filter((e) => !exclude.includes(e.id)).map((e) => ({ id: e.id, name: e.name, designation: e.designation, avatar_url: e.avatar_url })),
          ),
      }}
      renderValue={value ? <Avatar name={value.name} hue={hueFor(value.id)} src={value.avatar_url} size="xs" /> : null}
      renderOption={(e) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={e.name} hue={hueFor(e.id)} src={e.avatar_url} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium text-ink">{e.name}</span>
            <span className="block truncate text-[12px] text-ink-3">{e.designation?.name ?? "—"}</span>
          </span>
        </span>
      )}
      emptyText="Nobody matches"
    />
  );
}

/** Status select. Spells out what the chosen status means; on a real employee, asks before locking them out. */
function EmploymentStatusField({ form, set, options, detail }: Pick<SectionProps, "form" | "set" | "options" | "detail">) {
  const [pending, setPending] = useState<string | null>(null);
  const byId = (v: string) => options.employment_statuses.find((st) => String(st.id) === v);
  const chosen = byId(form.employment_status_id);
  const target = pending ? byId(pending) : undefined;
  const isReal = !!detail && !detail.is_draft;

  const change = (v: string) => {
    const next = byId(v);
    if (isReal && next && !next.can_login && (chosen?.can_login ?? true)) return setPending(v);
    set("employment_status_id", v);
  };

  return (
    <>
      <SelectInput
        name="employment_status_id"
        label="Employment status"
        value={form.employment_status_id}
        onChange={change}
        options={options.employment_statuses.map((st) => ({ value: String(st.id), label: st.name }))}
        footer={
          chosen && !chosen.can_login ? (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-bad"><Lock className="h-3 w-3" /> This person won&apos;t be able to sign in</p>
          ) : chosen?.is_notice_period ? (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-warn"><Hourglass className="h-3 w-3" /> Serving notice</p>
          ) : null
        }
      />
      {pending && target && (
        <ConfirmDialog
          title={`Move to “${target.name}”?`}
          body={<>{detail?.name ?? "This person"} will be signed out everywhere when you save, and won&apos;t be able to sign in while in this status.</>}
          confirmLabel="Change status"
          danger
          onCancel={() => setPending(null)}
          onConfirm={() => {
            set("employment_status_id", pending);
            setPending(null);
          }}
        />
      )}
    </>
  );
}

export function PositionalSection(p: SectionProps) {
  const { form, set, patch, options, detail, employeeId } = p;
  const designations = options.designations.filter((d) => !form.department_id || d.department_id === null || String(d.department_id) === form.department_id);
  const probationChanged = detail && (form.probation_start_date !== (detail.probation_start_date ?? "") || form.probation_duration_id !== String(detail.probation_duration_id ?? ""));
  const self = employeeId ? [employeeId] : [];
  const onNotice = !!options.employment_statuses.find((st) => String(st.id) === form.employment_status_id)?.is_notice_period;

  return (
    <div className="space-y-8">
      {detail?.offboarding && (
        <Link
          href={`/employees/offboarding?case=${detail.offboarding.id}`}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2 p-4 transition hover:border-line-strong"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn"><UserMinus className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Being off-boarded · {EXIT_TYPE_LABEL[detail.offboarding.exit_type]}</span>
            <span className="block text-[13px] text-ink-3">Stage: {STAGE_LABEL[detail.offboarding.stage]}. Checklist and exit details live on the off-boarding case.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" />
        </Link>
      )}
      <Group title="Role">
        <TextInput name="email" label="Business email" type="email" value={form.email} onChange={(v) => set("email", v)} hint="Also their login email" placeholder="name@company.com" className="sm:col-span-2" />
        <SelectInput
          name="department_id"
          label="Department"
          value={form.department_id}
          options={idOpts(options.departments)}
          onChange={(v) => {
            const still = options.designations.find((d) => String(d.id) === form.designation_id);
            const keep = !still || still.department_id === null || String(still.department_id) === v;
            patch({ department_id: v, ...(keep ? {} : { designation_id: "" }) }, ["department_id", "designation_id"]);
          }}
        />
        <SelectInput name="designation_id" label="Designation" value={form.designation_id} onChange={(v) => set("designation_id", v)} options={idOpts(designations)} placeholder={form.department_id ? "Select…" : "Pick a department first"} />
        <SelectInput name="division_id" label="Division" value={form.division_id} onChange={(v) => set("division_id", v)} options={idOpts(options.divisions)} placeholder="None" />
        <SelectInput name="campaign_id" label="Campaign" value={form.campaign_id} onChange={(v) => set("campaign_id", v)} options={idOpts(options.campaigns)} placeholder="None" />
        <EmploymentStatusField form={form} set={set} options={options} detail={detail} />
        <SelectInput
          name="duty_type_id"
          label="Duty type"
          value={form.duty_type_id}
          onChange={(v) => set("duty_type_id", v)}
          options={options.duty_types.map((t) => ({ value: String(t.id), label: t.name, tag: t.is_contractual ? "Contractual" : undefined }))}
          footer={
            options.duty_types.find((t) => String(t.id) === form.duty_type_id)?.is_contractual ? (
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3"><ScrollText className="h-3 w-3" /> Contractual</p>
            ) : null
          }
        />
        <SelectInput name="shift_id" label="Shift" value={form.shift_id} onChange={(v) => set("shift_id", v)} options={options.shifts.map((s) => ({ value: String(s.id), label: shiftLabel(s) }))} placeholder="No shift" />
        <SelectInput name="location_id" label="Location" value={form.location_id} onChange={(v) => set("location_id", v)} options={idOpts(options.locations)} placeholder="Not set" />
        <TextInput name="machine_uid" label="Machine UID" value={form.machine_uid} onChange={(v) => set("machine_uid", v)} maxLength={50} hint="Attendance device ID" placeholder="e.g. 2400" />
        <Segmented name="work_mode" label="Work mode" value={form.work_mode} onChange={(v) => set("work_mode", v)} options={opts(options.work_modes)} />
      </Group>

      <Group title="Dates" description="Probation, confirmation and separation can't be before the joining date.">
        <TextInput name="join_date" label="Date of joining" type="date" value={form.join_date} onChange={(v) => set("join_date", v)} />
        <TextInput name="probation_start_date" label="Probation start" type="date" value={form.probation_start_date} onChange={(v) => set("probation_start_date", v)} min={form.join_date || undefined} />
        <SelectInput
          name="probation_duration_id"
          label="Probation duration"
          value={form.probation_duration_id}
          onChange={(v) => set("probation_duration_id", v)}
          options={options.probation_durations.map((d) => ({ value: String(d.id), label: d.name }))}
          placeholder="No probation"
        />
        <F name="probation_end_date" label="Probation ends" required={false}>
          {({ id }) => (
            <div id={id} className="flex h-11 items-center rounded-xl border border-dashed border-line bg-surface-2 px-3.5 text-sm text-ink-2">
              {probationChanged ? "Calculated when you save" : detail?.probation_end_date ? formatDate(detail.probation_end_date) : "—"}
            </div>
          )}
        </F>
        <TextInput name="confirmation_date" label="Confirmation date" type="date" value={form.confirmation_date} onChange={(v) => set("confirmation_date", v)} min={form.join_date || undefined} />
        <TextInput name="separation_date" label="Separation date" type="date" value={form.separation_date} onChange={(v) => set("separation_date", v)} min={form.join_date || undefined} />
        {onNotice && (
          <div className="animate-rise space-y-4 rounded-2xl border border-warn/30 bg-warn-soft/30 p-4 sm:col-span-2">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink"><Hourglass className="h-3.5 w-3.5 text-warn" /> Serving notice: these are needed</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput name="resigned_date" label="Resigned date" type="date" value={form.resigned_date} onChange={(v) => set("resigned_date", v)} min={form.join_date || undefined} required />
              <TextInput name="last_working_day" label="Last working day" type="date" value={form.last_working_day} onChange={(v) => set("last_working_day", v)} min={form.resigned_date || undefined} required />
              <TextArea name="reason_for_resignation" label="Reason for resignation" value={form.reason_for_resignation} onChange={(v) => set("reason_for_resignation", v)} maxLength={2000} required className="sm:col-span-2" />
            </div>
          </div>
        )}
      </Group>

      <Group title="Reporting" description="Only people with team authority can be picked as a reporting authority.">
        <PersonPicker
          name="reports_to_id"
          label="Reporting authority"
          value={form.reports_to}
          onChange={(v) => set("reports_to", v)}
          exclude={[...self, ...(form.indirect_reports_to ? [form.indirect_reports_to.id] : [])]}
        />
        <PersonPicker
          name="indirect_reports_to_id"
          label="Indirect reporting authority"
          value={form.indirect_reports_to}
          onChange={(v) => set("indirect_reports_to", v)}
          exclude={[...self, ...(form.reports_to ? [form.reports_to.id] : [])]}
          hint="Optional"
        />
        <div className="sm:col-span-2">
          <Switch name="has_team_authority" label="Has team authority" description="Lets others report to this person." checked={form.has_team_authority} onChange={(v) => set("has_team_authority", v)} />
        </div>
      </Group>

      <Group title="Remote access">
        <div className="space-y-3 sm:col-span-2">
          <Switch
            name="remote_access"
            label="Remote access"
            description="Allow attendance from outside the office."
            checked={form.remote_access}
            onChange={(v) =>
              patch(v ? { remote_access: true } : { remote_access: false, permanent_remote_access: false, remote_access_from: "", remote_access_until: "" }, ["remote_access", "remote_access_from", "remote_access_until"])
            }
          />
          {form.remote_access && (
            <div className="animate-rise space-y-3 border-l-2 border-line pl-4">
              <Switch
                name="permanent_remote_access"
                label="Permanent"
                description="No end date."
                checked={form.permanent_remote_access}
                onChange={(v) => patch({ permanent_remote_access: v, ...(v ? { remote_access_until: "" } : {}) }, ["permanent_remote_access", "remote_access_until"])}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput name="remote_access_from" label="From" type="date" value={form.remote_access_from} onChange={(v) => set("remote_access_from", v)} required />
                {!form.permanent_remote_access && (
                  <TextInput name="remote_access_until" label="Till" type="date" value={form.remote_access_until} onChange={(v) => set("remote_access_until", v)} min={form.remote_access_from || undefined} required />
                )}
              </div>
            </div>
          )}
        </div>
      </Group>
    </div>
  );
}

/* ---------------- 3. Contact ---------------- */

export function phoneHint(dial: string | null, countryName?: string) {
  return dial ? `${countryName ?? "Country"} · +${dial}` : "International format";
}
export function phonePlaceholder(dial: string | null) {
  return dial === "92" ? "0300 1234567" : dial ? `+${dial} …` : "+92 300 1234567";
}

export function ContactSection(p: SectionProps) {
  const { form, set, options, countries } = p;
  const dial = dialCode(form.country, countries);
  const hint = phoneHint(dial, form.country?.name);
  const ph = phonePlaceholder(dial);
  const same = form.present_address !== "" && form.present_address === form.permanent_address;

  return (
    <div className="space-y-8">
      {!form.country && (
        <p className="rounded-xl bg-info-soft px-3.5 py-2.5 text-[13px] text-info">
          No country picked in Personal, so numbers need the international format, e.g. +92 300 1234567.
        </p>
      )}
      <Group title="Phones">
        <TextInput name="phone" label="Primary contact number" type="tel" inputMode="tel" value={form.phone} onChange={(v) => set("phone", v)} hint={hint} placeholder={ph} />
        <TextInput name="secondary_phone" label="Secondary number" type="tel" inputMode="tel" value={form.secondary_phone} onChange={(v) => set("secondary_phone", v)} hint={hint} placeholder={ph} />
        <TextInput name="landline" label="Landline" type="tel" inputMode="tel" value={form.landline} onChange={(v) => set("landline", v)} hint={hint} placeholder={dial === "92" ? "042 35761234" : ph} />
      </Group>

      <Group title="Addresses">
        <TextArea name="permanent_address" label="Permanent address" value={form.permanent_address} onChange={(v) => set("permanent_address", v)} maxLength={500} className="sm:col-span-2" />
        <div className="space-y-2 sm:col-span-2">
          <TextArea name="present_address" label="Present address" value={form.present_address} onChange={(v) => set("present_address", v)} maxLength={500} />
          <button
            type="button"
            onClick={() => set("present_address", form.permanent_address)}
            disabled={!form.permanent_address || same}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" /> {same ? "Same as permanent" : "Same as permanent address"}
          </button>
        </div>
      </Group>

      <Group title="Emergency contact">
        <TextInput name="emergency_contact_name" label="Name" value={form.emergency_contact_name} onChange={(v) => set("emergency_contact_name", v)} maxLength={200} />
        <SelectInput name="emergency_contact_relation" label="Relation" value={form.emergency_contact_relation} onChange={(v) => set("emergency_contact_relation", v)} options={opts(options.emergency_contact_relations)} />
        <TextInput name="emergency_contact_phone" label="Contact number" type="tel" inputMode="tel" value={form.emergency_contact_phone} onChange={(v) => set("emergency_contact_phone", v)} hint={hint} placeholder={ph} />
      </Group>
    </div>
  );
}

/* ---------------- 5. Other ---------------- */

export function OtherSection(p: SectionProps) {
  const { form, set, detail, reveal } = p;
  const secret = (key: SecretKey, label: string, masked: string | null, max: number, placeholder: string) => (
    <SecretInput
      name={key}
      label={label}
      masked={masked}
      revealed={reveal.data?.[key]}
      value={form[key]}
      onChange={(v) => set(key, v.slice(0, max))}
      onReveal={reveal.allowed ? reveal.reveal : undefined}
      onHide={reveal.hide}
      revealing={reveal.loading}
      placeholder={placeholder}
    />
  );
  return (
    <div className="space-y-8">
      <Group title="Passport">
        {secret("passport_no", "Passport number", detail?.passport_no_masked ?? null, 20, "AB1234567")}
        <TextInput name="passport_expiry" label="Passport expiry" type="date" value={form.passport_expiry} onChange={(v) => set("passport_expiry", v)} />
      </Group>
      <Group title="Driving licence">
        {secret("driving_license_no", "Licence number", detail?.driving_license_no_masked ?? null, 30, "LHR-12-345678")}
        <TextInput name="driving_license_expiry" label="Licence expiry" type="date" value={form.driving_license_expiry} onChange={(v) => set("driving_license_expiry", v)} />
      </Group>
    </div>
  );
}
