"use client";

import * as React from "react";
import { AlertTriangle, Check, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { SMOKE_TYPES, TRIGGERS } from "@/lib/constants";
import { triggerColor } from "@/lib/chart-theme";
import {
  formatDuration,
  formatTime,
  fromDatetimeLocal,
  toDatetimeLocal,
} from "@/lib/date";
import { useStore, type LogDraft } from "@/lib/store";
import type { CigaretteLog, SmokeType, TriggerId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LogControllerValue {
  /** one-tap log at the current timestamp, with a pacing check */
  quickLog: () => void;
  openCustom: (prefill?: LogDraft) => void;
  openEdit: (log: CigaretteLog) => void;
}

const LogControllerContext = React.createContext<LogControllerValue | null>(null);

export function useLogController() {
  const ctx = React.useContext(LogControllerContext);
  if (!ctx) throw new Error("useLogController must be used inside <LogController>");
  return ctx;
}

export function LogController({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const { toast } = useToast();
  // The modal is mounted per-open (keyed), so its form state starts from the
  // entry being edited instead of being reset by an effect.
  const [modal, setModal] = React.useState<{
    key: number;
    log: CigaretteLog | null;
    prefill: LogDraft;
  } | null>(null);
  const [pacingPrompt, setPacingPrompt] = React.useState(false);

  const { settings, msUntilPaced, msSinceLast, addLog, deleteLog } = store;

  const commitQuickLog = React.useCallback(() => {
    const log = addLog({ type: settings.defaultType });
    if (navigator.vibrate) navigator.vibrate(12);
    toast({
      title: `Logged at ${formatTime(log.ts)}`,
      description:
        msSinceLast !== null
          ? `${formatDuration(msSinceLast)} since the last one.`
          : "First one tracked — the clock starts now.",
      tone: "good",
      actions: [
        { label: "Undo", onClick: () => deleteLog(log.id) },
        ...(settings.askTriggerAfterQuickLog
          ? [
              {
                label: "Add tag",
                onClick: () =>
                  setModal({ key: Date.now(), log, prefill: {} }),
              },
            ]
          : []),
      ],
    });
  }, [addLog, deleteLog, msSinceLast, settings.askTriggerAfterQuickLog, settings.defaultType, toast]);

  const quickLog = React.useCallback(() => {
    if (settings.pacingWarnings && msUntilPaced > 0 && msSinceLast !== null) {
      setPacingPrompt(true);
      return;
    }
    commitQuickLog();
  }, [commitQuickLog, msSinceLast, msUntilPaced, settings.pacingWarnings]);

  const openCustom = React.useCallback((draft: LogDraft = {}) => {
    setModal({ key: Date.now(), log: null, prefill: draft });
  }, []);

  const openEdit = React.useCallback((log: CigaretteLog) => {
    setModal({ key: Date.now(), log, prefill: {} });
  }, []);

  const value = React.useMemo(
    () => ({ quickLog, openCustom, openEdit }),
    [openCustom, openEdit, quickLog],
  );

  return (
    <LogControllerContext.Provider value={value}>
      {children}

      {modal ? (
        <LogModal
          key={modal.key}
          log={modal.log}
          prefill={modal.prefill}
          onClose={() => setModal(null)}
        />
      ) : null}

      <Dialog open={pacingPrompt} onOpenChange={setPacingPrompt}>
        <DialogContent className="sm:w-[min(26rem,92vw)]">
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-warning/12 text-warning">
              <Clock className="size-5" />
            </div>
            <DialogTitle>
              Only {formatDuration(msSinceLast ?? 0)} since your last smoke
            </DialogTitle>
            <DialogDescription>
              Your pacing target is {settings.pacingMinutes} minutes.{" "}
              {formatDuration(msUntilPaced)} to go — no pressure either way.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setPacingPrompt(false)}
              className="sm:min-w-32"
            >
              I&apos;ll wait
            </Button>
            <Button
              variant="amber"
              onClick={() => {
                setPacingPrompt(false);
                commitQuickLog();
              }}
              className="sm:min-w-32"
            >
              Log anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LogControllerContext.Provider>
  );
}

const QUICK_OFFSETS = [
  { label: "Now", minutes: 0 },
  { label: "15m ago", minutes: 15 },
  { label: "30m ago", minutes: 30 },
  { label: "1h ago", minutes: 60 },
  { label: "2h ago", minutes: 120 },
];

function LogModal({
  log,
  prefill,
  onClose,
}: {
  log: CigaretteLog | null;
  prefill: LogDraft;
  onClose: () => void;
}) {
  const { settings, logs, addLog, updateLog, deleteLog, now } = useStore();
  const { toast } = useToast();

  const [ts, setTs] = React.useState(() => log?.ts ?? prefill.ts ?? now);
  const [type, setType] = React.useState<SmokeType>(
    () => log?.type ?? prefill.type ?? settings.defaultType,
  );
  const [trigger, setTrigger] = React.useState<TriggerId | null>(
    () => log?.trigger ?? prefill.trigger ?? null,
  );
  const [note, setNote] = React.useState(() => log?.note ?? prefill.note ?? "");

  // Gap to the nearest earlier cigarette, ignoring the row being edited.
  const previousTs = React.useMemo(() => {
    const earlier = logs
      .filter((l) => l.id !== log?.id && l.ts < ts)
      .sort((a, b) => b.ts - a.ts);
    return earlier[0]?.ts ?? null;
  }, [log?.id, logs, ts]);

  const gap = previousTs === null ? null : ts - previousTs;
  const pacingMs = settings.pacingMinutes * 60_000;
  const tooSoon = gap !== null && gap < pacingMs;
  const isFuture = ts > now + 60_000;

  const submit = () => {
    if (log) {
      updateLog(log.id, { ts, type, trigger, note: note.trim() || undefined });
      toast({ title: "Entry updated", tone: "good" });
    } else {
      const created = addLog({ ts, type, trigger, note });
      toast({
        title: `Logged at ${formatTime(created.ts)}`,
        tone: "good",
        actions: [{ label: "Undo", onClick: () => deleteLog(created.id) }],
      });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{log ? "Edit entry" : "Log a cigarette"}</DialogTitle>
          <DialogDescription>
            {log
              ? "Adjust anything that was captured wrong."
              : "Set the time, the kind, and what set it off."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5 pb-3">
          <div className="space-y-2">
            <Field label="When" hint={formatTime(ts)}>
              <Input
                type="datetime-local"
                value={toDatetimeLocal(ts)}
                max={toDatetimeLocal(now)}
                onChange={(e) => setTs(fromDatetimeLocal(e.target.value))}
              />
            </Field>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {QUICK_OFFSETS.map((offset) => (
                <button
                  key={offset.label}
                  type="button"
                  onClick={() => setTs(now - offset.minutes * 60_000)}
                  className="shrink-0 rounded-lg border border-border bg-white/[0.03] px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground active:scale-[0.97]"
                >
                  {offset.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Type">
            <Segmented
              value={type}
              onChange={setType}
              options={SMOKE_TYPES.map((t) => ({
                value: t.id,
                label: t.label,
                hint: t.hint,
              }))}
            />
          </Field>

          <div className="space-y-2">
            <p className="text-[13px] font-medium text-muted-foreground">
              Trigger <span className="text-subtle-foreground">· optional</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {TRIGGERS.map((t) => {
                const active = trigger === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTrigger(active ? null : t.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-all active:scale-[0.97]",
                      active
                        ? "border-transparent text-foreground"
                        : "border-border bg-white/[0.03] text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                    style={
                      active
                        ? {
                            backgroundColor: `${triggerColor(t.id)}26`,
                            boxShadow: `inset 0 0 0 1px ${triggerColor(t.id)}`,
                          }
                        : undefined
                    }
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: triggerColor(t.id) }}
                    />
                    {t.label}
                    {active ? <Check className="size-3.5" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Note" hint="optional">
            <Textarea
              value={note}
              maxLength={160}
              placeholder="Anything worth remembering about this one…"
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>

          {tooSoon && settings.pacingWarnings ? (
            <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.08] p-3 text-[13px] text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Only {formatDuration(gap ?? 0)} after the previous one — your pacing
                target is {settings.pacingMinutes} minutes.
              </span>
            </p>
          ) : null}

          {isFuture ? (
            <p className="flex items-start gap-2 rounded-xl border border-critical/30 bg-critical/[0.08] p-3 text-[13px] text-[#e86a6a]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>That time is in the future. Pick a time that has happened.</span>
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          {log ? (
            <Button
              variant="danger"
              onClick={() => {
                deleteLog(log.id);
                toast({ title: "Entry deleted", tone: "default" });
                onClose();
              }}
              className="sm:mr-auto"
            >
              <Trash2 />
              Delete
            </Button>
          ) : (
            <span className="hidden sm:block" />
          )}
          <div className="flex gap-2 sm:justify-end">
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={isFuture} className="flex-1 sm:flex-none">
              {log ? "Save changes" : "Log it"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
