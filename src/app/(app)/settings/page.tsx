"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download,
  LogOut,
  Minus,
  Plus,
  RotateCcw,
  Upload,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Segmented, Switch } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { CURRENCIES, SMOKE_TYPES } from "@/lib/constants";
import { formatUnitCost } from "@/lib/format";
import { useStore } from "@/lib/store";
import { clamp } from "@/lib/utils";

export default function SettingsPage() {
  const {
    session,
    settings,
    updateSettings,
    unitCosts,
    logs,
    purchases,
    exportData,
    importData,
    resetData,
    signOut,
  } = useStore();
  const { toast } = useToast();
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ash-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export downloaded", tone: "good" });
  };

  const upload = async (file: File) => {
    try {
      await importData(await file.text());
      toast({ title: "Data imported", tone: "good" });
    } catch (error) {
      toast({
        title: "That file couldn't be imported",
        description: error instanceof Error ? error.message : undefined,
        tone: "critical",
      });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Targets, pricing and your data — synced to your account."
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <SectionTitle>Targets</SectionTitle>

          <Stepper
            label="Daily limit"
            hint="cigarettes per day"
            value={settings.dailyLimit}
            min={1}
            max={80}
            onChange={(dailyLimit) => updateSettings({ dailyLimit })}
          />

          <Stepper
            label="Pacing interval"
            hint="minutes between cigarettes"
            value={settings.pacingMinutes}
            min={5}
            max={480}
            step={5}
            onChange={(pacingMinutes) => updateSettings({ pacingMinutes })}
          />

          <ToggleRow
            label="Pacing warnings"
            description="Ask before logging sooner than your interval."
            checked={settings.pacingWarnings}
            onChange={(pacingWarnings) => updateSettings({ pacingWarnings })}
          />

          <ToggleRow
            label="Offer a tag after quick logs"
            description="Adds an 'Add tag' shortcut to the confirmation."
            checked={settings.askTriggerAfterQuickLog}
            onChange={(askTriggerAfterQuickLog) =>
              updateSettings({ askTriggerAfterQuickLog })
            }
          />

          <Field label="Default type for one-tap logs">
            <Segmented
              value={settings.defaultType}
              onChange={(defaultType) => updateSettings({ defaultType })}
              options={SMOKE_TYPES.map((t) => ({ value: t.id, label: t.label }))}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <SectionTitle>Pricing</SectionTitle>
          <p className="-mt-2 text-sm text-subtle-foreground">
            Used until your purchase log takes over. Right now a factory cigarette
            costs{" "}
            <strong className="text-muted-foreground">
              {formatUnitCost(unitCosts.perFactory, settings.currency)}
            </strong>{" "}
            {unitCosts.sources.factory ? "from your purchases" : "from these defaults"}.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Currency">
              <Select
                value={settings.currency}
                onChange={(e) => updateSettings({ currency: e.target.value })}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fallback pack price">
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.5"
                value={settings.fallbackPackPrice}
                onChange={(e) =>
                  updateSettings({ fallbackPackPrice: Number(e.target.value) || 0 })
                }
              />
            </Field>
            <Field label="Cigarettes per pack">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={settings.cigarettesPerPack}
                onChange={(e) =>
                  updateSettings({
                    cigarettesPerPack: clamp(Number(e.target.value) || 20, 1, 100),
                  })
                }
              />
            </Field>
            <Field label="Grams per roll-up">
              <Input
                type="number"
                inputMode="decimal"
                min={0.1}
                step="0.05"
                value={settings.gramsPerRoll}
                onChange={(e) =>
                  updateSettings({ gramsPerRoll: Number(e.target.value) || 0.7 })
                }
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <SectionTitle>Your data</SectionTitle>
          <p className="-mt-2 text-sm text-subtle-foreground">
            {logs.length} cigarettes and {purchases.length} purchases stored in this
            browser. Nothing is uploaded anywhere.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={download}>
              <Download />
              Export JSON
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload />
              Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file);
                e.target.value = "";
              }}
            />
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
              <RotateCcw />
              Reset everything
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <SectionTitle>Account</SectionTitle>
          <div>
            <p className="text-sm font-medium">{session?.name}</p>
            <p className="text-[13px] text-subtle-foreground">
              {session?.guest ? "Preview mode — local only" : session?.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {session?.guest ? (
              <Button size="sm" asChild>
                <Link href="/login?mode=signup">
                  <UserPlus />
                  Save as an account
                </Link>
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await signOut();
                router.replace("/login");
              }}
            >
              <LogOut />
              {session?.guest ? "Exit preview" : "Sign out"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <InstallPrompt />

      <p className="pb-2 text-center text-[12px] text-subtle-foreground">
        Ash · a private, offline-first habit tracker
      </p>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="sm:w-[min(26rem,92vw)]">
          <DialogHeader>
            <DialogTitle>Delete everything?</DialogTitle>
            <DialogDescription>
              This clears every cigarette, purchase and setting for this profile.
              Export first if you want a copy — it can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Keep my data
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetData();
                setConfirmReset(false);
                toast({ title: "All data cleared" });
              }}
            >
              Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[12px] text-subtle-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-1 rounded-xl border border-border bg-background-elevated p-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step, min, max))}
        >
          <Minus />
        </Button>
        <span className="w-12 text-center text-base font-semibold tabular">{value}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step, min, max))}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[12px] leading-snug text-subtle-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
