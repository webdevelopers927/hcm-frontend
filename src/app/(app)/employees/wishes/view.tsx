"use client";

import { Cake, Heart, PartyPopper, Send, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { ModuleHeader, Segments, StatStrip } from "@/components/employees/module-kit";
import { Avatar, Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { currentUser, employees, upcomingCelebrations } from "@/lib/data";
import { wishes as seed, type Wish } from "@/lib/module-data";
import { cn } from "@/lib/utils";

const eventMeta = {
  Birthday: { icon: Cake, tone: "violet" },
  "Work anniversary": { icon: PartyPopper, tone: "accent" },
  Promotion: { icon: TrendingUp, tone: "ok" },
  Welcome: { icon: Sparkles, tone: "info" },
} as const;

export function View() {
  const [list, setList] = useState(seed);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Wish["event"] | "all">("all");
  const shown = list.filter((w) => filter === "all" || w.event === filter);

  const received = new Map<string, number>();
  list.forEach((w) => received.set(w.recipient.id, (received.get(w.recipient.id) ?? 0) + 1));
  const top = [...received.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ e: employees.find((x) => x.id === id)!, n }));

  return (
    <div className="space-y-5">
      <ModuleHeader title="Wishes" description="Birthdays, anniversaries and wins — the little moments that make a team feel like one." />
      <StatStrip
        items={[
          { label: "Wishes this month", value: list.length, hint: "Across the company", tone: "violet" },
          { label: "Celebrations ahead", value: upcomingCelebrations().length, hint: "Next 7 days", tone: "info" },
          { label: "Reactions", value: list.reduce((a, w) => a + w.reactions, 0) + liked.size, hint: "Hearts given", tone: "bad" },
          { label: "Participation", value: "71%", hint: "Sent at least one wish", tone: "ok" },
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Composer onSend={(w) => { setList((l) => [w, ...l]); toast(`Wish sent to ${w.recipient.name}`); }} />
          <Segments
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: list.length },
              ...(["Birthday", "Work anniversary", "Promotion", "Welcome"] as const).map((e) => ({ value: e, label: e, count: list.filter((w) => w.event === e).length })),
            ]}
          />
          <ul className="space-y-3">
            {shown.map((w) => {
              const meta = eventMeta[w.event];
              const isLiked = liked.has(w.id);
              return (
                <li key={w.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={w.sender.name} hue={w.sender.hue} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                          <span className="font-semibold text-ink">{w.sender.name}</span>
                          <span className="text-ink-3">wished</span>
                          <span className="font-semibold text-ink">{w.recipient.name}</span>
                          <span className="text-[12px] text-ink-3">· {w.at}</span>
                        </div>
                        <Badge tone={meta.tone} className="mt-1.5"><meta.icon className="h-3 w-3" /> {w.event}</Badge>
                        <p className="mt-3 text-[15px] leading-relaxed text-ink">{w.message}</p>
                        <button
                          onClick={() => setLiked((s) => { const n = new Set(s); if (n.has(w.id)) n.delete(w.id); else n.add(w.id); return n; })}
                          aria-pressed={isLiked}
                          className={cn("mt-3 inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition", isLiked ? "border-bad/30 bg-bad-soft text-bad" : "border-line text-ink-2 hover:border-line-strong")}
                        >
                          <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                          <span className="tabular">{w.reactions + (isLiked ? 1 : 0)}</span>
                        </button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Coming up" subtitle="Don’t miss these" />
            <ul className="p-2 pt-3">
              {upcomingCelebrations().map((c) => (
                <li key={c.employee.id + c.kind} className="flex items-center gap-3 rounded-xl px-3 py-2">
                  <Avatar name={c.employee.name} hue={c.employee.hue} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">{c.employee.name}</div>
                    <div className="text-[12px] text-ink-3">{c.kind}</div>
                  </div>
                  <span className={cn("text-[12px] font-medium", c.when === "Today" ? "rounded-md bg-accent px-1.5 py-0.5 text-accent-ink" : "text-ink-3")}>{c.when}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Most celebrated" subtitle="This month" />
            <ol className="space-y-1 p-2 pt-3">
              {top.map(({ e, n }, i) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2">
                  <span className="tabular w-4 text-[13px] font-semibold text-ink-3">{i + 1}</span>
                  <Avatar name={e.name} hue={e.hue} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{e.name}</span>
                  <span className="tabular text-[12px] text-ink-3">{n} wishes</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Composer({ onSend }: { onSend: (w: Wish) => void }) {
  const [to, setTo] = useState("");
  const [event, setEvent] = useState<Wish["event"]>("Birthday");
  const [msg, setMsg] = useState("");
  const recipient = employees.find((e) => e.id === to);
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex gap-3">
        <Avatar name={currentUser.name} hue={currentUser.hue} />
        <div className="min-w-0 flex-1 space-y-3">
          <textarea
            rows={2}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Write something kind…"
            className="w-full resize-none bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select aria-label="Recipient" size="sm" className="sm:flex-1" value={to} onChange={setTo} placeholder="To…" options={employees.filter((e) => e.id !== currentUser.id).map((e) => ({ value: e.id, label: e.name }))} />
            <Select aria-label="Occasion" size="sm" className="sm:w-48" value={event} onChange={(v) => setEvent(v as Wish["event"])} options={Object.keys(eventMeta).map((k) => ({ value: k, label: k }))} />
            <Button
              variant="primary"
              disabled={!recipient || !msg.trim()}
              onClick={() => {
                onSend({ id: `WS-${Date.now()}`, sender: currentUser, recipient: recipient!, event, message: msg.trim(), at: "just now", reactions: 0 });
                setMsg("");
                setTo("");
              }}
            >
              <Send className="h-4 w-4" /> Send
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
