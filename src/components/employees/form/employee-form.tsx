"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  ChevronLeft,
  CircleDashed,
  FileText,
  GraduationCap,
  HeartHandshake,
  IdCard,
  Loader2,
  Phone,
  Save,
  Send,
  Sparkles,
  Trash2,
  User,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/session/session-provider";
import { Avatar, Badge, Button, Card, Kbd } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { hueFor } from "@/lib/api/display";
import {
  createDraft,
  deleteEmployee,
  employeeKeys,
  geoKeys,
  getEmployeeDetail,
  getEmployeeSensitive,
  getFormOptions,
  listCountries,
  submitDraft,
  updateEmployee,
} from "@/lib/api/employees";
import type { Country, EmployeeDetail, EmployeeSensitive, FormOptions } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ConfirmDialog, ErrorState, Skeleton } from "../api-ui";
import { Drawer } from "../module-kit";
import { FieldStatusContext } from "./controls";
import {
  SECTIONS,
  clientErrors,
  completeness,
  fieldId,
  firstSectionWith,
  fromDetail,
  isSectionDirty,
  isSectionId,
  labelFor,
  mapErrors,
  mergeSection,
  sectionOf,
  sectionPayload,
  type FormKey,
  type FormState,
  type SectionId,
} from "./model";
import { DocumentsSection, ExperienceSection, FamilySection, QualificationSection } from "./sections-lists";
import { ContactSection, OtherSection, PersonalSection, PositionalSection, type Reveal, type SectionProps } from "./sections-main";

const ICONS: Record<SectionId, LucideIcon> = {
  personal: User,
  positional: UserCog,
  contact: Phone,
  family: HeartHandshake,
  other: IdCard,
  qualification: GraduationCap,
  experience: Briefcase,
  documents: FileText,
};

const RENDER: Record<SectionId, (p: SectionProps) => React.ReactNode> = {
  personal: PersonalSection,
  positional: PositionalSection,
  contact: ContactSection,
  family: FamilySection,
  other: OtherSection,
  qualification: QualificationSection,
  experience: ExperienceSection,
  documents: DocumentsSection,
};

const sectionLabel = (id: SectionId) => SECTIONS.find((s) => s.id === id)!.label;

/* ================= loader ================= */

export function EmployeeFormPage({ id }: { id: number | null }) {
  const options = useQuery({ queryKey: employeeKeys.formOptions, queryFn: ({ signal }) => getFormOptions(signal), staleTime: Infinity, gcTime: Infinity });
  const countries = useQuery({ queryKey: geoKeys.countries, queryFn: ({ signal }) => listCountries(signal), staleTime: Infinity, gcTime: Infinity });
  const detail = useQuery({
    queryKey: employeeKeys.details(id ?? 0),
    queryFn: ({ signal }) => getEmployeeDetail(id!, signal),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
  const { can } = useSession();

  if (!can(id ? "employees.update" : "employees.create") && !options.isPending) {
    return <ErrorState error={new ApiError(403, "You don't have permission to do this.")} title="Not allowed" />;
  }
  if (options.isError) return <ErrorState error={options.error} onRetry={() => options.refetch()} title="Couldn't load the form" />;
  if (detail.isError) {
    const nf = detail.error instanceof ApiError && detail.error.status === 404;
    return <ErrorState error={nf ? new ApiError(404, "This employee or draft doesn't exist, or it was discarded.") : detail.error} onRetry={nf ? undefined : () => detail.refetch()} title={nf ? "Not found" : "Couldn't load this employee"} />;
  }
  if (options.isPending || (id !== null && detail.isPending)) return <FormSkeleton />;

  return <EmployeeFormEditor key={id ?? "new"} initial={id !== null ? detail.data ?? null : null} options={options.data} countries={countries.data ?? []} />;
}

function FormSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading form">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden space-y-2 lg:block">{SECTIONS.map((s) => <Skeleton key={s.id} className="h-14 rounded-xl" />)}</div>
        <Card className="space-y-4 p-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11" />)}</Card>
      </div>
    </div>
  );
}

/* ================= reveal ================= */

const REVEAL_SECONDS = 60;

/** One audited call reveals every national id; kept in state only, re-masked after 60s. */
function useReveal(employeeId: number | null): Reveal {
  const { can } = useSession();
  const [data, setData] = useState<EmployeeSensitive | null>(null);
  const [loading, setLoading] = useState(false);
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const hide = useCallback(() => {
    stop();
    setData(null);
    setLeft(0);
  }, []);
  const reveal = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      setData(await getEmployeeSensitive(employeeId));
      setLeft(REVEAL_SECONDS);
      stop();
      timer.current = setInterval(() => {
        setLeft((s) => {
          if (s <= 1) {
            stop();
            setData(null);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);
  return { data, loading, left, reveal, hide, allowed: !!employeeId && can("employees.view-sensitive") };
}

/* ================= leave guard ================= */

/** Warns on reload/close and intercepts in-app link clicks while there are unsaved changes. */
function useLeaveGuard(active: boolean, onIntercept: (href: string) => void) {
  useEffect(() => {
    if (!active) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      onIntercept(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active, onIntercept]);
}

/* ================= editor ================= */

function EmployeeFormEditor({ initial, options, countries }: { initial: EmployeeDetail | null; options: FormOptions; countries: Country[] }) {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();

  const [detail, setDetail] = useState<EmployeeDetail | null>(initial);
  const [baseline, setBaseline] = useState<FormState>(() => fromDetail(initial));
  const [form, setForm] = useState<FormState>(baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [section, setSection] = useState<SectionId>(() => {
    const s = params.get("section");
    return isSectionId(s) ? s : "personal";
  });
  const [visited, setVisited] = useState<Set<SectionId>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  // Refs mirror state synchronously so queued saves always diff against the latest values.
  const formRef = useRef(form);
  const baselineRef = useRef(baseline);
  const detailRef = useRef(detail);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const reminded = useRef<Set<SectionId>>(new Set());
  const top = useRef<HTMLDivElement>(null);

  const isDraft = !detail || detail.is_draft;
  const employeeId = detail?.id ?? null;
  const reveal = useReveal(employeeId);

  const update = useCallback((fn: (f: FormState) => FormState, clear: string[] = []) => {
    formRef.current = fn(formRef.current);
    setForm(formRef.current);
    if (clear.length) setErrors((e) => (clear.some((k) => k in e) ? Object.fromEntries(Object.entries(e).filter(([k]) => !clear.includes(k))) : e));
  }, []);

  const set = useCallback(<K extends FormKey>(key: K, value: FormState[K], clear?: string[]) => {
    const def = ["country", "state", "city", "nationality", "reports_to", "indirect_reports_to"].includes(key) ? `${key}_id` : key;
    update((f) => ({ ...f, [key]: value }), clear ?? [def]);
  }, [update]);
  const patch = useCallback((p: Partial<FormState>, clear: string[] = []) => update((f) => ({ ...f, ...p }), clear), [update]);
  const clearErrors = useCallback((prefix: string) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith(prefix)))), []);

  /* ---- derived ---- */

  const dirtyBySection = useMemo(() => Object.fromEntries(SECTIONS.map((s) => [s.id, isSectionDirty(s.id, form, baseline)])) as Record<SectionId, boolean>, [form, baseline]);
  const anyDirty = Object.values(dirtyBySection).some(Boolean);
  const noticeIds = useMemo(() => new Set(options.employment_statuses.filter((st) => st.is_notice_period).map((st) => st.id)), [options.employment_statuses]);
  const comp = useMemo(() => completeness(form, detail, noticeIds), [form, detail, noticeIds]);
  // Server errors win; local checks (e.g. date order) show until the server has spoken.
  const shownErrors = useMemo(() => ({ ...clientErrors(form), ...errors }), [form, errors]);
  const missingKeys = Object.keys(comp.missing);
  const pct = Math.round(((comp.total - missingKeys.length) / Math.max(comp.total, 1)) * 100);
  const bySection = useMemo(() => {
    const out = Object.fromEntries(SECTIONS.map((s) => [s.id, { missing: [] as string[], errors: [] as string[] }])) as Record<SectionId, { missing: string[]; errors: string[] }>;
    for (const k of missingKeys) out[sectionOf(k)].missing.push(k);
    for (const k of Object.keys(errors)) out[sectionOf(k)].errors.push(k);
    return out;
  }, [missingKeys, errors]);
  const nudges = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, msg] of Object.entries(comp.missing)) if (attempted || visited.has(sectionOf(k))) out[k] = msg;
    return out;
  }, [comp.missing, attempted, visited]);

  /* ---- saving ---- */

  const invalidate = useCallback(
    (id: number) => {
      void qc.invalidateQueries({ queryKey: ["employees", "drafts"] });
      void qc.invalidateQueries({ queryKey: ["employees", "list"] });
      void qc.invalidateQueries({ queryKey: employeeKeys.detail(id) });
    },
    [qc],
  );

  /** Saves one section's changes. Runs strictly one at a time per form, so the draft is created once and PATCHes never overlap. */
  const saveSection = useCallback(
    (sec: SectionId, opts: { quiet?: boolean; force?: boolean } = {}): Promise<boolean> => {
      const run = async () => {
        const sent = formRef.current;
        const payload = sectionPayload(sec, sent, baselineRef.current);
        const d = detailRef.current;
        if (Object.keys(payload).length === 0 && (d || !opts.force)) return true;
        setSaving((n) => n + 1);
        try {
          const fresh = d ? await updateEmployee(d.id, payload) : await createDraft(payload);
          const freshState = fromDetail(fresh);
          baselineRef.current = freshState;
          detailRef.current = fresh;
          formRef.current = mergeSection(sec, formRef.current, sent, freshState);
          setBaseline(freshState);
          setDetail(fresh);
          setForm(formRef.current);
          setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => sectionOf(k) !== sec)));
          setSavedAt(Date.now());
          if (!d) window.history.replaceState(null, "", `/employees/${fresh.id}/edit?section=${sec}`);
          invalidate(fresh.id);
          if (!opts.quiet) toast(d ? `${sectionLabel(sec)} saved` : "Draft saved. Finish any time from Drafts");
          return true;
        } catch (e) {
          if (e instanceof ApiError && e.status === 422) {
            const mapped = mapErrors(e.errors);
            setErrors((prev) => ({ ...Object.fromEntries(Object.entries(prev).filter(([k]) => sectionOf(k) !== sec)), ...mapped }));
            const n = Object.keys(mapped).length;
            toast(`${sectionLabel(sec)} not saved: ${n} field${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} a look`, "bad");
          } else {
            toast(errorMessage(e), "bad");
          }
          return false;
        } finally {
          setSaving((n) => n - 1);
        }
      };
      const p = queue.current.then(run, run);
      queue.current = p.catch(() => undefined);
      return p;
    },
    [invalidate],
  );

  const saveAll = useCallback(async () => {
    let ok = true;
    for (const s of SECTIONS) if (isSectionDirty(s.id, formRef.current, baselineRef.current)) ok = (await saveSection(s.id, { quiet: true })) && ok;
    return ok;
  }, [saveSection]);

  /* ---- navigation between sections ---- */

  const goTo = useCallback(
    (next: SectionId, focusKey?: string) => {
      if (next !== section) {
        // Leaving: save in the background (never blocks the jump) and gently point out skipped fields once.
        if (dirtyBySection[section]) void saveSection(section, { quiet: true });
        setVisited((v) => new Set(v).add(section));
        const skipped = bySection[section].missing;
        if (skipped.length && !reminded.current.has(section) && !attempted) {
          reminded.current.add(section);
          toast(`${skipped.length} field${skipped.length === 1 ? "" : "s"} left in ${sectionLabel(section)}. Come back any time`, "info");
        }
        setSection(next);
        const url = new URL(window.location.href);
        url.searchParams.set("section", next);
        window.history.replaceState(null, "", url.pathname + url.search);
        top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (focusKey) setPendingFocus(focusKey);
    },
    [section, dirtyBySection, bySection, attempted, saveSection],
  );

  const jumpToField = useCallback((key: string) => {
    setReviewOpen(false);
    goTo(sectionOf(key), key);
  }, [goTo]);

  // Focus + highlight a field after its section has rendered.
  useEffect(() => {
    if (!pendingFocus) return;
    const t = setTimeout(() => {
      const parts = pendingFocus.split(".");
      const candidates = [pendingFocus, parts.slice(0, 2).join("."), parts[0]!].map(fieldId);
      const el = candidates.map((c) => document.getElementById(c)).find(Boolean);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus({ preventScroll: true });
      }
      setFlash(pendingFocus);
      setPendingFocus(null);
    }, 80);
    return () => clearTimeout(t);
  }, [pendingFocus, section]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1700);
    return () => clearTimeout(t);
  }, [flash]);

  /* ---- keyboard: Ctrl/Cmd+S saves ---- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveSection(section, { force: !detailRef.current });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [section, saveSection]);

  /* ---- leave guard ---- */

  const [guardOff, setGuardOff] = useState(false);
  useLeaveGuard(anyDirty && !guardOff, setLeaveTo);
  const leave = (href: string) => {
    setGuardOff(true);
    setLeaveTo(null);
    // Let the guard unmount before navigating.
    setTimeout(() => router.push(href), 0);
  };

  /* ---- submit / discard ---- */

  async function submit() {
    if (!(await saveAll())) {
      setReviewOpen(false);
      const first = firstSectionWith(Object.keys(errors));
      if (first) goTo(first);
      return;
    }
    const d = detailRef.current;
    if (!d) return;
    setSubmitting(true);
    try {
      const profile = await submitDraft(d.id);
      invalidate(profile.id);
      void qc.invalidateQueries({ queryKey: employeeKeys.all });
      toast("Employee created, invite sent");
      setGuardOff(true);
      router.push(`/employees/${profile.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const mapped = mapErrors(e.errors);
        setErrors(mapped);
        setAttempted(true);
        toast("Almost there. A few fields still need you", "bad");
      } else if (e instanceof ApiError && e.status === 409) {
        toast(e.message, "info");
        setGuardOff(true);
        router.push(`/employees/${d.id}`);
      } else {
        toast(errorMessage(e), "bad");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function discard() {
    const d = detailRef.current;
    if (!d) return leave("/employees");
    setDiscarding(true);
    try {
      const res = await deleteEmployee(d.id);
      void qc.invalidateQueries({ queryKey: ["employees", "drafts"] });
      toast(res.message);
      setConfirmDiscard(false);
      leave("/employees/drafts");
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setDiscarding(false);
    }
  }

  /* ---- render ---- */

  const idx = SECTIONS.findIndex((s) => s.id === section);
  const prev = SECTIONS[idx - 1];
  const next = SECTIONS[idx + 1];
  const name = [form.first_name, form.last_name].filter(Boolean).join(" ") || detail?.name || (isDraft ? "New employee" : "Employee");
  const avatarSrc = form.avatar.pending?.preview ?? (form.avatar.removed ? null : detail?.avatar_url ?? null);
  const here = bySection[section];
  const hereMissing = here.missing.filter((k) => !errors[k]);
  const showHereReminder = hereMissing.length > 0 && (visited.has(section) || attempted);
  const sectionProps: SectionProps = { form, set, patch, clearErrors, options, countries, detail, employeeId, reveal, missing: comp.missing };
  const Render = RENDER[section];

  const status = saving > 0 ? (
    <span className="inline-flex items-center gap-1.5 text-ink-3"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>
  ) : anyDirty ? (
    <span className="inline-flex items-center gap-1.5 text-warn"><span className="h-1.5 w-1.5 rounded-full bg-warn" /> Unsaved changes</span>
  ) : savedAt ? (
    <span className="inline-flex items-center gap-1.5 text-ok"><Check className="h-3.5 w-3.5" /> All changes saved</span>
  ) : detail ? (
    <span className="text-ink-3">Up to date</span>
  ) : (
    <span className="text-ink-3">Nothing saved yet</span>
  );

  return (
    <FieldStatusContext.Provider value={{ errors: shownErrors, nudges, flash }}>
      <div className="space-y-5" ref={top}>
        <Link href={isDraft && detail ? "/employees/drafts" : detail ? `/employees/${detail.id}` : "/employees"} className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> {isDraft && detail ? "Drafts" : detail ? "Profile" : "All people"}
        </Link>

        {/* Header */}
        <Card className="z-20 overflow-hidden lg:sticky lg:top-20">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="relative shrink-0">
                <ProgressRing pct={isDraft ? pct : 100} />
                {/* The ring is 64px with a 48px hole; centre the 40px avatar in it. */}
                <Avatar name={name} hue={hueFor(employeeId ?? name.length)} src={avatarSrc} size="md" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-ink sm:text-2xl">{name}</h1>
                  {isDraft ? <Badge tone="warn" dot>Draft</Badge> : detail?.code && <Badge tone="neutral">{detail.code}</Badge>}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
                  {isDraft && (
                    <span className="text-ink-2">
                      {missingKeys.length === 0 ? <span className="font-medium text-ok">Ready to submit</span> : <><span className="tabular font-semibold text-ink">{pct}%</span> complete · {missingKeys.length} to go</>}
                    </span>
                  )}
                  <span aria-live="polite">{status}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 [&>*]:max-sm:flex-1 [&>*]:max-sm:justify-center">
              {isDraft && (
                <Button variant="ghost" onClick={() => (detail ? setConfirmDiscard(true) : leave("/employees"))} disabled={discarding || submitting} className="hover:text-bad">
                  <Trash2 className="h-4 w-4" /> <span className="max-md:hidden">Discard</span>
                </Button>
              )}
              <Button variant={isDraft ? "secondary" : "primary"} onClick={() => void saveSection(section, { force: !detail })} disabled={saving > 0 || submitting || (!dirtyBySection[section] && !!detail)} title="Ctrl+S">
                {saving > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {isDraft ? "Save draft" : "Save"}
              </Button>
              {isDraft && (
                <Button variant="primary" onClick={() => setReviewOpen(true)} disabled={submitting}>
                  <Send className="h-4 w-4" /> Finish
                </Button>
              )}
            </div>
          </div>
          {isDraft && <div className="h-1 bg-surface-3"><div className="h-full bg-accent transition-all duration-700" style={{ width: `${pct}%` }} /></div>}
        </Card>

        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Section nav: every section is one click away */}
          <nav aria-label="Form sections" className="lg:sticky lg:top-52 lg:self-start">
            <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
              <ol className="flex w-max gap-1.5 lg:w-auto lg:flex-col lg:gap-1">
                {SECTIONS.map((s, i) => {
                  const Icon = ICONS[s.id];
                  const st = bySection[s.id];
                  const current = s.id === section;
                  const seen = visited.has(s.id) || attempted;
                  const state = st.errors.length ? "error" : st.missing.length ? (seen ? "missing" : "todo") : seen || (detail && !isDraft) ? "done" : "todo";
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => goTo(s.id)}
                        aria-current={current ? "step" : undefined}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition lg:p-3",
                          current ? "bg-surface shadow-soft ring-1 ring-line" : "hover:bg-surface-2",
                        )}
                      >
                        <span
                          className={cn(
                            "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                            state === "error" ? "bg-bad-soft text-bad" : state === "missing" ? "bg-warn-soft text-warn" : state === "done" ? "bg-accent text-accent-ink" : current ? "bg-ink text-canvas" : "bg-surface-3 text-ink-3",
                          )}
                        >
                          {state === "done" && !current ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                          {dirtyBySection[s.id] && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-warn ring-2 ring-canvas" title="Unsaved changes" />}
                        </span>
                        <span className="min-w-0 pr-1">
                          <span className={cn("block text-sm font-semibold whitespace-nowrap", current ? "text-ink" : "text-ink-2")}>
                            <span className="text-ink-3 tabular max-lg:hidden">{i + 1}. </span>{s.label}
                          </span>
                          <span className={cn("block text-[12px] whitespace-nowrap", state === "error" ? "text-bad" : state === "missing" ? "text-warn" : "text-ink-3")}>
                            {state === "error" ? `${st.errors.length} to fix` : st.missing.length ? `${st.missing.length} needed` : state === "done" ? "Complete" : s.hint}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
            <p className="mt-4 hidden px-3 text-[12px] leading-relaxed text-ink-3 lg:block">
              Jump to any section in any order. Changes save when you move on, or press <Kbd>Ctrl</Kbd> <Kbd>S</Kbd>.
            </p>
          </nav>

          {/* Active section */}
          <Card className="min-w-0 p-5 sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold tracking-[0.12em] text-ink-3 uppercase">Step {idx + 1} of {SECTIONS.length}</div>
                <h2 className="mt-1 font-display text-3xl leading-none tracking-tight text-ink">{SECTIONS[idx]!.label}</h2>
              </div>
              {here.errors.length > 0 && <Badge tone="bad"><AlertCircle className="h-3 w-3" /> {here.errors.length} to fix</Badge>}
            </div>

            {showHereReminder && (
              <div className="mb-6 animate-rise rounded-2xl border border-warn/30 bg-warn-soft/50 p-4" role="status">
                <div className="flex items-start gap-3">
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">You missed {hereMissing.length === 1 ? "one thing" : `${hereMissing.length} things`} here</p>
                    <p className="text-[13px] text-ink-2">No rush. Your draft is safe, but these are needed before the employee can be created.</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {hereMissing.slice(0, 12).map((k) => (
                        <button key={k} type="button" onClick={() => jumpToField(k)} className="rounded-full border border-warn/30 bg-surface px-2.5 py-1 text-[12px] font-medium text-ink hover:border-warn">
                          {labelFor(k)}
                        </button>
                      ))}
                      {hereMissing.length > 12 && <span className="px-1 py-1 text-[12px] text-ink-3">+{hereMissing.length - 12} more</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div key={section} className="animate-rise">
              <Render {...sectionProps} />
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
              {prev ? (
                <Button variant="ghost" onClick={() => goTo(prev.id)}>
                  <ArrowLeft className="h-4 w-4" /> <span className="max-sm:hidden">{prev.label}</span>
                </Button>
              ) : <span />}
              {next ? (
                <Button variant="secondary" onClick={() => goTo(next.id)} className="group">
                  Next: {next.label} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              ) : isDraft ? (
                <Button variant="primary" onClick={() => setReviewOpen(true)}><Sparkles className="h-4 w-4" /> Review & finish</Button>
              ) : (
                <Button variant="primary" onClick={() => void saveSection(section)} disabled={!dirtyBySection[section] || saving > 0}><Save className="h-4 w-4" /> Save</Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {reviewOpen && (
        <ReviewDrawer
          missing={comp.missing}
          errors={errors}
          pct={pct}
          dirty={anyDirty}
          busy={submitting || saving > 0}
          onJump={jumpToField}
          onClose={() => setReviewOpen(false)}
          onSubmit={() => void submit()}
        />
      )}

      {confirmDiscard && (
        <ConfirmDialog
          title="Discard this draft?"
          body={<>The draft and any files uploaded to it are deleted for good. This can&apos;t be undone.</>}
          confirmLabel="Discard draft"
          danger
          busy={discarding}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => void discard()}
        />
      )}

      {leaveTo && (
        <ConfirmDialog
          title="Save before you go?"
          body="You have changes that haven't been saved yet."
          confirmLabel="Save & leave"
          busy={saving > 0}
          onCancel={() => setLeaveTo(null)}
          onConfirm={async () => {
            if (await saveAll()) leave(leaveTo);
            else setLeaveTo(null);
          }}
        >
          <button type="button" onClick={() => leave(leaveTo)} className="mt-4 text-[13px] font-medium text-bad hover:underline">
            Leave without saving
          </button>
        </ConfirmDialog>
      )}
    </FieldStatusContext.Provider>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="4" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={pct === 100 ? "var(--ok)" : "var(--accent)"} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-all duration-700" />
    </svg>
  );
}

/* ================= review before submit ================= */

function ReviewDrawer({
  missing,
  errors,
  pct,
  dirty,
  busy,
  onJump,
  onClose,
  onSubmit,
}: {
  missing: Record<string, string>;
  errors: Record<string, string>;
  pct: number;
  dirty: boolean;
  busy: boolean;
  onJump: (key: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const all = { ...missing, ...errors };
  const keys = Object.keys(all);
  const groups = SECTIONS.map((s) => ({ ...s, keys: keys.filter((k) => sectionOf(k) === s.id) })).filter((g) => g.keys.length);
  const ready = keys.length === 0;

  return (
    <Drawer
      wide
      title={ready ? "Ready to create" : "Almost there"}
      subtitle={ready ? "Everything needed is filled in." : `${keys.length} item${keys.length === 1 ? "" : "s"} left · ${pct}% complete`}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Keep editing</Button>
          <Button variant="primary" onClick={onSubmit} disabled={!ready || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {dirty ? "Save & create" : "Create & send invite"}
          </Button>
        </>
      }
    >
      {ready ? (
        <div className="flex flex-col items-center py-10 text-center">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-accent-ink"><Sparkles className="h-7 w-7" /></span>
          <h3 className="mt-4 text-lg font-semibold text-ink">Looking good</h3>
          <p className="mt-1 max-w-xs text-sm text-ink-2">Creating the employee gives them a code and emails an invite to their business email.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-ink-2">These are needed before the employee can be created. Tap one to go straight to it. Your draft stays saved in the meantime.</p>
          {groups.map((g) => {
            const Icon = ICONS[g.id];
            return (
              <div key={g.id}>
                <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
                  <Icon className="h-3.5 w-3.5" /> {g.label}
                </div>
                <ul className="divide-y divide-line rounded-2xl border border-line">
                  {g.keys.map((k) => (
                    <li key={k}>
                      <button type="button" onClick={() => onJump(k)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", errors[k] ? "bg-bad" : "bg-warn")} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">{labelFor(k)}</span>
                          <span className={cn("block text-[12px]", errors[k] ? "text-bad" : "text-ink-3")}>{all[k]}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
