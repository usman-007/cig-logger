# Work done

A running record of what exists in this project, why it was built that way, and
what has been verified. **Update this file whenever work lands** — see the
[Changelog](#changelog) at the bottom and the rules in [CLAUDE.md](CLAUDE.md).

- **Project:** Ash — a dark-mode-first cigarette & habit tracker PWA
- **Status:** Feature-complete against the original brief. Builds clean, lints
  clean, type-checks clean, and passes an end-to-end browser test.
- **Started / last full pass:** 2026-08-28

---

## 1. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16.3.3 (App Router, Turbopack) | All nine routes are statically prerendered |
| UI | React 19.2.8 | React Compiler lint rules are enforced — see §4 |
| Styling | Tailwind CSS v4 | CSS-first config; tokens in `src/app/globals.css` |
| Components | shadcn-style primitives, hand-rolled | On Radix: dialog, switch, slot only |
| Charts | Recharts 3 | Wrapped in `src/components/charts/` |
| Icons | lucide-react | |
| Storage | `localStorage` | No database, no backend — see §7 |

Runtime dependencies are deliberately short: `@radix-ui/react-{dialog,slot,switch}`,
`class-variance-authority`, `clsx`, `lucide-react`, `next`, `react`, `react-dom`,
`recharts`, `tailwind-merge`. Seven Radix packages and `tailwindcss-animate` were
installed during the build and **removed once unused** — keep it that way.

## 2. What was built

### Authentication — `src/app/login/page.tsx`, `src/lib/auth.ts`
- Email + password profiles hashed with **PBKDF2-SHA256, 210k iterations**, random
  16-byte salt, via Web Crypto. Hashes are not reversible.
- **Continue as guest** preview mode with no credentials.
- Guest → account conversion: signing up while in guest mode moves the preview
  profile onto the new account and clears the guest bucket (`claimGuestData`).
- Split marketing/form layout on desktop, single column on mobile; show/hide
  password, inline error alerts, sign-in vs create-account segmented switch.

### Quick check-in & pacing — `src/components/app/log-fab.tsx`, `log-controller.tsx`
- Floating action button present on every authenticated screen.
- **Tap** = one-tap log at the current timestamp. **Press-and-hold (550ms)** or the
  satellite button = the detailed sheet.
- A conic-gradient **ring around the FAB fills as the pacing interval elapses**;
  emerald once past the target, amber while inside it.
- Logging early raises a confirmation — *"Only 28m since your last smoke … 31m to
  go — no pressure either way"* — with **Log anyway** / **I'll wait**. It nudges,
  it never blocks.
- Confirmation toast carries **Undo** and (optionally) **Add tag**.
- Detail sheet: retroactive `datetime-local` plus Now/15m/30m/1h/2h quick offsets,
  Factory vs Hand-rolled segmented control, eight trigger chips, a note field, a
  live pacing warning, and future-time rejection.

### Dashboard — `src/app/(app)/dashboard/page.tsx`
- **Today card**: count vs daily target, progress meter, remaining/over badge,
  7-day average, week total, week-over-week trend, and a 7-day bar strip with
  over-target days in the status-critical hue.
- **Since last**: live `h : m : s` counter, pacing badge, last entry with its
  trigger, pacing target, longest gap today.
- **Money**: spent today (hero number), value of the gap under target, this week,
  30 days, lifetime saved, and per-unit costs for factory and roll-ups.
- **Consumption timeline**: hourly bar chart, toggleable Today / 7-day average,
  with the peak hour emphasised and named in the subtitle.
- **Today's entries**: tap any row to edit; gap-since-previous shown per row.
- Streak badge (consecutive days at or under target) and a greeting that tracks
  the time of day.

### Trigger & craving analytics — `src/app/(app)/analytics/page.tsx`
- Range switch: 7 / 30 / 90 days.
- **Insight tiles**: top trigger, peak hour, heaviest weekday, roll-up share.
- **Trigger breakdown**: donut (six segments max — top five plus a merged
  "N more") beside a ranked list with counts, percentages, per-trigger bars, and
  each trigger's own peak hour.
- **Daily count over time**: area chart with the target as a labelled reference
  line placed in the right margin so it never overlaps the series.
- **Average day by hour** and **by day of week**, both normalised per day so a
  30-day view is an average and not a sum.

### Purchases & expense log — `src/app/(app)/purchases/page.tsx`
- Categories: cigarette pack, carton, loose tobacco (g), rolling papers (sheets),
  filters, other.
- **Unit economics** derived from lifetime weighted averages, so prices
  self-correct as you buy: cost per factory cigarette, cost per roll-up
  (tobacco × grams-per-roll + paper + filter), cost per gram, total spend.
- The purchase sheet shows the derived per-unit cost **live as you type**.
- **Stock estimate**: bought minus logged, per supply type.
- Falls back to settings (`fallbackPackPrice`, `cigarettesPerPack`) until real
  purchases exist, and labels the figure as estimated when it does.

### History & filtering — `src/app/(app)/history/page.tsx`
- Cigarettes and purchases interleaved, grouped by day, newest first, with a
  per-day count and over-target note.
- Filters in one row above the list: date range (Today / 7 / 30 / **Custom** with
  from–to date inputs), type (All / Cigarettes / Supplies), and multi-select
  trigger chips.
- Summary badges for the active range; any entry opens its edit/delete sheet.

### Settings — `src/app/(app)/settings/page.tsx`
- Targets: daily limit, pacing interval, pacing warnings, post-quick-log tag
  prompt, default smoke type.
- Pricing: currency, fallback pack price, cigarettes per pack, grams per roll-up.
- Data: **export JSON**, **import JSON**, **reset everything** (behind a
  confirmation dialog).
- Account: profile summary, guest → account upgrade, sign out.

### PWA — `public/manifest.webmanifest`, `public/sw.js`, `src/components/pwa/`
- Manifest: standalone display, theme/background `#0b1015`, four icons (192, 512,
  and maskable variants), and **three app shortcuts** — Log a cigarette, Patterns,
  Log a purchase. `?action=log` and `?action=new` are handled by the pages.
- Service worker: network-first for navigations (falls back to cache, then
  `/offline`), cache-first for hashed `_next/static` and icons,
  stale-while-revalidate for everything else same-origin. Versioned cache names,
  `skipWaiting` + `clients.claim`. Registers in production only.
- Install prompt: defers `beforeinstallprompt` on Chromium, falls back to Share →
  Add to Home Screen instructions on iOS, dismissible and remembered.
- Icons are **generated from code** by `scripts/generate-icons.mjs` — a PNG
  encoder built on `node:zlib` with no image dependencies. Draws a cigarette on
  the diagonal with an emerald ember and a smoke wisp. Re-run after any change:
  `node scripts/generate-icons.mjs`.

## 3. Design system

Dark-only by choice: shipping a light theme would mean validating a second chart
palette, and a toggle that flips to an unvalidated palette is worse than none.

- Background `#0b1015`, card `#141b23`, elevated `#10161d`, border `#232d3a`.
- Emerald `#10b981` for primary actions and "under target"; amber `#f59e0b` and
  rose `#f43f5e` as counter accents.
- Status roles are fixed and always ship with an icon plus a label:
  good `#0ca30c`, warning `#fab219`, serious `#ec835a`, critical `#d03b3b`.
- Tokens live in `:root` in `globals.css` and are mapped to Tailwind utilities
  through `@theme inline`.

### Chart palette — validated, not eyeballed

The eight trigger hues (`--trigger-1` … `--trigger-8`) were run through a
colour-vision validator against the **`#141b23` card surface** as an *ordered*
categorical palette. All six checks pass:

| Check | Result |
| --- | --- |
| Lightness band (dark: L 0.48–0.67) | PASS — all 8 inside |
| Chroma floor (C ≥ 0.10) | PASS |
| CVD separation (adjacent) | PASS — worst ΔE **20.7** (deutan), target ≥ 8 |
| Normal-vision floor | PASS — worst adjacent ΔE **22.6**, floor 15 |
| Contrast vs surface | PASS — all 8 ≥ 3:1 |

Slot order **is** the safety mechanism: stress `#f43f5e`, boredom `#7c3aed`,
social `#0d9488`, coffee `#2563eb`, alcohol `#16a34a`, after-meal `#c026d3`,
work-break `#d97706`, other `#0284c7`. Colour follows the trigger, never its rank.
Provenance is documented in `src/lib/chart-theme.ts`.

Single-measure charts use **one** hue so the same measure keeps the same colour
everywhere: cigarettes are amber `#d97706`, money is green `#16a34a`. No chart in
the app has two y-scales.

## 4. Architecture decisions

**External store over effects.** Session and data are read through
`useSyncExternalStore` from `src/lib/persistence.ts`, not hydrated by a
`useEffect`. The first client render already has real data, cross-tab sync comes
free through the `storage` event, and the React Compiler's
`set-state-in-effect` rule stays satisfied.

**One shared clock.** `src/lib/clock.ts` is a second external store. Nothing calls
`Date.now()` during render; components read `now` (1s tick) or `todayStart`
(local midnight, stable across ticks, safe as a memo dependency) from the store.
This keeps renders pure and makes every live counter tick in lockstep.

**Modals mount on open, keyed.** Both the log sheet and the purchase sheet are
rendered only while open and keyed per-open, so their form state initialises from
props instead of being reset by an effect.

**Pure stats layer.** `src/lib/stats.ts` and `src/lib/cost.ts` take an explicit
`now` and return plain data. No React, no storage, no clock reads.

```
src/
  app/
    (app)/{dashboard,analytics,purchases,history,settings}   authenticated screens
    login/       sign in / sign up / guest
    offline/     service-worker fallback
    page.tsx     client-side entry gate
  components/
    app/         shell, nav, FAB, log controller + sheet, brand, page header
    charts/      recharts wrappers + shared tooltip
    dashboard/   today, since-last, money, timeline, recent, stat tile
    analytics/   trigger breakdown, insight grid
    purchases/   purchase sheet
    pwa/         service-worker registrar, install prompt
    ui/          button, card, dialog, field, misc, toast
  lib/
    persistence.ts  localStorage external store
    store.tsx       context: session, data, actions, derived values
    clock.ts        shared ticking clock
    auth.ts         local accounts, hashing, guest migration
    cost.ts         unit economics from the purchase log
    stats.ts        buckets, histograms, streaks, money
    chart-theme.ts  validated palette + provenance
    constants.ts    triggers, categories, defaults, storage keys
    date.ts, format.ts, types.ts, utils.ts
```

## 5. Verification performed

Driven with headless Chrome over the **production build** via the DevTools
Protocol (Node's built-in `WebSocket`, no test dependencies added to the project).

- **Zero console errors or exceptions** on every page, mobile (390×844) and
  desktop (1440×950).
- **Auth flows**: guest entry → one-tap log → sign-up migrates the entry and
  clears the guest bucket → sign out → wrong password produces
  *"That password doesn't match."* → correct password restores the profile.
  Stored account verified to hold a 64-char hash and 32-char salt.
- **CRUD**: edit an entry's trigger (persisted, toast shown, count unchanged),
  delete it (146 → 145, dialog closed), filter by trigger (13 matching, nothing
  non-matching rendered), add a purchase through the sheet (live per-unit hint
  read `$0.500 per cigarette` for $20 / 2 packs × 20 — correct).
- **Cost maths** cross-checked by hand: $25.70 over 120 cigarettes = $0.214 each;
  0.7 g × $0.327 + $0.037 + $0.020 = $0.286 per roll-up.
- **PWA**: service worker registers, three caches populate (shell 5, pages 6,
  assets 29), manifest serves with 4 icons and 3 shortcuts, theme-color and
  apple-touch meta present. With the network forced offline, `/history` still
  renders the real page from cache.
- **Static checks**: `eslint src` clean, `tsc --noEmit` clean, `next build`
  succeeds with all nine routes prerendered. `next dev` boots clean too.

### Bugs found and fixed during the build

1. **7-day strip bars had no height** — percentage heights inside an auto-height
   flex column never resolve. Fixed with a relative track that owns the height.
2. **Chart axes clipped and collided** — decimal y-labels were cut off by negative
   left margins (`0.8` rendered as `.8`), and 30-day date ticks overlapped on a
   phone. Fixed by dropping the negative margins, sizing axis widths per content,
   and thinning ticks to at most six labels.
3. **Target reference label overlapped the series** — moved into the right margin.
4. **Guest "Keep it" was a dead end** — the login route bounced any session
   straight to the dashboard, so a guest could never reach the sign-up form. Now
   only non-guest sessions redirect.

## 6. Commands

```bash
npm run dev                        # http://localhost:3000
npm run build && npm start         # production; the service worker is live here
npx tsc --noEmit                   # types
npx eslint src                     # lint (React Compiler rules included)
node scripts/generate-icons.mjs    # redraw every PWA icon
```

## 7. Known limitations and assumptions

These are deliberate, not oversights.

- **No backend, no database, no `.env`.** The brief specified email/password auth
  but no server, so profiles are local: `ash:accounts`, `ash:session`, and
  `ash:data:<userId>` in `localStorage`. There are no API routes, no server
  actions, and no outbound network calls anywhere in `src/`.
- **The password protects a local profile switch, not a network boundary.**
  Anyone with DevTools access to the browser can read the data directly.
- **Data is per-browser and per-device.** No sync; clearing site data deletes
  everything. Settings → Export JSON is the only backup.
- **Dark mode only** — see §3.
- **No automated test suite** is checked in. Verification was done by driving a
  real browser; that harness lives outside the repo.

Swapping in a real backend touches only `src/lib/auth.ts` and
`src/lib/persistence.ts`; the store API, all components, and the stats/cost maths
stay as they are.

---

## Changelog

Newest first. Add an entry for every unit of work — see [CLAUDE.md](CLAUDE.md).

### 2026-08-28 — Initial build
Scaffolded the project and built the whole application described above: local
auth with guest mode, one-tap logging with the pacing timer, dashboard, trigger
analytics, purchase log with derived unit economics, filterable history,
settings, and full PWA support with code-generated icons. Refactored storage and
the clock onto external stores to satisfy React Compiler purity rules. Validated
the chart palette. Verified end-to-end in a headless browser and fixed the four
bugs listed in §5. Removed eight unused dependencies and the create-next-app
placeholder assets.
