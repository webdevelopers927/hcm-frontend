"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Building2,
  CalendarDays,
  ChevronLeft,
  Clock3,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Hourglass,
  Users,
  Link2Off,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "@/components/session/session-provider";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { CNIC_MASK, hueFor, shiftLabel } from "@/lib/api/display";
import {
  deleteEmployee,
  downloadPrivateFile,
  employeeKeys,
  getDevice,
  getEmployee,
  getEmployeeDetail,
  getEmployeeSensitive,
  getFormOptions,
  resetTwoFactor,
  unbindDevice,
} from "@/lib/api/employees";
import type { EmployeeDetail, FormOptions, Option, EmployeeProfile as Profile, EmployeeSensitive } from "@/lib/api/types";
import { cn, formatDate, tenure } from "@/lib/utils";
import { ApiModeBadge, ApiStatusBadge, ConfirmDialog, EmployeeAvatar, ErrorState, Skeleton, SummaryRow } from "./api-ui";

const TABS = ["Overview", "Job", "Personal", "Family", "Education & experience", "Documents", "Identity", "Security"] as const;
type Tab = (typeof TABS)[number];
/** Tabs fed by the full record (GET /employees/{id}/details), which needs edit access. */
const DETAIL_TABS: Tab[] = ["Personal", "Family", "Education & experience", "Documents"];

/** The full employee record plus the labels for its codes; undefined while loading or without access. */
type Full = { d: EmployeeDetail; o: FormOptions } | undefined;

export function EmployeeProfile({ id }: { id: number }) {
  const q = useQuery({ queryKey: employeeKeys.detail(id), queryFn: ({ signal }) => getEmployee(id, signal) });
  const canSeeAll = q.data?.can.update === true;
  const detail = useQuery({ queryKey: employeeKeys.details(id), queryFn: ({ signal }) => getEmployeeDetail(id, signal), enabled: canSeeAll });
  const options = useQuery({ queryKey: employeeKeys.formOptions, queryFn: ({ signal }) => getFormOptions(signal), staleTime: Infinity, gcTime: Infinity, enabled: canSeeAll });
  const [tab, setTab] = useState<Tab>("Overview");

  if (q.isPending) return <ProfileSkeleton />;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) return <NotFound />;
    return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load this profile" />;
  }
  const e = q.data;
  const full: Full = detail.data && options.data ? { d: detail.data, o: options.data } : undefined;
  const lockedOut = e.employment_status ? !e.employment_status.can_login : false;
  const tabs = TABS.filter(
    (t) => (t !== "Security" || e.can.reset_2fa || e.can.unbind_device || e.device_bound) && (canSeeAll || !DETAIL_TABS.includes(t)),
  );
  const detailState = (render: (f: NonNullable<Full>) => ReactNode) =>
    full ? render(full) : detail.isError || options.isError ? (
      <ErrorState error={detail.error ?? options.error} onRetry={() => { void detail.refetch(); void options.refetch(); }} title="Couldn't load these details" />
    ) : (
      <Skeleton className="h-64 rounded-2xl" />
    );

  return (
    <div className="space-y-5">
      <Link href="/employees" className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> All people
      </Link>

      <Card className="overflow-hidden">
        <div
          className="h-28 sm:h-36"
          style={{
            background: `radial-gradient(120% 140% at 0% 0%, oklch(0.86 0.1 ${hueFor(e.id)}) 0%, transparent 55%), radial-gradient(120% 140% at 100% 100%, oklch(0.9 0.12 ${(hueFor(e.id) + 80) % 360}) 0%, transparent 60%), var(--surface-3)`,
          }}
        />
        <div className="px-5 pb-5 sm:px-7">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
              <EmployeeAvatar e={e} size="xl" className="ring-4 ring-surface" />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{e.name}</h1>
                  <ApiStatusBadge status={e.employment_status} />
                  {lockedOut && !tabs.includes("Security") && <CantSignIn />}
                </div>
                <p className="mt-0.5 text-[15px] text-ink-2">
                  {e.designation?.name ?? "No designation"} · {e.department?.name ?? "No department"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-3">
                  {e.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{e.location.name}</span>}
                  {e.shift && <span className="tabular inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{shiftLabel(e.shift)}</span>}
                  <span className="tabular inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" />{e.code}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={`mailto:${e.email}`} className="max-sm:flex-1">
                <Button variant="secondary" className="w-full justify-center"><Mail className="h-4 w-4" /> Email</Button>
              </a>
              {e.can.update && (
                <Link href={`/employees/${e.id}/edit`} className="max-sm:flex-1">
                  <Button variant="primary" className="w-full justify-center">
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                </Link>
              )}
              {e.can.delete && <DeleteButton e={e} />}
            </div>
          </div>
        </div>

        <div className="-mb-px overflow-x-auto border-t border-line px-3 sm:px-5">
          <div role="tablist" className="flex w-max gap-1">
            {tabs.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn("relative h-12 px-3 text-sm font-medium whitespace-nowrap transition", tab === t ? "text-ink" : "text-ink-3 hover:text-ink")}
              >
                {t}
                {t === "Security" && lockedOut && <CantSignIn className="ml-2" />}
                {tab === t && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ink" />}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div key={tab} className="animate-rise">
        {tab === "Overview" && <Overview e={e} full={full} />}
        {tab === "Job" && <Job e={e} full={full} />}
        {tab === "Personal" && detailState((f) => <Personal {...f} />)}
        {tab === "Family" && detailState((f) => <Family {...f} />)}
        {tab === "Education & experience" && detailState((f) => <Education {...f} />)}
        {tab === "Documents" && detailState((f) => <Documents {...f} />)}
        {tab === "Identity" && <Identity e={e} full={full} />}
        {tab === "Security" && <Security e={e} />}
      </div>

    </div>
  );
}

/** Their status blocks sign-in (the server refuses and signs them out). */
function CantSignIn({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-semibold text-bad", className)} title="Their employment status doesn&apos;t allow signing in">
      <Lock className="h-3 w-3" /> Can&apos;t sign in
    </span>
  );
}

/* ---------------- tabs ---------------- */

function Overview({ e, full }: { e: Profile; full: Full }) {
  const d = full?.d;
  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
      <div className="space-y-4 sm:space-y-5 lg:col-span-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <Stat label="Attendance" value={e.attendance_rate ?? "—"} sub="Coming soon" muted />
          <Stat label="Leave balance" value={e.leave_balances ?? "—"} sub="Coming soon" muted />
          <Stat label="Tenure" value={tenure(e.join_date)} sub={`since ${formatDate(e.join_date, { month: "short", year: "numeric" })}`} />
          <Stat label="Work mode" value={<ApiModeBadge mode={e.work_mode} />} sub={e.location?.name ?? "—"} />
        </div>

        <Card>
          <CardHeader title="Contact" />
          <dl className="grid gap-x-6 px-5 pt-2 pb-3 sm:grid-cols-2">
            <CopyRow icon={Mail} label="Business email" value={e.email} />
            <CopyRow icon={Phone} label="Primary contact" value={e.phone} />
            {d && (
              <>
                <CopyRow icon={Mail} label="Personal email" value={d.personal_email} />
                <CopyRow icon={Phone} label="Secondary contact" value={d.secondary_phone} />
                <CopyRow icon={Phone} label="Landline" value={d.landline} />
              </>
            )}
            <CopyRow icon={Building2} label="Location" value={e.location?.name ?? null} />
            <CopyRow icon={CalendarDays} label="Birthday" value={e.birthday ? new Date(`2000-${e.birthday}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : null} />
          </dl>
        </Card>

        {d && (
          <Card>
            <CardHeader title="Addresses & emergency contact" />
            <dl className="grid gap-x-6 px-5 pt-2 pb-3 sm:grid-cols-2">
              <CopyRow icon={MapPin} label="Present address" value={d.present_address} />
              <CopyRow icon={MapPin} label="Permanent address" value={d.permanent_address} />
              <CopyRow
                icon={Users}
                label="Emergency contact"
                value={d.emergency_contact_name ? `${d.emergency_contact_name}${d.emergency_contact_relation ? ` (${label(full.o.emergency_contact_relations, d.emergency_contact_relation)})` : ""}` : null}
              />
              <CopyRow icon={Phone} label="Emergency number" value={d.emergency_contact_phone} />
            </dl>
          </Card>
        )}

        <Card>
          <CardHeader title="Attendance & time off" subtitle="These modules are on the way" />
          <div className="flex items-center gap-4 p-5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-ink-3"><Hourglass className="h-5 w-5" /></span>
            <p className="text-sm text-ink-2">Attendance history and leave balances will show here once the Attendance and Time off modules are live.</p>
          </div>
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader title="Reporting line" />
        <div className="p-5">
          {e.reports_to ? (
            <Link href={`/employees/${e.reports_to.id}`} className="block rounded-xl border border-line p-3 hover:bg-surface-2">
              <div className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Reports to</div>
              <SummaryRow e={e.reports_to} />
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-3 text-[13px] text-ink-3">No manager — top of the reporting line</div>
          )}
          {d?.indirect_reports_to && (
            <Link href={`/employees/${d.indirect_reports_to.id}`} className="mt-2 block rounded-xl border border-dashed border-line-strong p-3 hover:bg-surface-2">
              <div className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Indirect · dotted line</div>
              <SummaryRow e={d.indirect_reports_to} />
            </Link>
          )}
          <div className="ml-7 h-5 w-px bg-line-strong" />
          <div className="flex items-center gap-3 rounded-xl bg-ink p-3 text-canvas">
            <EmployeeAvatar e={e} size="sm" />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold">{e.name}</div>
              <div className="truncate text-[12px] opacity-70">{e.designation?.name ?? "—"}</div>
            </div>
          </div>
          {e.direct_reports.length > 0 && (
            <>
              <div className="ml-7 h-5 w-px bg-line-strong" />
              <div className="mb-1 px-3 text-[11px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Direct reports · {e.direct_reports.length}</div>
              <ul className="space-y-0.5">
                {e.direct_reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/employees/${r.id}`} className="block rounded-xl px-3 py-2 hover:bg-surface-2"><SummaryRow e={r} /></Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function Job({ e, full }: { e: Profile; full: Full }) {
  const rows: [string, ReactNode][] = [
    ["Employee code", e.code],
    ["Machine UID", e.machine_uid ?? "—"],
    ["Pseudo name", e.pseudo_name ?? "—"],
    ["Designation", e.designation?.name ?? "—"],
    ["Department", e.department?.name ?? "—"],
    ["Campaign", e.campaign?.name ?? "—"],
    ["Reports to", e.reports_to?.name ?? "—"],
    ...(full ? ([["Indirect reporting", full.d.indirect_reports_to?.name ?? "—"]] as [string, ReactNode][]) : []),
    ["Status", <ApiStatusBadge key="s" status={e.employment.employment_status} />],
    ["Work mode", <ApiModeBadge key="w" mode={e.work_mode} />],
    ["Shift", shiftLabel(e.shift)],
    ["Joining date", formatDate(e.employment.join_date)],
    ["Location", e.location?.name ?? "—"],
  ];

  if (full) {
    const { d, o } = full;
    const probation = d.probation_duration_id ? o.probation_durations.find((p) => p.id === d.probation_duration_id)?.name ?? null : null;
    rows.push(
      ["Division", d.division_id ? o.divisions.find((x) => x.id === d.division_id)?.name ?? "—" : "—"],
      ["Duty type", label(o.duty_types, d.duty_type)],
      ["Team authority", d.has_team_authority ? "Yes" : "No"],
      ["Probation", d.probation_start_date ? `${date(d.probation_start_date)}${probation ? ` · ${probation}` : ""}` : "—"],
      ["Probation ends", date(d.probation_end_date)],
      ["Confirmation date", date(d.confirmation_date)],
      ["Separation date", date(d.separation_date)],
      [
        "Remote access",
        !d.remote_access
          ? "No"
          : d.permanent_remote_access
            ? `Permanent, from ${date(d.remote_access_from)}`
            : `${date(d.remote_access_from)} – ${date(d.remote_access_until)}`,
      ],
    );
  }

  return <DetailCard title="Employment details" rows={rows} />;
}

/* ---------- tabs fed by the full record ---------- */

function Personal({ d, o }: NonNullable<Full>) {
  const place = [d.city?.name, d.state?.name, d.country?.name].filter(Boolean).join(", ");
  return (
    <DetailCard
      title="Personal information"
      rows={[
        ["Salutation", label(o.salutations, d.salutation)],
        ["Full name", d.name ?? "—"],
        ["Father / husband name", d.father_husband_name ?? "—"],
        ["Gender", label(o.genders, d.gender)],
        ["Date of birth", date(d.birth_date)],
        ["CNIC expiry", date(d.cnic_expiry)],
        ["Nationality", d.nationality?.name ?? "—"],
        ["City / state / country", place || "—"],
        ["Marital status", label(o.marital_statuses, d.marital_status)],
        ["Religion", label(o.religions, d.religion)],
        ["Blood group", label(o.blood_groups, d.blood_group)],
        ["Passport expiry", date(d.passport_expiry)],
        ["Driving license expiry", date(d.driving_license_expiry)],
      ]}
    />
  );
}

function Family({ d }: NonNullable<Full>) {
  if (d.spouses.length === 0) return <EmptyCard icon={Users} text="No family members added." />;
  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
      {d.spouses.map((s, i) => (
        <Card key={s.id}>
          <CardHeader title={s.full_name ?? `Spouse ${i + 1}`} subtitle={`Spouse · born ${date(s.birth_date)} · CNIC ${s.cnic_masked ?? "—"}`} />
          <div className="px-5 pt-1 pb-4">
            {s.children.length === 0 ? (
              <p className="py-2 text-[13px] text-ink-3">No children added.</p>
            ) : (
              <ul className="divide-y divide-line">
                {s.children.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="font-medium text-ink">{c.full_name ?? "—"}</span>
                    <span className="tabular text-ink-3">{date(c.birth_date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Education({ d }: NonNullable<Full>) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <Card>
        <CardHeader title="Qualifications" />
        {d.qualifications.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] text-ink-3">No qualifications added.</p>
        ) : (
          <ul className="divide-y divide-line px-5 pb-2">
            {d.qualifications.map((q) => (
              <li key={q.id} className="flex items-start gap-3 py-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2"><GraduationCap className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-medium text-ink">{q.degree_program?.name ?? "—"}</div>
                  <div className="text-ink-3">{q.institution ?? "—"}</div>
                </div>
                <div className="tabular text-right text-[13px] text-ink-3">
                  {q.year ?? "—"}
                  {(q.start_date || q.end_date) && <div>{date(q.start_date)} – {date(q.end_date)}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Work experience" subtitle={d.has_work_experience ? undefined : "No previous work experience"} />
        {d.work_experiences.length > 0 && (
          <ul className="divide-y divide-line px-5 pb-2">
            {d.work_experiences.map((w) => (
              <li key={w.id} className="py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-ink">{w.designation ?? "—"} · {w.company_name ?? "—"}</div>
                    <div className="text-ink-3">{[w.city?.name, w.state?.name, w.country?.name].filter(Boolean).join(", ") || "—"}</div>
                  </div>
                  <div className="tabular text-[13px] text-ink-3">{date(w.period_from)} – {date(w.period_to)}</div>
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                  <Pair k="Last salary" v={w.last_salary ? Number(w.last_salary).toLocaleString("en-PK") : "—"} />
                  <Pair k="Reason for leaving" v={w.reason_for_leaving ?? "—"} />
                  <Pair k="Contact person" v={[w.contact_person_name, w.contact_person_phone, w.contact_person_email].filter(Boolean).join(" · ") || "—"} />
                  {w.description && <Pair k="Description" v={w.description} />}
                </dl>
                {w.experience_letter && <FileButton file={w.experience_letter} label="Experience letter" />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Documents({ d }: NonNullable<Full>) {
  if (d.documents.length === 0) return <EmptyCard icon={FileText} text="No documents uploaded." />;
  return (
    <Card>
      <CardHeader title="Documents" subtitle="Downloads are audit-logged" />
      <ul className="divide-y divide-line px-5 pb-2">
        {d.documents.map((doc) => (
          <li key={doc.id} className="flex items-center gap-3 py-3 text-sm">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2"><FileText className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-ink">{doc.title ?? doc.name}</div>
              <div className="truncate text-[12px] text-ink-3">{doc.name} · {fileSize(doc.size)} · {formatDate(doc.uploaded_at)}</div>
            </div>
            <FileButton file={doc} label="Download" compact />
          </li>
        ))}
      </ul>
    </Card>
  );
}

const REVEAL_SECONDS = 60;

/**
 * PII is fetched only on an explicit click, kept in component state (never
 * the query cache), and re-masked after 60s or when the tab unmounts.
 */
function Identity({ e, full }: { e: Profile; full: Full }) {
  const { can } = useSession();
  const [data, setData] = useState<EmployeeSensitive | null>(null);
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hide = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setData(null);
    setLeft(0);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function reveal() {
    setLoading(true);
    try {
      setData(await getEmployeeSensitive(e.id));
      setLeft(REVEAL_SECONDS);
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(() => {
        setLeft((s) => {
          if (s <= 1) {
            if (timer.current) clearInterval(timer.current);
            timer.current = null;
            setData(null);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      toast(errorMessage(err), "bad");
    } finally {
      setLoading(false);
    }
  }

  const allowed = can("employees.view-sensitive");

  return (
    <Card>
      <CardHeader
        title="Identity"
        subtitle={data ? `Visible for ${left}s · this view is audit-logged` : "Masked by default · every reveal is audit-logged"}
        action={
          allowed ? (
            data ? (
              <Button size="sm" variant="secondary" onClick={hide}><EyeOff className="h-3.5 w-3.5" /> Hide</Button>
            ) : (
              <Button size="sm" variant="primary" onClick={reveal} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Reveal
              </Button>
            )
          ) : null
        }
      />
      <div className="px-5 pt-3 pb-4">
        {!allowed && (
          <p className="mb-2 flex items-center gap-2 rounded-xl bg-surface-2 p-3 text-[13px] text-ink-2">
            <ShieldCheck className="h-4 w-4 text-ink-3" /> You don&apos;t have access to sensitive details.
          </p>
        )}
        <dl className="divide-y divide-line">
          <IdRow label="CNIC" revealed={data} value={data?.cnic} masked={full?.d.cnic_masked ?? CNIC_MASK} />
          {full && (
            <>
              <IdRow label="Passport no." revealed={data} value={data?.passport_no} masked={full.d.passport_no_masked} />
              <IdRow label="Driving license no." revealed={data} value={data?.driving_license_no} masked={full.d.driving_license_no_masked} />
              {full.d.spouses.map((s, i) => (
                <IdRow
                  key={s.id}
                  label={`Spouse CNIC · ${s.full_name ?? `Spouse ${i + 1}`}`}
                  revealed={data}
                  value={data?.spouses.find((x) => x.id === s.id)?.cnic}
                  masked={s.cnic_masked}
                />
              ))}
            </>
          )}
        </dl>
      </div>
    </Card>
  );
}

function Security({ e }: { e: Profile }) {
  const qc = useQueryClient();
  const device = useQuery({ queryKey: employeeKeys.device(e.id), queryFn: () => getDevice(e.id), enabled: e.device_bound, staleTime: 0 });
  const [confirm, setConfirm] = useState<"reset2fa" | "unbind" | null>(null);
  const m = useMutation({
    mutationFn: (kind: "reset2fa" | "unbind"): Promise<{ message: string }> => (kind === "reset2fa" ? resetTwoFactor(e.id) : unbindDevice(e.id)),
    onSuccess: (res, kind) => {
      toast(res.message);
      qc.setQueryData<Profile>(employeeKeys.detail(e.id), (old) => (old ? { ...old, ...(kind === "reset2fa" ? { two_factor_enabled: false } : { device_bound: false }) } : old));
      void qc.invalidateQueries({ queryKey: employeeKeys.all });
      setConfirm(null);
    },
    onError: (err) => {
      toast(err instanceof ApiError ? err.field("employee") ?? err.field("device") ?? err.message : errorMessage(err), "bad");
      setConfirm(null);
    },
  });

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", e.two_factor_enabled ? "bg-ok-soft text-ok" : "bg-surface-3 text-ink-3")}>
            {e.two_factor_enabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-ink">Two-factor authentication</h3>
            <p className="text-[13px] text-ink-3">{e.two_factor_enabled ? "On — they confirm sign-ins with an authenticator." : "Off for this account."}</p>
          </div>
        </div>
        {e.can.reset_2fa && e.two_factor_enabled && (
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => setConfirm("reset2fa")}>Reset 2FA</Button>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", e.device_bound ? "bg-info-soft text-info" : "bg-surface-3 text-ink-3")}>
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-ink">Mobile attendance device</h3>
            {!e.device_bound ? (
              <p className="text-[13px] text-ink-3">No phone bound yet.</p>
            ) : device.isPending ? (
              <Skeleton className="mt-1 h-4 w-40" />
            ) : device.data ? (
              <p className="text-[13px] text-ink-3">
                {device.data.model} · {device.data.platform === "ios" ? "iOS" : "Android"} · bound {new Date(device.data.bound_at).toLocaleDateString("en-GB", { dateStyle: "medium" })}
              </p>
            ) : (
              <p className="text-[13px] text-ink-3">{device.isError ? errorMessage(device.error) : "No phone bound."}</p>
            )}
          </div>
        </div>
        {e.can.unbind_device && e.device_bound && (
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => setConfirm("unbind")}><Link2Off className="h-3.5 w-3.5" /> Unbind device</Button>
        )}
      </Card>

      {confirm && (
        <ConfirmDialog
          danger
          busy={m.isPending}
          title={confirm === "reset2fa" ? `Reset 2FA for ${e.name}?` : `Unbind ${e.name}'s device?`}
          body={confirm === "reset2fa" ? "Their authenticator is removed; they'll set up two-factor again at next sign-in." : "Mobile attendance stops working until they bind a new phone."}
          confirmLabel={confirm === "reset2fa" ? "Reset 2FA" : "Unbind"}
          onCancel={() => setConfirm(null)}
          onConfirm={() => m.mutate(confirm)}
        />
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function label<V extends string>(options: Option<V>[], value: V | null): string {
  return value === null ? "—" : options.find((o) => o.value === value)?.label ?? value;
}

function date(iso: string | null): string {
  return iso ? formatDate(iso) : "—";
}

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailCard({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <Card>
      <CardHeader title={title} />
      <dl className="grid gap-x-8 px-5 pt-2 pb-4 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 border-b border-line py-3 text-sm">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-right font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-ink-3">{k}:</dt>
      <dd className="min-w-0 text-ink-2">{v}</dd>
    </div>
  );
}

function EmptyCard({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 text-ink-3"><Icon className="h-5 w-5" /></span>
      <p className="text-sm text-ink-2">{text}</p>
    </Card>
  );
}

/** One national id: masked from the full record, the real value only after Reveal. */
function IdRow({ label: name, revealed, value, masked }: { label: string; revealed: EmployeeSensitive | null; value: string | null | undefined; masked: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 text-sm">
      <dt className="text-ink-3">{name}</dt>
      <dd className={cn("tabular text-right font-medium", revealed ? "text-ink" : "tracking-wider text-ink-3")}>{revealed ? value ?? "—" : masked ?? "—"}</dd>
    </div>
  );
}

function FileButton({ file, label: text, compact }: { file: { name: string; download_url: string }; label: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      className={compact ? undefined : "mt-3"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await downloadPrivateFile(file.download_url, file.name);
        } catch (err) {
          toast(errorMessage(err), "bad");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {text}
    </Button>
  );
}

function DeleteButton({ e }: { e: Profile }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => deleteEmployee(e.id),
    onSuccess: (res) => {
      toast(res.message);
      void qc.invalidateQueries({ queryKey: employeeKeys.all });
      router.push("/employees");
    },
    onError: (err) => {
      toast(errorMessage(err), "bad");
      setOpen(false);
    },
  });
  return (
    <>
      <Button variant="secondary" size="icon" aria-label={`Delete ${e.name}`} onClick={() => setOpen(true)} className="text-bad">
        <Trash2 className="h-4 w-4" />
      </Button>
      {open && (
        <ConfirmDialog
          danger
          busy={m.isPending}
          title={`Delete ${e.name}?`}
          body="They'll be removed from the directory and signed out everywhere."
          confirmLabel="Delete"
          onCancel={() => setOpen(false)}
          onConfirm={() => m.mutate()}
        />
      )}
    </>
  );
}

function Stat({ label, value, sub, muted }: { label: string; value: ReactNode; sub: string; muted?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className={cn("tabular mt-2 text-xl font-semibold tracking-tight", muted ? "text-ink-3" : "text-ink")}>{value}</div>
      <div className="mt-0.5 truncate text-[12px] text-ink-3">{sub}</div>
    </Card>
  );
}

function CopyRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group flex items-center gap-3 border-b border-line py-3 last:border-0 sm:[&:nth-last-child(2)]:border-0">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <dt className="text-[12px] text-ink-3">{label}</dt>
        <dd className="truncate text-sm font-medium text-ink">{value ?? "—"}</dd>
      </div>
      {value && (
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          aria-label={`Copy ${label}`}
          className="rounded-md p-1.5 text-ink-3 transition hover:bg-surface-3 hover:text-ink sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          {copied ? <span className="text-[11px] font-semibold text-ok">Copied</span> : <Copy className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading profile">
      <Skeleton className="h-5 w-24" />
      <Card className="overflow-hidden">
        <Skeleton className="h-28 rounded-none sm:h-36" />
        <div className="flex items-end gap-5 px-7 pb-6">
          <Skeleton className="-mt-12 h-24 w-24 rounded-full ring-4 ring-surface" />
          <div className="flex-1 space-y-2 pb-1"><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-40" /></div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
    </div>
  );
}

function NotFound() {
  return (
    <Card className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-3 text-ink-2"><UserX className="h-6 w-6" /></span>
      <h1 className="mt-4 text-lg font-semibold text-ink">Employee not found</h1>
      <p className="mt-1 text-sm text-ink-3">They may have been deleted, or the link is wrong.</p>
      <Link href="/employees" className="mt-5"><Button variant="secondary">Back to people</Button></Link>
    </Card>
  );
}
