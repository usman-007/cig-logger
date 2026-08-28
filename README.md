# Ash — Cigarette & Habit Tracker

A dark-mode-first PWA for tracking cigarettes and roll-ups: one-tap logging with a
pacing timer, trigger analytics, real cost-per-cigarette from your own purchases,
and a filterable history. Everything is stored on the device — there is no server
and nothing is uploaded.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## What's in it

| Area | What it does |
| --- | --- |
| **Auth** | Email + password profiles stored locally (PBKDF2-SHA256, 210k iterations), plus a "Continue as guest" preview whose data migrates into an account on sign-up. |
| **Quick log** | Floating button on every screen: tap to log now, press-and-hold (or the satellite button) for the detailed sheet — retroactive time, factory vs hand-rolled, trigger tag, note. |
| **Pacing timer** | A ring around the log button fills as your interval elapses; logging early raises a "only 45 minutes since your last smoke" confirmation rather than a block. |
| **Dashboard** | Today vs target, 7-day average and week-over-week trend, live time-since-last counter, money spent/saved, hourly consumption timeline, today's entries. |
| **Patterns** | Trigger donut plus a ranked tag breakdown, daily trend against the target, average day by hour, and by weekday — over 7 / 30 / 90 days. |
| **Spend** | Packs, cartons, loose tobacco, papers and filters. Derives cost per factory cigarette and per roll-up (tobacco + paper + filter), plus a stock estimate. |
| **History** | Cigarettes and supplies interleaved by day, filtered by date range (incl. custom), type and trigger; any entry can be edited or deleted. |
| **PWA** | Manifest with maskable icons and three app shortcuts, a service worker (network-first pages, cache-first hashed assets), offline fallback, and an install prompt with an iOS path. |

## Architecture

```
src/
  app/
    (app)/{dashboard,analytics,purchases,history,settings}   authenticated screens
    login/                                                   sign in / sign up / guest
    offline/                                                 service-worker fallback
  components/
    app/        shell, nav, FAB, log controller + sheet
    charts/     recharts wrappers (hourly, trend, donut, weekday)
    dashboard/  today, since-last, money, timeline, recent
    analytics/  trigger breakdown, insight tiles
    purchases/  purchase sheet
    pwa/        service-worker registrar, install prompt
    ui/         button, card, dialog, fields, toast, misc primitives
  lib/
    persistence.ts  localStorage-backed external store (useSyncExternalStore)
    store.tsx       React context: session, data, actions, derived values
    clock.ts        one shared ticking clock, so render never calls Date.now()
    auth.ts         local accounts, hashing, guest migration
    cost.ts         unit economics from the purchase log
    stats.ts        buckets, histograms, streaks, money
    chart-theme.ts  validated chart palette + provenance
```

Two conventions worth knowing before editing:

1. **No `Date.now()` during render.** Components read `now` / `todayStart` from the
   store, which is fed by `lib/clock.ts`. This keeps renders pure (the React
   Compiler lint rules enforce it) and means every live counter ticks together.
2. **State that comes from localStorage is read through `useSyncExternalStore`**,
   not an effect, so the first client render already has real data.

## Chart palette

The eight trigger colours in `globals.css` (`--trigger-1` … `--trigger-8`) were
validated as an *ordered* categorical palette against the `#141b23` card surface:
lightness band, chroma floor, CVD separation (worst adjacent ΔE 20.7 deutan),
normal-vision floor (worst adjacent ΔE 22.6) and ≥3:1 contrast all pass. The slot
order is the safety mechanism — colour follows the trigger, never its rank. Re-run
a palette validator before reordering. Single-measure charts use one hue:
cigarettes are always amber `#d97706`, money is always green `#16a34a`.

## Icons

`node scripts/generate-icons.mjs` redraws every PWA icon (192/512, maskable,
apple-touch, favicon) from code — no binary assets to keep in sync.

## Data

Per profile under `ash:data:<userId>` in localStorage, with `ash:accounts` and
`ash:session` alongside. Settings → Your data exports or imports the whole profile
as JSON. Clearing site data deletes everything.
