"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/api/client";
import { downloadImportTemplate, employeeKeys, importEmployees, parseImportErrors } from "@/lib/api/employees";
import type { ImportRowError } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = [".csv", ".xlsx"];

const COLUMN_LABELS: Record<string, string> = {
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  cnic: "CNIC",
  gender: "Gender",
  birth_date: "Date of birth",
  pseudo_name: "Pseudo name",
  machine_uid: "Machine UID",
  department: "Department",
  designation: "Designation",
  division: "Division",
  campaign: "Campaign",
  shift: "Shift",
  location: "Location",
  reports_to: "Reports to",
  work_mode: "Work mode",
  status: "Status",
  duty_type: "Duty type",
  has_team_authority: "Team authority",
  join_date: "Join date",
};
const columnLabel = (c: string) => COLUMN_LABELS[c] ?? c.replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase());

type State =
  | { step: "pick"; fileError?: string }
  | { step: "valid"; total: number; message: string }
  | { step: "invalid"; message: string; rows: ImportRowError[] };

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>({ step: "pick" });
  const [busy, setBusy] = useState<"check" | "import" | "template" | null>(null);
  const [over, setOver] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  // Focus the dialog on open and give focus back to the trigger on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);

  // After a check, move focus to the result's main action (or back to the picker).
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("[data-autofocus]:not([disabled])")?.focus();
  }, [state.step, file]);

  function close() {
    if (busy === "import") return; // don't abandon a commit midway
    onClose();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const items = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function choose(f: File | undefined) {
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ACCEPT.includes(ext)) {
      setFile(null);
      setState({ step: "pick", fileError: "Choose a .csv or .xlsx file." });
      return;
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      setState({ step: "pick", fileError: `This file is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.` });
      return;
    }
    setFile(f);
    setState({ step: "pick" });
  }

  function reset() {
    setFile(null);
    setState({ step: "pick" });
    if (input.current) input.current.value = "";
  }

  async function run(dryRun: boolean) {
    if (!file || inFlight.current) return;
    inFlight.current = true;
    setBusy(dryRun ? "check" : "import");
    try {
      if (dryRun) {
        const res = await importEmployees(file, { dryRun: true });
        setState({ step: "valid", total: res.total_rows, message: res.message });
      } else {
        const res = await importEmployees(file, { dryRun: false });
        toast(`${res.imported} employees imported. Invitations are being sent.`);
        void qc.invalidateQueries({ queryKey: employeeKeys.all });
        onClose();
        return;
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const { file: fileError, rows } = parseImportErrors(e.errors);
        if (rows.length) setState({ step: "invalid", message: e.message, rows });
        else setState({ step: "pick", fileError: fileError ?? e.message });
      } else {
        toast(errorMessage(e), "bad");
      }
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function template() {
    setBusy("template");
    try {
      await downloadImportTemplate();
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(null);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (!busy) choose(e.dataTransfer.files[0]);
  };

  const errorCount = state.step === "invalid" ? state.rows.reduce((n, r) => n + r.messages.length, 0) : 0;
  const lines = state.step === "invalid" ? new Set(state.rows.map((r) => r.line)).size : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 animate-fade bg-black/40 backdrop-blur-[2px]" onClick={close} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        aria-describedby="import-desc"
        className="relative flex max-h-[94dvh] w-full max-w-2xl animate-rise flex-col rounded-t-3xl bg-surface shadow-pop sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 id="import-title" className="text-lg font-semibold tracking-tight text-ink">Import employees</h2>
            <p id="import-desc" className="mt-0.5 text-[13px] text-ink-3">Upload a CSV or Excel file. We check every row before anything is saved.</p>
          </div>
          <button onClick={close} disabled={busy === "import"} aria-label="Close" className="rounded-xl p-2 text-ink-2 hover:bg-surface-3 hover:text-ink disabled:opacity-40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* File picker / chosen file */}
          {state.step === "pick" ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={onDrop}
                className={cn("rounded-2xl border-2 border-dashed p-6 text-center transition", over ? "border-ink bg-accent-soft" : state.fileError ? "border-bad/50" : "border-line-strong")}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3 text-left">
                    <FileSpreadsheet className="h-8 w-8 shrink-0 text-ok" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{file.name}</div>
                      <div className="text-[12px] text-ink-3">{(file.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={reset} disabled={!!busy}>Change</Button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className="mx-auto h-8 w-8 text-ink-3" />
                    <p className="mt-3 text-sm font-medium text-ink">Drop your file here, or</p>
                    <Button size="sm" variant="secondary" className="mt-2" onClick={() => input.current?.click()} data-autofocus>
                      Choose file
                    </Button>
                    <p className="mt-2 text-[12px] text-ink-3">.csv or .xlsx · up to 5 MB · up to 500 rows</p>
                  </>
                )}
                <label htmlFor="import-file" className="sr-only">Employee file (.csv or .xlsx)</label>
                <input
                  ref={input}
                  id="import-file"
                  type="file"
                  accept={ACCEPT.join(",")}
                  className="sr-only"
                  tabIndex={-1}
                  aria-invalid={!!state.fileError || undefined}
                  aria-describedby={state.fileError ? "import-file-error" : undefined}
                  onChange={(e) => choose(e.target.files?.[0])}
                />
              </div>
              {state.fileError && (
                <p id="import-file-error" role="alert" className="-mt-2 flex gap-2 text-[13px] font-medium text-bad">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {state.fileError}
                </p>
              )}

              <div className="rounded-2xl bg-surface-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-ink">How to fill the file</h3>
                  <Button size="sm" variant="secondary" onClick={template} disabled={busy === "template"}>
                    {busy === "template" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download template
                  </Button>
                </div>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-ink-2">
                  <li>Required in every row: first name, last name, email, <strong className="text-ink">CNIC</strong>, department, designation, <strong className="text-ink">status</strong>, <strong className="text-ink">duty type</strong> and join date.</li>
                  <li>Department, designation, shift, location, division and campaign use <strong className="text-ink">names</strong> (e.g. “Engineering”, “Morning”), not ids. The designation must belong to the department.</li>
                  <li><code className="rounded bg-surface-3 px-1 text-[12px]">reports_to</code> is an existing employee code (EMP-0001) or email, or the email of another row in the same file. That person must have team authority.</li>
                  <li><code className="rounded bg-surface-3 px-1 text-[12px]">has_team_authority</code> is optional: yes or no.</li>
                  <li>Phone numbers must be in international format, e.g. <span className="tabular">+92 300 1234567</span>.</li>
                  <li>Dates are <code className="rounded bg-surface-3 px-1 text-[12px]">YYYY-MM-DD</code>.</li>
                  <li>Status: active, probation, on leave, notice period, inactive. Duty type: full time, part time, contract, freelance, internship, temporary, consultant. Work mode: onsite, hybrid, remote.</li>
                  <li>If any row has an error, <strong className="text-ink">nothing is imported</strong>. Every imported employee receives an invitation email.</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <FileSpreadsheet className="h-6 w-6 shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{file?.name}</span>
              <Button size="sm" variant="ghost" onClick={reset} disabled={!!busy}>
                <RotateCcw className="h-3.5 w-3.5" /> Choose a different file
              </Button>
            </div>
          )}

          {state.step === "valid" && (
            <div role="status" className="flex gap-3 rounded-2xl bg-ok-soft p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-ok" />
              <div>
                <p className="text-sm font-semibold text-ink">All {state.total} rows are valid.</p>
                <p className="mt-0.5 text-[13px] text-ink-2">Nothing has been saved yet. Import to create the employees and send their invitations.</p>
              </div>
            </div>
          )}

          {state.step === "invalid" && (
            <div className="space-y-3">
              <div role="alert" className="flex gap-3 rounded-2xl bg-bad-soft p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-bad" />
                <div>
                  <p className="text-sm font-semibold text-ink">{state.message}</p>
                  <p className="mt-0.5 text-[13px] text-ink-2">Fix these {errorCount} problem{errorCount === 1 ? "" : "s"} on {lines} line{lines === 1 ? "" : "s"} in your file, then upload it again. Line numbers match your spreadsheet (the header is line 1).</p>
                </div>
              </div>
              <div className="max-h-[40vh] overflow-auto rounded-2xl border border-line">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Import errors by spreadsheet line</caption>
                  <thead className="sticky top-0 bg-surface-2">
                    <tr className="text-[12px] tracking-wide text-ink-3 uppercase">
                      <th scope="col" className="w-16 px-4 py-2.5 font-medium">Line</th>
                      <th scope="col" className="w-36 px-4 py-2.5 font-medium">Column</th>
                      <th scope="col" className="px-4 py-2.5 font-medium">Problem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {state.rows.flatMap((r) =>
                      r.messages.map((msg, i) => (
                        <tr key={`${r.line}-${r.column}-${i}`}>
                          <td className="tabular px-4 py-2.5 font-semibold text-ink">{r.line}</td>
                          <td className="px-4 py-2.5 text-ink-2">{columnLabel(r.column)}</td>
                          <td className="px-4 py-2.5 text-ink">{msg}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))] [&>*]:flex-1 [&>*]:justify-center">
          <Button variant="secondary" onClick={close} disabled={busy === "import"}>Cancel</Button>
          {state.step === "valid" ? (
            <Button variant="primary" onClick={() => run(false)} disabled={!!busy} data-autofocus>
              {busy === "import" ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : `Import ${state.total} employee${state.total === 1 ? "" : "s"}`}
            </Button>
          ) : state.step === "invalid" ? (
            <Button variant="primary" onClick={reset} disabled={!!busy} data-autofocus>Choose a different file</Button>
          ) : (
            <Button variant="primary" onClick={() => run(true)} disabled={!file || !!busy} data-autofocus>
              {busy === "check" ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking…</> : "Check file"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
