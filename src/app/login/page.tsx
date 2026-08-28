"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChartPie,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  Timer,
  User,
  Wallet,
} from "lucide-react";
import { Wordmark } from "@/components/app/brand";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/misc";
import { useStore } from "@/lib/store";
import { guestHasData } from "@/lib/auth";

type Mode = "signin" | "signup";

/** A one-shot environment read, not a live subscription. */
const noopSubscribe = () => () => {};

const HIGHLIGHTS = [
  {
    icon: Timer,
    title: "One-tap logging with pacing",
    body: "Log in a single tap and get a gentle nudge when it has been less than your target gap.",
  },
  {
    icon: ChartPie,
    title: "Triggers, not judgement",
    body: "Tag what set it off — stress, coffee, a break — and see the pattern that keeps repeating.",
  },
  {
    icon: Wallet,
    title: "Real cost per cigarette",
    body: "Log packs, tobacco, papers and filters. Ash works out what each one actually costs.",
  },
];

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <LoginView />
    </Suspense>
  );
}

function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const { hydrated, session, signIn, signUp, continueAsGuest } = useStore();

  const [mode, setMode] = React.useState<Mode>(
    params.get("mode") === "signup" ? "signup" : "signin",
  );
  const convertingGuest = session?.guest === true;
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const hasGuestData = React.useSyncExternalStore(
    noopSubscribe,
    guestHasData,
    () => false,
  );

  // A guest is allowed back here on purpose — that's how preview mode gets
  // turned into a real account. Only a signed-in account skips the form.
  React.useEffect(() => {
    if (hydrated && session && !session.guest) router.replace("/dashboard");
  }, [hydrated, session, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUp({ email, password, name });
      else await signIn({ email, password });
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative z-10 grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden flex-col justify-between border-r border-border bg-background-elevated/40 p-12 lg:flex">
        <Wordmark />
        <div className="max-w-md space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
              Know your habit
              <span className="block text-primary">before you change it.</span>
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Ash is a quiet tracker for cigarettes and roll-ups. No streak
              shaming, no lectures — just the numbers, the triggers, and what it
              all costs.
            </p>
          </div>
          <ul className="space-y-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="size-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-subtle-foreground">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-subtle-foreground">
          Your data is stored on this device only. Nothing is uploaded anywhere.
        </p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Wordmark />
          </div>

          <div className="mb-6 space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {mode === "signup"
                ? convertingGuest
                  ? "Keeps everything you logged in preview mode."
                  : "Sets up a private profile on this device."
                : "Sign in to pick up where you left off."}
            </p>
          </div>

          <Segmented
            className="mb-6"
            size="sm"
            value={mode}
            onChange={(next) => {
              setMode(next);
              setError(null);
            }}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
          />

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" ? (
              <Field label="Name" htmlFor="name" hint="optional">
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
                  <Input
                    id="name"
                    className="pl-10"
                    autoComplete="name"
                    placeholder="What should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </Field>
            ) : null}

            <Field label="Email" htmlFor="email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
                <Input
                  id="email"
                  className="pl-10"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              hint={mode === "signup" ? "6+ characters" : undefined}
            >
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" />
                <Input
                  id="password"
                  className="pl-10 pr-11"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-critical/30 bg-critical/[0.08] px-3.5 py-2.5 text-[13px] text-[#e86a6a]"
              >
                {error}
              </p>
            ) : null}

            {mode === "signup" && hasGuestData ? (
              <p className="rounded-xl border border-primary/25 bg-primary/[0.06] px-3.5 py-2.5 text-[13px] text-muted-foreground">
                Your preview-mode entries will move over to this account.
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-widest text-subtle-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => {
              continueAsGuest();
              router.replace("/dashboard");
            }}
          >
            <Sparkles />
            Continue as guest
          </Button>
          <p className="mt-3 text-center text-xs leading-relaxed text-subtle-foreground">
            Guest mode keeps everything in this browser. You can turn it into an
            account later without losing anything.
          </p>
        </div>
      </section>
    </main>
  );
}
