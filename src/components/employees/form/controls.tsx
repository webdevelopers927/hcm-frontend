"use client";

import { CircleDashed, Eye, EyeOff, Loader2, Pencil, Undo2 } from "lucide-react";
import { createContext, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/primitives";
import { EntitySelect, Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { uploadFile } from "@/lib/api/employees";
import type { UploadPurpose } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { REQUIRED, fieldId, formatBytes, type PendingFile } from "./model";

/* ---------- field status context ---------- */

type FieldStatus = {
  errors: Record<string, string>;
  /** Missing keys the user has already walked past; shown as a soft nudge, never as an error. */
  nudges: Record<string, string>;
  flash: string | null;
};
export const FieldStatusContext = createContext<FieldStatus>({ errors: {}, nudges: {}, flash: null });
const useStatus = (name: string) => {
  const s = useContext(FieldStatusContext);
  return { error: s.errors[name], nudge: s.nudges[name], flash: s.flash === name };
};

/** Label + control + one line of feedback: the server's error, else a gentle "still needed" nudge. */
export function F({
  name,
  label,
  hint,
  required,
  className,
  children,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (p: { id: string; invalid: boolean; describedBy?: string; nudged: boolean }) => ReactNode;
}) {
  const { error, nudge, flash } = useStatus(name);
  const id = fieldId(name);
  const msgId = `${id}-msg`;
  const isRequired = required ?? REQUIRED.has(name);
  return (
    <div className={cn("space-y-1.5 rounded-xl transition-shadow", flash && "animate-flash", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-ink">
          {label}
          {isRequired && <span className="ml-1 text-ink-3" aria-hidden title="Needed to finish">*</span>}
          {isRequired && <span className="sr-only"> (needed to finish)</span>}
        </label>
        {hint && <span className="truncate text-[12px] text-ink-3">{hint}</span>}
      </div>
      {children({ id, invalid: !!error, describedBy: error || nudge ? msgId : undefined, nudged: !error && !!nudge })}
      {error ? (
        <p id={msgId} role="alert" className="text-[12px] font-medium text-bad">{error}</p>
      ) : nudge ? (
        <p id={msgId} className="flex items-center gap-1.5 text-[12px] font-medium text-warn">
          <CircleDashed className="h-3 w-3" /> You skipped this, it&apos;s needed to finish
        </p>
      ) : null}
    </div>
  );
}

const nudgeCls = "border-warn/60 bg-warn-soft/40";

type TextProps = {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "date" | "tel" | "number";
  placeholder?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
  maxLength?: number;
  prefix?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
};

export function TextInput({ name, label, value, onChange, hint, required, className, prefix, ...rest }: TextProps) {
  return (
    <F name={name} label={label} hint={hint} required={required} className={className}>
      {({ id, invalid, describedBy, nudged }) => (
        <div className="relative">
          {prefix && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-ink-3 tabular">{prefix}</span>}
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            invalid={invalid}
            aria-describedby={describedBy}
            autoComplete="off"
            className={cn(prefix && "pl-14", nudged && nudgeCls)}
            {...rest}
          />
        </div>
      )}
    </F>
  );
}

export function TextArea({ name, label, value, onChange, hint, required, className, maxLength, placeholder }: Omit<TextProps, "type"> & { rows?: number }) {
  return (
    <F name={name} label={label} hint={hint} required={required} className={className}>
      {({ id, invalid, describedBy, nudged }) => (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          maxLength={maxLength}
          placeholder={placeholder}
          rows={3}
          className={cn(
            "w-full resize-y rounded-xl border bg-surface px-3.5 py-2.5 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-ink focus:ring-4 focus:ring-accent/40 sm:text-sm",
            invalid ? "border-bad" : "border-line hover:border-line-strong",
            nudged && nudgeCls,
          )}
        />
      )}
    </F>
  );
}

export function SelectInput({
  name,
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  hint,
  required,
  className,
  disabled,
  clearable = true,
  footer,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** Extra line under the control (e.g. what the chosen option implies). */
  footer?: ReactNode;
}) {
  return (
    <F name={name} label={label} hint={hint} required={required} className={className}>
      {({ id, invalid, describedBy, nudged }) => (
        <>
          <Select inputId={id} value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} clearable={clearable && !!value} invalid={invalid} nudged={nudged} aria-describedby={describedBy} />
          {footer}
        </>
      )}
    </F>
  );
}

/** Segmented single choice. Clicking the active option clears it. */
export function Segmented({ name, label, value, onChange, options, className }: { name: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  const { error } = useStatus(name);
  return (
    <fieldset className={className} id={fieldId(name)} tabIndex={-1}>
      <legend className="text-[13px] font-medium text-ink">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(value === o.value ? "" : o.value)}
            aria-pressed={value === o.value}
            className={cn("h-10 min-w-16 flex-1 rounded-xl border px-3 text-[13px] font-medium transition", value === o.value ? "border-ink bg-ink text-canvas" : "border-line text-ink-2 hover:border-line-strong")}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-1.5 text-[12px] font-medium text-bad">{error}</p>}
    </fieldset>
  );
}

export function Switch({ name, label, description, checked, onChange, disabled }: { name: string; label: string; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const { error } = useStatus(name);
  const descId = useId();
  return (
    <div className="rounded-2xl border border-line p-3.5">
      <div className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium text-ink" id={`${fieldId(name)}-label`}>{label}</span>
          {description && <span id={descId} className="mt-0.5 block text-[12px] text-ink-3">{description}</span>}
        </span>
        <button
          type="button"
          role="switch"
          id={fieldId(name)}
          aria-checked={checked}
          aria-labelledby={`${fieldId(name)}-label`}
          aria-describedby={description ? descId : undefined}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition outline-none focus-visible:ring-4 focus-visible:ring-accent/40 disabled:opacity-50", checked ? "bg-ink" : "bg-surface-3")}
        >
          <span className={cn("inline-block h-5 w-5 rounded-full bg-surface shadow-soft transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
          <span className="sr-only">{checked ? "On" : "Off"}</span>
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-[12px] font-medium text-bad">{error}</p>}
    </div>
  );
}

/* ---------- searchable record picker ---------- */

type Item = { id: number; name: string };

/** Keyboard-usable picker (react-select): type to filter, ↑/↓ to move, Enter to pick, Esc to close. */
export function Combobox<T extends Item>({
  name,
  label,
  value,
  onChange,
  items,
  search,
  loading,
  disabled,
  placeholder = "Search…",
  hint,
  required,
  className,
  emptyText = "No matches",
  renderOption,
  renderValue,
}: {
  name: string;
  label: string;
  /** Only id/name are read, so a lighter ref than the option type is fine. */
  value: Item | null;
  onChange: (v: T | null) => void;
  /** Static list, filtered on the client. */
  items?: T[];
  /** Or an async search; `key` identifies the source so results reset when it changes. */
  search?: { key: readonly unknown[]; fn: (term: string, signal: AbortSignal) => Promise<T[]> };
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  emptyText?: string;
  renderOption?: (item: T) => ReactNode;
  /** Shown before the selected value (e.g. an avatar). */
  renderValue?: ReactNode;
}) {
  const cacheKey = search ? JSON.stringify(search.key) : undefined;
  const fn = search?.fn;
  const load = useMemo(() => (fn ? (term: string) => fn(term, new AbortController().signal) : undefined), [fn]);
  return (
    <F name={name} label={label} hint={hint} required={required} className={className}>
      {({ id, invalid, describedBy, nudged }) => (
        <EntitySelect<T>
          inputId={id}
          value={value}
          onChange={onChange}
          options={items}
          load={load}
          cacheKey={cacheKey}
          loading={loading}
          disabled={disabled}
          placeholder={placeholder}
          noOptionsText={emptyText}
          renderOption={renderOption}
          renderValue={renderValue}
          invalid={invalid}
          nudged={nudged}
          aria-describedby={describedBy}
        />
      )}
    </F>
  );
}

/* ---------- masked national ids ---------- */

/**
 * Stored value is shown masked. "Reveal" asks the parent (one audited call for
 * all ids); "Change" swaps in an input whose value is sent only if typed.
 */
export function SecretInput({
  name,
  label,
  masked,
  revealed,
  value,
  onChange,
  onReveal,
  onHide,
  revealing,
  format,
  placeholder,
  hint,
  required,
  className,
  inputMode,
}: {
  name: string;
  label: string;
  masked: string | null;
  revealed: string | null | undefined;
  value: string;
  onChange: (v: string) => void;
  onReveal?: () => void;
  onHide?: () => void;
  revealing?: boolean;
  format?: (v: string) => string;
  placeholder?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  inputMode?: "text" | "numeric";
}) {
  const [editing, setEditing] = useState(false);
  const showInput = !masked || editing || value !== "";
  return (
    <F name={name} label={label} hint={hint} required={required} className={className}>
      {({ id, invalid, describedBy, nudged }) =>
        showInput ? (
          <div className="flex gap-2">
            <Input
              id={id}
              value={value}
              onChange={(e) => onChange(format ? format(e.target.value) : e.target.value)}
              invalid={invalid}
              aria-describedby={describedBy}
              placeholder={masked ? "Type the new value" : placeholder}
              inputMode={inputMode}
              autoComplete="off"
              className={cn(nudged && nudgeCls)}
              autoFocus={editing}
            />
            {masked && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setEditing(false);
                }}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-medium text-ink-2 hover:text-ink"
              >
                <Undo2 className="h-3.5 w-3.5" /> Keep current
              </button>
            )}
          </div>
        ) : (
          <div className={cn("flex h-11 items-center gap-2 rounded-xl border bg-surface-2 pr-1.5 pl-3.5", invalid ? "border-bad" : "border-line")}>
            <span id={id} tabIndex={-1} className={cn("tabular flex-1 truncate text-sm", revealed ? "font-medium text-ink" : "tracking-wider text-ink-2")} aria-describedby={describedBy}>
              {revealed ?? masked}
            </span>
            {onReveal &&
              (revealed ? (
                <button type="button" onClick={onHide} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-ink-2 hover:bg-surface-3 hover:text-ink">
                  <EyeOff className="h-3.5 w-3.5" /> Hide
                </button>
              ) : (
                <button type="button" onClick={onReveal} disabled={revealing} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-50">
                  {revealing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Reveal
                </button>
              ))}
            <button type="button" onClick={() => setEditing(true)} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-ink-2 hover:bg-surface-3 hover:text-ink">
              <Pencil className="h-3.5 w-3.5" /> Change
            </button>
          </div>
        )
      }
    </F>
  );
}

/* ---------- uploads ---------- */

const RULES: Record<UploadPurpose, { ext: string[]; max: number; label: string }> = {
  avatar: { ext: ["jpg", "jpeg", "png", "webp"], max: 2 * 1024 * 1024, label: "JPG, PNG or WebP up to 2 MB" },
  experience_letter: { ext: ["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"], max: 10 * 1024 * 1024, label: "PDF, image or Word up to 10 MB" },
  document: { ext: ["pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"], max: 10 * 1024 * 1024, label: "PDF, image or Word up to 10 MB" },
};
export const uploadHint = (p: UploadPurpose) => RULES[p].label;
export const uploadAccept = (p: UploadPurpose) => RULES[p].ext.map((e) => `.${e}`).join(",");

/** Validates on the client, then uploads. The returned id goes into the next save. */
export function useUploader(purpose: UploadPurpose) {
  const [busy, setBusy] = useState(false);
  async function upload(file: File): Promise<PendingFile | null> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const rule = RULES[purpose];
    if (!rule.ext.includes(ext)) {
      toast(`That file type isn't allowed. Use ${rule.label}.`, "bad");
      return null;
    }
    if (file.size > rule.max) {
      toast(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(rule.max)}.`, "bad");
      return null;
    }
    setBusy(true);
    try {
      const up = await uploadFile(purpose, file);
      return { upload: up, preview: purpose === "avatar" ? URL.createObjectURL(file) : undefined };
    } catch (e) {
      toast(errorMessage(e), "bad");
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { upload, busy };
}

/** Hidden file input behind any trigger. */
export function FilePicker({ purpose, onFile, children, id }: { purpose: UploadPurpose; onFile: (f: File) => void; children: (open: () => void) => ReactNode; id?: string }) {
  const auto = useId();
  const inputId = id ?? `file-${auto}`;
  const open = () => (document.getElementById(inputId) as HTMLInputElement | null)?.click();
  return (
    <>
      <input
        id={inputId}
        type="file"
        accept={uploadAccept(purpose)}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {children(open)}
    </>
  );
}
