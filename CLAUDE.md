# Life Tracker — project notes for Claude

This project is **a personal life-tracking dashboard** rooted in:
- **Hierarchy-of-goals psychology** (ultimate aim → year → quarter → week → today)
- **Six life pillars** — Body · Wealth · Craft · Father · Mind · Spirit
- **Bhagavad Gītā** as the spiritual anchor (one verse per day, journal nightly)
- A "**warm-stoic**" aesthetic — this is a **commitment journal**, not a gamified streak app. No confetti, no badges, no rainbows.

The owner's intent: stop drifting. Be reliable. Train the body, build wealth, ship at work, be present as a father, evolve in AI, sit with the Gītā. The app is the daily ledger that makes drift visible.

---

## Files

| File | Purpose |
|---|---|
| `Life Tracker.html` | Page shell — fonts, CSS tokens, layout. Loads React + Babel and the two JSX files. |
| `app.jsx` | All React components: Identity, Today, Momentum (heatmap/bars/sparklines), Cascade, Pillars, Verse, Review, Tweaks panel wiring. |
| `tweaks-panel.jsx` | Starter component for the host's Tweaks toggle. **Do not modify** — use the documented API (`useTweaks`, `TweaksPanel`, `TweakRadio`, `TweakSelect`, `TweakColor`, `TweakToggle`). |
| `CLAUDE.md` | This file. |
| `SKILL.md` | Portable build-a-life-tracker prompt. |

Keep new components in `app.jsx` unless it grows past ~800 lines, then split by section (`momentum.jsx`, `cascade.jsx`, etc.) and import via additional `<script type="text/babel" src>` tags. Remember every Babel script has its own scope — share components via `Object.assign(window, {...})`.

---

## Aesthetic — locked in, do not invent

**Type**
- Headings + identity statements + numbers in vital tiles → **Newsreader** (serif), weight 400, letter-spacing -0.01em.
- Body → **Geist Sans**.
- Labels / numerals / eyebrows → **Geist Mono**, 10.5–11px, uppercase, letter-spacing 0.12–0.14em.

**Color tokens** (defined in `:root` and `html.dark` in `Life Tracker.html`)
- `--bg` — warm cream `oklch(0.97 0.01 85)` (or dark equivalent)
- `--fg` — deep warm charcoal `oklch(0.22 0.01 60)`
- `--muted` — `oklch(0.58 0.012 70)`
- `--line` / `--line-2` — hairline dividers
- `--panel` — slightly lifted card background
- **`--accent`** — one and only color. Default burnt sienna `#b25a2b`. User can switch via Tweaks to slate / olive / wine / black. **Do not add a second accent.** Use the accent + opacity / `color-mix` for variations.

**Rules**
- Never add a gradient background.
- No emoji as decoration. The pillar glyphs (❶❷❸❹❺❻) are intentional and serve as numeric markers.
- No drop shadows beyond what `border: 1px solid var(--line)` already provides.
- All sections separated by a single hairline `border-bottom: 1px solid var(--line)`.
- Numbers always in mono. Identity statements always in serif italic or roman serif.
- Body weight ↓ is good; everything else ↑ is good. Sign deltas accordingly.

---

## Information architecture — seven sections, in this order

1. **§ I · Identity** — vow hero + 4 vital tiles (Done today / Best streak / Quarter / Energy)
2. **§ II · Today's commitments** — 8 stones tagged by domain + 28-day strip + progress ring
3. **§ III · Momentum & the ledger** — 4 stat tiles with sparklines / year heatmap / 12-week bars / per-pillar trend rows
4. **§ IV · The Cascade** — Ultimate → Year → Quarter → Week → Today (clickable rail)
5. **§ V · The six pillars** — card per domain with identity statement, goal, 14-day strip, 30-day sparkline, quarterly progress bar
6. **§ VI · Verse & reflection** — Gītā verse + 3 journal prompts
7. **§ VII · Weekly review** — Sun 19:30, four-quadrant retrospective

If asked to add a section, suggest folding into one of the above first. Filler kills this design.

---

## Data shape

```js
DOMAINS         // 6 pillars with stmt/goal/pct/streak/ritual
CASCADE         // 5 scope levels (ultimate/year/quarter/week/today) with items
COMMITMENTS_INIT // today's 8 stones, each with {time, domain, text, done}
VERSE           // Gītā verse — sanskrit + ref + translation parts
DOMAIN_TRENDS   // per-domain {unit, value, delta, trend} for sparkline rows
WEEK_BARS_12    // last 12 weeks % kept
WEEK_DEEP_HRS   // last 12 weeks deep-work hours
```

Sparkline / heatmap / strip data is **generated deterministically** by seeded PRNG (`mulberry32`) — that way the demo always renders plausible data and the user can later wire real persistence in.

---

## Adding features — preferred sequence

When the user asks to extend, default to:
1. **localStorage persistence** for `commitments` and the three journal lines (this is the most-requested next step).
2. **Editable goals** — make the Cascade an authoring tool, not a fixed array. New goal under any level, edit text inline.
3. **Sunday-setup flow** — modal asking the 4 review questions, then seeding next week's commitments.
4. **Per-domain history detail view** — clicking a pillar opens a focused page (or modal) with full history.
5. Only **then**: notifications, mobile-installable PWA, share/export.

Never add: badges, levels, points, social features, achievements popup, sparkly animations.

---

## Tweaks panel API (already wired)

- `const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);`
- `TWEAK_DEFAULTS` is JSON inside the `/*EDITMODE-BEGIN*/.../*EDITMODE-END*/` markers — the host persists writes here.
- Currently exposed tweaks: `theme` (warm/dark), `accent` (5 swatches), `focus` (which pillar to highlight), `showSanskrit`.
- New tweaks: add to `TWEAK_DEFAULTS`, add a `<Tweak*>` control inside `<TweaksPanel>`, read with `t.key`.
