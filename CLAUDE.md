@AGENTS.md

# Ash — working instructions

A cigarette & habit tracker PWA. Next.js 16 App Router, React 19, Tailwind v4,
Recharts, no backend. Read [work-done.md](work-done.md) first — it is the record
of what exists and why.

## Before you finish: update work-done.md

**Every time you land work, update `work-done.md` in the same turn.** It is the
project's memory; a change that isn't recorded there is invisible to the next
session.

1. Add a **Changelog** entry at the top of that section, newest first:

   ```markdown
   ### YYYY-MM-DD — Short title
   What changed and why, in a few sentences. Name the files that matter. Note
   anything a future session would otherwise have to rediscover — a constraint
   you hit, a decision you made, a thing that looks wrong but isn't.
   ```

2. **Edit the body sections too**, don't just append. If you added a screen,
   describe it in §2. If you changed an architectural rule, fix §4. If you added
   a dependency, update §1. If you removed a limitation, delete it from §7. The
   changelog is history; the body must always describe the code as it stands
   *now*.
3. If you verified something, say so in §5 and say how. If you fixed a bug worth
   remembering, add it to the bug list.
4. Keep the date accurate and absolute — never "today" or "recently".

Do this for real work only. Don't log a typo fix.

## Hard rules

These are enforced by lint and by design. Breaking them will fail
`npx eslint src`, or silently break the app.

**1. Never call `Date.now()` or `new Date()` during render** — including inside
`useMemo` and `useState` initialisers. Read the clock from the store instead:

```tsx
const { now, todayStart } = useStore();
```

`now` ticks every second (live counters). `todayStart` is local midnight and is
stable across ticks, so it is the correct dependency for anything day-shaped —
using `now` there recomputes every second for nothing. Event handlers may call
`Date.now()` freely. Pure helpers in `lib/` take `now` as an explicit argument.

**2. Read persisted state through `useSyncExternalStore`, never an effect.**
`lib/persistence.ts` and `lib/clock.ts` are the two external stores. Don't add a
`useEffect` that calls `setState` to hydrate from `localStorage` — that pattern
is banned by `react-hooks/set-state-in-effect`.

**3. Reset form state by keying a mounted-on-open modal, not by an effect.** See
`log-controller.tsx` and `purchase-modal.tsx`: the parent holds
`{ key, entity } | null`, renders the modal only when it is non-null, and passes
`onClose`. The modal initialises its own state lazily from props.

**4. Don't reorder the trigger colour slots.** `--trigger-1` … `--trigger-8` in
`globals.css` are a *validated ordered* palette (see work-done.md §3). Reordering
or substituting hues invalidates the colourblind-safety guarantees. If a change
is genuinely needed, re-run a palette validator against the `#141b23` surface and
record the new numbers in `chart-theme.ts` and work-done.md.

**5. Chart rules.** One measure = one hue (cigarettes are amber `#d97706`, money
is green `#16a34a`). Never two y-axes on one chart. Averages must be normalised
per day, never shown as a sum. Status colours (`good`/`warning`/`serious`/
`critical`) are reserved for state and always ship with an icon or a label —
never as a series colour.

## Conventions

- **Storage keys** live in `lib/constants.ts`. Adding a field to `AppData` means
  updating `migrate()` in `lib/persistence.ts` so old profiles still load —
  saved data in the wild has no version gate beyond that function.
- **`lib/` is pure.** `stats.ts`, `cost.ts`, `date.ts`, `format.ts` and
  `utils.ts` contain no React, no storage access, and no clock reads. Keep new
  maths there and keep it testable.
- **UI primitives** go in `components/ui/`; feature components go in the folder
  for their screen. Use `cn()` from `lib/utils.ts` for class merging and `cva`
  for variants, matching `button.tsx`.
- **Touch targets** are 44px or larger. The app is designed phone-first: check
  mobile layout before desktop.
- **Copy is non-judgemental.** No shaming, no lectures, no "you failed" framing.
  The pacing prompt says *"no pressure either way"* — match that tone.
- **Comments explain why, not what.** Match the existing density: sparse, and
  only where the reasoning isn't obvious from the code.

## Before calling work done

Run all three — they are fast:

```bash
npx tsc --noEmit && npx eslint src && npm run build
```

For UI changes, actually look at the result. `npm run build && npm start`, then
open it; the service worker only runs in a production build, so PWA changes
cannot be verified in `next dev`. When you have a browser tool available, drive
the real page rather than assuming — that is how the four bugs in work-done.md §5
were caught, and three of them looked fine in the code.

## Don't

- Don't add a dependency without checking whether the repo already does it.
  Eight were removed for going unused; the list in `package.json` is short on
  purpose.
- Don't introduce a backend, an API route, or an `.env` unless asked. The app is
  deliberately offline-first and local-only (work-done.md §7).
- Don't add a light theme without validating a second chart palette for it.
- Don't commit unless the user asks.
- Don't edit the `nextjs-agent-rules` block in `AGENTS.md`; `next dev` rewrites it.
