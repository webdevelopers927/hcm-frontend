"use client";

import { Download, FileImage, FileText, MoreHorizontal, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Drawer, ModuleHeader, SearchBox, Segments, StatStrip, Toolbar, matches } from "@/components/employees/module-kit";
import { Avatar, Badge, Button, Card, Field } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { employees } from "@/lib/data";
import { DOC_TYPES, hrDocs as seed, type HrDoc } from "@/lib/module-data";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export function View() {
  const [docs, setDocs] = useState(seed);
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirm, setConfirm] = useState<HrDoc | null>(null);

  const list = docs.filter((d) => (type === "all" || d.type === type) && matches(q, d.employee.name, d.file, d.type));
  const expiring = docs.filter((d) => d.expires && daysUntil(d.expires) <= 60);

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="HR documents"
        description="Contracts, IDs, letters and certificates for every employee — searchable and tracked for expiry."
        actions={<Button variant="primary" onClick={() => setUploading(true)}><UploadCloud className="h-4 w-4" /> Upload</Button>}
      />
      <StatStrip
        items={[
          { label: "Documents", value: docs.length, hint: `${new Set(docs.map((d) => d.employee.id)).size} employees`, tone: "ink" },
          { label: "Expiring ≤ 60 days", value: expiring.length, hint: "Request renewals", tone: "warn" },
          { label: "Contracts", value: docs.filter((d) => d.type === "Contract").length, hint: "Signed copies", tone: "info" },
          { label: "Identity docs", value: docs.filter((d) => d.type === "CNIC").length, hint: "CNIC on file", tone: "ok" },
        ]}
      />
      <Toolbar>
        <Segments value={type} onChange={setType} options={[{ value: "all", label: "All", count: docs.length }, ...DOC_TYPES.map((t) => ({ value: t, label: t, count: docs.filter((d) => d.type === t).length }))]} />
        <SearchBox value={q} onChange={setQ} placeholder="File, employee or type" />
      </Toolbar>

      {list.length === 0 ? (
        <Card className="px-6 py-14 text-center text-sm text-ink-3">No documents match.</Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((d) => {
            const Icon = d.file.endsWith(".jpg") ? FileImage : FileText;
            const left = d.expires ? daysUntil(d.expires) : null;
            return (
              <li key={d.id}>
                <Card className="group flex h-full flex-col p-4 transition hover:shadow-float">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-ink-2"><Icon className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-ink" title={d.file}>{d.file}</div>
                      <div className="text-[12px] text-ink-3">{d.size} · {formatDate(d.uploadedAt, { day: "numeric", month: "short", year: "numeric" })}</div>
                    </div>
                    <DocMenu onDelete={() => setConfirm(d)} />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={d.employee.name} hue={d.employee.hue} size="xs" />
                      <span className="truncate text-[12px] text-ink-2">{d.employee.name}</span>
                    </span>
                    {left !== null && left <= 60 ? <Badge tone={left < 0 ? "bad" : "warn"}>{left < 0 ? "Expired" : `Expires in ${left}d`}</Badge> : <Badge>{d.type}</Badge>}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {uploading && (
        <UploadDrawer
          onClose={() => setUploading(false)}
          onSave={(added) => {
            setDocs((all) => [...added, ...all]);
            setUploading(false);
            toast(`${added.length} document${added.length > 1 ? "s" : ""} uploaded`);
          }}
        />
      )}
      {confirm && (
        <Drawer
          title="Delete document?"
          subtitle={confirm.file}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDocs((all) => all.filter((x) => x.id !== confirm.id));
                  setConfirm(null);
                  toast("Document deleted", "bad");
                }}
              >
                Delete permanently
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-2">This removes the file from {confirm.employee.name}&apos;s record for everyone. It can&apos;t be recovered.</p>
        </Drawer>
      )}
    </div>
  );
}

function DocMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Document actions" className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute top-8 right-0 z-20 w-40 animate-rise rounded-xl border border-line bg-surface p-1 shadow-pop">
          <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-ink-2 hover:bg-surface-2"><Download className="h-4 w-4" /> Download</button>
          <button onClick={onDelete} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-bad hover:bg-bad-soft"><Trash2 className="h-4 w-4" /> Delete</button>
        </div>
      )}
    </div>
  );
}

function UploadDrawer({ onClose, onSave }: { onClose: () => void; onSave: (d: HrDoc[]) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState(DOC_TYPES[0]!);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const employee = employees.find((e) => e.id === employeeId);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    setFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]);
  };

  return (
    <Drawer
      title="Upload documents"
      subtitle="PDF, JPG or PNG · up to 10 MB each"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!employee || files.length === 0}
            onClick={() =>
              onSave(
                files.map((f, i) => ({
                  id: `HD-${Date.now()}-${i}`,
                  employee: employee!,
                  type,
                  file: f.name,
                  size: f.size > 1e6 ? `${(f.size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1e3))} KB`,
                  uploadedAt: "2026-11-01",
                  expires: null,
                })),
              )
            }
          >
            Upload {files.length > 0 && `(${files.length})`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Employee" htmlFor="de">
          <Select inputId="de" value={employeeId} onChange={setEmployeeId} placeholder="Select employee…" options={employees.map((e) => ({ value: e.id, label: `${e.name} · ${e.code}` }))} />
        </Field>
        <Field label="Document type" htmlFor="dt">
          <Select inputId="dt" value={type} onChange={setType} options={DOC_TYPES.map((t) => ({ value: t, label: t }))} />
        </Field>
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => input.current?.click()}
          className={cn("flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition", over ? "border-ink bg-accent-soft" : "border-line-strong hover:bg-surface-2")}
        >
          <UploadCloud className="h-8 w-8 text-ink-3" />
          <p className="mt-3 text-sm font-medium text-ink">Drop files here or <span className="underline underline-offset-4">browse</span></p>
          <p className="mt-1 text-[12px] text-ink-3">Files stay in this browser in the demo</p>
          <input ref={input} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} />
        </div>
        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={f.name + i} className="flex items-center gap-3 rounded-xl border border-line p-2.5 text-[13px]">
                <FileText className="h-4 w-4 text-ink-3" />
                <span className="min-w-0 flex-1 truncate text-ink">{f.name}</span>
                <button onClick={() => setFiles((all) => all.filter((_, k) => k !== i))} aria-label={`Remove ${f.name}`} className="text-ink-3 hover:text-bad"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  );
}
