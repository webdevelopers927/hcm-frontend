"use client";

import { Baby, Briefcase, ChevronDown, Download, FilePlus2, FileText, GraduationCap, HeartHandshake, Loader2, Plus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { formatCnicInput } from "@/lib/api/display";
import { downloadPrivateFile } from "@/lib/api/employees";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../api-ui";
import { Combobox, F, FilePicker, SecretInput, Switch, TextArea, TextInput, uploadHint, useUploader } from "./controls";
import { blankChild, blankExp, blankQual, blankSpouse, fieldId, formatBytes, rowKey, type ExpRow, type FileRefLike } from "./model";
import { GeoFields, dialCode, phoneHint, phonePlaceholder, type SectionProps } from "./sections-main";

const MAX = { spouses: 4, children: 20, qualifications: 20, work_experiences: 20, documents: 50 } as const;

function Empty({ icon: Icon, title, body, action }: { icon: typeof Plus; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-ink-2">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-ink-3">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function RowCard({ title, subtitle, onRemove, removeLabel, children, missing, collapsed, onToggle, id }: { title: ReactNode; subtitle?: ReactNode; onRemove: () => void; removeLabel: string; children: ReactNode; missing?: number; collapsed?: boolean; onToggle?: () => void; id?: string }) {
  return (
    <div id={id} tabIndex={-1} className="animate-rise rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        {onToggle ? (
          <button type="button" onClick={onToggle} aria-expanded={!collapsed} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform", collapsed && "-rotate-90")} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">{title}</span>
              {subtitle && <span className="block truncate text-[12px] text-ink-3">{subtitle}</span>}
            </span>
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{title}</div>
            {subtitle && <div className="truncate text-[12px] text-ink-3">{subtitle}</div>}
          </div>
        )}
        {!!missing && <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">{missing} to fill</span>}
        <button type="button" onClick={onRemove} aria-label={removeLabel} className="shrink-0 rounded-lg p-2 text-ink-3 hover:bg-bad-soft hover:text-bad">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {!collapsed && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}

const countMissing = (missing: Record<string, string>, prefix: string) => Object.keys(missing).filter((k) => k.startsWith(prefix)).length;

/* ---------------- 4. Family ---------------- */

export function FamilySection({ form, set, clearErrors, reveal, missing }: SectionProps) {
  const spouses = form.spouses;
  const update = (i: number, patch: Partial<(typeof spouses)[number]>, field?: string) =>
    set("spouses", spouses.map((s, j) => (j === i ? { ...s, ...patch } : s)), field ? [`spouses.${i}.${field}`] : []);
  const remove = (i: number) => {
    clearErrors("spouses.");
    set("spouses", spouses.filter((_, j) => j !== i));
  };
  const add = () => set("spouses", [...spouses, blankSpouse()]);

  if (spouses.length === 0) {
    return <Empty icon={HeartHandshake} title="No spouses added" body="Add a spouse to record their details and any children." action={<Button variant="secondary" onClick={add} id={fieldId("spouses")}><Plus className="h-4 w-4" /> Add spouse</Button>} />;
  }

  return (
    <div className="space-y-4">
      {spouses.map((s, i) => (
        <RowCard
          key={s.key}
          id={fieldId(`spouses.${i}`)}
          title={s.full_name || `Spouse ${i + 1}`}
          subtitle={`${s.children.length} child${s.children.length === 1 ? "" : "ren"}`}
          missing={countMissing(missing, `spouses.${i}.`)}
          onRemove={() => remove(i)}
          removeLabel={`Remove spouse ${i + 1}`}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput name={`spouses.${i}.full_name`} label="Full name" value={s.full_name} onChange={(v) => update(i, { full_name: v }, "full_name")} required maxLength={200} />
            <SecretInput
              name={`spouses.${i}.cnic`}
              label="CNIC"
              masked={s.cnic_masked}
              revealed={s.id ? reveal.data?.spouses.find((x) => x.id === s.id)?.cnic : undefined}
              value={s.cnic}
              onChange={(v) => update(i, { cnic: v }, "cnic")}
              onReveal={reveal.allowed && s.id ? reveal.reveal : undefined}
              onHide={reveal.hide}
              revealing={reveal.loading}
              format={formatCnicInput}
              inputMode="numeric"
              placeholder="35202-1234567-1"
            />
            <TextInput name={`spouses.${i}.birth_date`} label="Date of birth" type="date" value={s.birth_date} onChange={(v) => update(i, { birth_date: v }, "birth_date")} />
          </div>

          <div className="mt-5 rounded-xl bg-surface-2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">Children</span>
              <Button size="sm" variant="ghost" disabled={s.children.length >= MAX.children} onClick={() => update(i, { children: [...s.children, blankChild()] })}>
                <Plus className="h-3.5 w-3.5" /> Add child
              </Button>
            </div>
            {s.children.length === 0 ? (
              <p className="flex items-center gap-2 px-1 py-2 text-[13px] text-ink-3"><Baby className="h-4 w-4" /> No children recorded.</p>
            ) : (
              <div className="space-y-3">
                {s.children.map((c, j) => (
                  <div key={c.key} className="grid items-end gap-3 sm:grid-cols-[1fr_200px_auto]">
                    <TextInput
                      name={`spouses.${i}.children.${j}.full_name`}
                      label={`Child ${j + 1} · Full name`}
                      value={c.full_name}
                      required
                      maxLength={200}
                      onChange={(v) => update(i, { children: s.children.map((x, k) => (k === j ? { ...x, full_name: v } : x)) }, `children.${j}.full_name`)}
                    />
                    <TextInput
                      name={`spouses.${i}.children.${j}.birth_date`}
                      label="Date of birth"
                      type="date"
                      value={c.birth_date}
                      onChange={(v) => update(i, { children: s.children.map((x, k) => (k === j ? { ...x, birth_date: v } : x)) }, `children.${j}.birth_date`)}
                    />
                    <button
                      type="button"
                      aria-label={`Remove child ${j + 1}`}
                      onClick={() => {
                        clearErrors(`spouses.${i}.children.`);
                        update(i, { children: s.children.filter((_, k) => k !== j) });
                      }}
                      className="mb-1 h-9 w-9 rounded-lg text-ink-3 hover:bg-bad-soft hover:text-bad"
                    >
                      <Trash2 className="mx-auto h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </RowCard>
      ))}
      <Button variant="secondary" onClick={add} disabled={spouses.length >= MAX.spouses}>
        <Plus className="h-4 w-4" /> Add spouse {spouses.length >= MAX.spouses && <span className="text-ink-3">(max {MAX.spouses})</span>}
      </Button>
    </div>
  );
}

/* ---------------- 6. Qualification ---------------- */

export function QualificationSection({ form, set, clearErrors, options, missing }: SectionProps) {
  const rows = form.qualifications;
  const update = (i: number, patch: Partial<(typeof rows)[number]>, field: string) => set("qualifications", rows.map((r, j) => (j === i ? { ...r, ...patch } : r)), [`qualifications.${i}.${field}`]);
  const add = () => set("qualifications", [...rows, blankQual()]);

  if (rows.length === 0) {
    return <Empty icon={GraduationCap} title="No qualifications yet" body="Add degrees and certificates, most recent first." action={<Button variant="secondary" onClick={add}><Plus className="h-4 w-4" /> Add qualification</Button>} />;
  }
  return (
    <div className="space-y-4">
      {rows.map((q, i) => (
        <RowCard
          key={q.key}
          id={fieldId(`qualifications.${i}`)}
          title={q.degree_program?.name ?? `Qualification ${i + 1}`}
          subtitle={[q.institution, q.year].filter(Boolean).join(" · ") || undefined}
          missing={countMissing(missing, `qualifications.${i}.`)}
          onRemove={() => {
            clearErrors("qualifications.");
            set("qualifications", rows.filter((_, j) => j !== i));
          }}
          removeLabel={`Remove qualification ${i + 1}`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name={`qualifications.${i}.institution`} label="University / college name" value={q.institution} onChange={(v) => update(i, { institution: v }, "institution")} required />
            <Combobox
              name={`qualifications.${i}.degree_program_id`}
              label="Degree program"
              value={q.degree_program}
              items={options.degree_programs}
              onChange={(v) => update(i, { degree_program: v }, "degree_program_id")}
              required
              placeholder="e.g. BS Computer Science"
            />
            <TextInput name={`qualifications.${i}.start_date`} label="Start date" type="date" value={q.start_date} onChange={(v) => update(i, { start_date: v }, "start_date")} />
            <TextInput name={`qualifications.${i}.end_date`} label="End date" type="date" value={q.end_date} onChange={(v) => update(i, { end_date: v }, "end_date")} min={q.start_date || undefined} />
            <TextInput
              name={`qualifications.${i}.year`}
              label="Passing year"
              inputMode="numeric"
              value={q.year}
              onChange={(v) => update(i, { year: v.replace(/\D/g, "").slice(0, 4) }, "year")}
              placeholder={q.end_date ? q.end_date.slice(0, 4) : "2018"}
            />
          </div>
        </RowCard>
      ))}
      <Button variant="secondary" onClick={add} disabled={rows.length >= MAX.qualifications}><Plus className="h-4 w-4" /> Add qualification</Button>
    </div>
  );
}

/* ---------------- 7. Work experience ---------------- */

function FileChip({ file, pending, onDownload, children }: { file: FileRefLike; pending?: boolean; onDownload?: () => void; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <FileText className="h-5 w-5 shrink-0 text-ink-3" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{file.name}</div>
        <div className="text-[12px] text-ink-3">
          {formatBytes(file.size)}
          {pending && <span className="ml-1.5 font-medium text-warn">· Pending, saved on next save</span>}
        </div>
      </div>
      {onDownload && (
        <button type="button" onClick={onDownload} aria-label={`Download ${file.name}`} className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink">
          <Download className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}

async function download(url: string, name: string) {
  try {
    await downloadPrivateFile(url, name);
  } catch (e) {
    toast(errorMessage(e), "bad");
  }
}

function LetterField({ row, i, onChange }: { row: ExpRow; i: number; onChange: (patch: Partial<ExpRow>) => void }) {
  const uploader = useUploader("experience_letter");
  const name = `work_experiences.${i}.experience_letter`;
  const current = row.letterPending ? { name: row.letterPending.upload.original_name, size: row.letterPending.upload.size } : row.letter && !row.letterRemoved ? row.letter : null;
  const pick = async (f: File) => {
    const up = await uploader.upload(f);
    if (up) onChange({ letterPending: up, letterRemoved: false });
  };
  return (
    <F name={name} label="Experience letter" required className="sm:col-span-2" hint={uploadHint("experience_letter")}>
      {({ id, invalid }) => (
        <FilePicker purpose="experience_letter" onFile={pick}>
          {(open) =>
            current ? (
              <FileChip file={current} pending={!!row.letterPending} onDownload={!row.letterPending && row.letter ? () => download(row.letter!.download_url, row.letter!.name) : undefined}>
                <button type="button" id={id} onClick={open} disabled={uploader.busy} aria-label="Replace letter" className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink">
                  {uploader.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => onChange({ letterPending: null, letterRemoved: !!row.letter })} aria-label="Remove letter" className="rounded-lg p-2 text-ink-3 hover:bg-bad-soft hover:text-bad">
                  <Trash2 className="h-4 w-4" />
                </button>
              </FileChip>
            ) : (
              <button
                type="button"
                id={id}
                onClick={open}
                disabled={uploader.busy}
                className={cn("flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-[13px] font-medium text-ink-2 hover:border-line-strong hover:text-ink", invalid ? "border-bad" : "border-line")}
              >
                {uploader.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Upload letter
              </button>
            )
          }
        </FilePicker>
      )}
    </F>
  );
}

export function ExperienceSection({ form, set, patch, clearErrors, countries, missing }: SectionProps) {
  const rows = form.work_experiences;
  const [confirmOff, setConfirmOff] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(rows.length > 1 ? rows.slice(1).map((r) => r.key) : []));
  const update = (i: number, p: Partial<ExpRow>, fields: string[] = []) =>
    set("work_experiences", rows.map((r, j) => (j === i ? { ...r, ...p } : r)), fields.map((f) => `work_experiences.${i}.${f}`));
  const add = () => set("work_experiences", [...rows, blankExp()], ["work_experiences"]);
  const toggle = (k: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="space-y-5">
      <Switch
        name="has_work_experience"
        label="Has previous work experience"
        description="Turn off for fresh graduates and interns."
        checked={form.has_work_experience}
        onChange={(v) => {
          if (!v && rows.length > 0) return setConfirmOff(true);
          patch(v && rows.length === 0 ? { has_work_experience: true, work_experiences: [blankExp()] } : { has_work_experience: v }, ["has_work_experience", "work_experiences"]);
        }}
      />

      {form.has_work_experience &&
        (rows.length === 0 ? (
          <Empty icon={Briefcase} title="No experience added" body="Add at least one previous job, or switch this off." action={<Button variant="secondary" onClick={add} id={fieldId("work_experiences")}><Plus className="h-4 w-4" /> Add experience</Button>} />
        ) : (
          <div className="space-y-4">
            {rows.map((w, i) => {
              const dial = dialCode(w.country, countries);
              return (
                <RowCard
                  key={w.key}
                  id={fieldId(`work_experiences.${i}`)}
                  title={w.company_name || `Experience ${i + 1}`}
                  subtitle={[w.designation, [w.period_from.slice(0, 4), w.period_to.slice(0, 4)].filter(Boolean).join("–")].filter(Boolean).join(" · ") || undefined}
                  missing={countMissing(missing, `work_experiences.${i}.`)}
                  collapsed={collapsed.has(w.key)}
                  onToggle={() => toggle(w.key)}
                  onRemove={() => {
                    clearErrors("work_experiences.");
                    set("work_experiences", rows.filter((_, j) => j !== i));
                  }}
                  removeLabel={`Remove experience ${i + 1}`}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextInput name={`work_experiences.${i}.company_name`} label="Company" value={w.company_name} onChange={(v) => update(i, { company_name: v }, ["company_name"])} required />
                    <TextInput name={`work_experiences.${i}.designation`} label="Designation" value={w.designation} onChange={(v) => update(i, { designation: v }, ["designation"])} required />
                    <TextInput name={`work_experiences.${i}.period_from`} label="From" type="date" value={w.period_from} onChange={(v) => update(i, { period_from: v }, ["period_from"])} required />
                    <TextInput name={`work_experiences.${i}.period_to`} label="To" type="date" value={w.period_to} onChange={(v) => update(i, { period_to: v }, ["period_to"])} min={w.period_from || undefined} required />
                    <TextInput
                      name={`work_experiences.${i}.last_salary`}
                      label="Last salary"
                      inputMode="decimal"
                      value={w.last_salary}
                      onChange={(v) => update(i, { last_salary: v.replace(/[^\d.]/g, "") }, ["last_salary"])}
                      placeholder="150000"
                      required
                    />
                    <div className="hidden sm:block" />
                    <GeoFields
                      prefix={`work_experiences.${i}.`}
                      country={w.country}
                      state={w.state}
                      city={w.city}
                      countries={countries}
                      onCountry={(c) => update(i, { country: c, state: null, city: null }, ["country_id", "state_id", "city_id", "contact_person_phone"])}
                      onState={(s) => update(i, { state: s, city: null }, ["state_id", "city_id"])}
                      onCity={(c) => update(i, { city: c }, ["city_id"])}
                    />
                  </div>
                  <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
                    <TextInput name={`work_experiences.${i}.contact_person_name`} label="Contact person" value={w.contact_person_name} onChange={(v) => update(i, { contact_person_name: v }, ["contact_person_name"])} required />
                    <TextInput name={`work_experiences.${i}.contact_person_email`} label="Contact email" type="email" value={w.contact_person_email} onChange={(v) => update(i, { contact_person_email: v }, ["contact_person_email"])} required />
                    <TextInput
                      name={`work_experiences.${i}.contact_person_phone`}
                      label="Contact number"
                      type="tel"
                      inputMode="tel"
                      value={w.contact_person_phone}
                      onChange={(v) => update(i, { contact_person_phone: v }, ["contact_person_phone"])}
                      hint={phoneHint(dial, w.country?.name)}
                      placeholder={phonePlaceholder(dial)}
                      required
                    />
                  </div>
                  <div className="mt-5 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
                    <LetterField row={w} i={i} onChange={(p) => update(i, p, ["experience_letter"])} />
                    <TextInput name={`work_experiences.${i}.reason_for_leaving`} label="Reason for leaving" value={w.reason_for_leaving} onChange={(v) => update(i, { reason_for_leaving: v }, ["reason_for_leaving"])} required className="sm:col-span-2" />
                    <TextArea name={`work_experiences.${i}.description`} label="Description" value={w.description} onChange={(v) => update(i, { description: v }, ["description"])} hint="Optional" className="sm:col-span-2" />
                  </div>
                </RowCard>
              );
            })}
            <Button variant="secondary" onClick={add} disabled={rows.length >= MAX.work_experiences}><Plus className="h-4 w-4" /> Add experience</Button>
          </div>
        ))}

      {confirmOff && (
        <ConfirmDialog
          title="Remove all work experience?"
          body={<>This deletes {rows.length} experience{rows.length === 1 ? "" : "s"} and any letters when you save. You can still cancel before saving.</>}
          confirmLabel="Switch off"
          danger
          onCancel={() => setConfirmOff(false)}
          onConfirm={() => {
            clearErrors("work_experiences");
            patch({ has_work_experience: false }, ["has_work_experience"]);
            setConfirmOff(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- 8. Documents ---------------- */

export function DocumentsSection({ form, set, clearErrors }: SectionProps) {
  const rows = form.documents;
  const uploader = useUploader("document");
  const [replacing, setReplacing] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const addFiles = async (files: File[]) => {
    let next = rows;
    for (const f of files.slice(0, MAX.documents - rows.length)) {
      const up = await uploader.upload(f);
      if (up) next = [...next, { key: rowKey(), title: f.name.replace(/\.[^.]+$/, ""), file: null, pending: up }];
    }
    if (next !== rows) set("documents", next, ["documents"]);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void addFiles(Array.from(e.dataTransfer.files));
  };

  const dropzone = (
    <FilePicker purpose="document" onFile={(f) => void addFiles([f])}>
      {(open) => (
        <button
          type="button"
          id={fieldId("documents")}
          onClick={open}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          disabled={uploader.busy || rows.length >= MAX.documents}
          className={cn("flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition disabled:opacity-50", over ? "border-ink bg-surface-2" : "border-line hover:border-line-strong")}
        >
          {uploader.busy ? <Loader2 className="h-6 w-6 animate-spin text-ink-3" /> : <FilePlus2 className="h-6 w-6 text-ink-3" />}
          <span className="text-sm font-semibold text-ink">{uploader.busy ? "Uploading…" : "Drop files or click to add"}</span>
          <span className="text-[12px] text-ink-3">{uploadHint("document")} · up to {MAX.documents} files</span>
        </button>
      )}
    </FilePicker>
  );

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <>
          <Empty icon={FileText} title="No documents on record" body="CNIC copies, degrees, contracts. Anything HR should keep on file." />
          {dropzone}
        </>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {rows.map((d, i) => {
              const file = d.pending ? { name: d.pending.upload.original_name, size: d.pending.upload.size } : d.file;
              return (
                <li key={d.key} id={fieldId(`documents.${i}`)} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                  <FileText className="hidden h-8 w-8 shrink-0 text-ink-3 sm:block" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <label className="sr-only" htmlFor={fieldId(`documents.${i}.title`)}>Title for document {i + 1}</label>
                    <input
                      id={fieldId(`documents.${i}.title`)}
                      value={d.title}
                      onChange={(e) => set("documents", rows.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)), [`documents.${i}.title`])}
                      placeholder="Untitled document"
                      className="w-full rounded-lg bg-transparent px-1.5 py-1 text-sm font-semibold text-ink outline-none hover:bg-surface-2 focus:bg-surface-2 focus:ring-2 focus:ring-accent/40"
                    />
                    <div className="px-1.5 text-[12px] text-ink-3">
                      {file ? `${file.name} · ${formatBytes(file.size)}` : "No file"}
                      {d.pending && <span className="ml-1.5 font-medium text-warn">· Pending, saved on next save</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {d.file && !d.pending && (
                      <Button size="sm" variant="ghost" onClick={() => download(d.file!.download_url, d.file!.name)} aria-label={`Download ${d.file.name}`}>
                        <Download className="h-3.5 w-3.5" /> <span className="max-sm:hidden">Download</span>
                      </Button>
                    )}
                    <FilePicker
                      purpose="document"
                      onFile={async (f) => {
                        setReplacing(d.key);
                        const up = await uploader.upload(f);
                        setReplacing(null);
                        if (up) set("documents", rows.map((r, j) => (j === i ? { ...r, pending: up } : r)), [`documents.${i}.upload_id`]);
                      }}
                    >
                      {(open) => (
                        <Button size="sm" variant="ghost" onClick={open} disabled={uploader.busy}>
                          {replacing === d.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} <span className="max-sm:hidden">Replace</span>
                        </Button>
                      )}
                    </FilePicker>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${d.title || "document"}`}
                      onClick={() => {
                        clearErrors("documents.");
                        set("documents", rows.filter((_, j) => j !== i));
                      }}
                      className="hover:bg-bad-soft hover:text-bad"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {dropzone}
        </>
      )}
    </div>
  );
}
