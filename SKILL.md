# Skill — Build a Life Tracker (warm-stoic, hierarchy-of-goals)

Drop this into a new Claude project as the opening prompt, or paste it as a system message. It produces a single-page HTML life tracker grounded in the hierarchy-of-goals approach, six life pillars, a daily verse, and weekly review — built to be lived with, not gamified.

---

## Brief

Build me a **personal life tracker** as a single HTML page. The owner wants to stop drifting, hit goals across health / wealth / work / family / mind / spirit, and live with daily discipline. This is a **commitment journal**, not a gamified app — no badges, no points, no rainbow charts.

Core philosophy:
- **Hierarchy of goals.** Every small action is a smaller goal of a larger one. The page shows the full cascade: Ultimate aim (5yr) → Year → Quarter → Week → Today.
- **Six pillars.** Body · Wealth · Craft · Father · Mind · Spirit. Each carries an *identity statement* ("I am ___") that, when violated, signals the day is off.
- **Daily verse + nightly reflection.** One Bhagavad Gītā verse per day, three journal lines at night.
- **Weekly review.** Four quadrants: kept word / broke word / noticed / one change.

---

## Aesthetic — non-negotiable

- **Type:** Newsreader (serif) for headings + identity + big numbers; Geist Sans for body; Geist Mono for labels and metrics (uppercase, 10–11px, letter-spacing 0.12–0.14em).
- **Palette:** warm cream bg `oklch(0.97 0.01 85)` / deep warm charcoal fg `oklch(0.22 0.01 60)` / muted greys / **one** accent — burnt sienna `#b25a2b`. No second color. Vary with `color-mix(in oklch, var(--accent) X%, var(--bg-2))`.
- **Dividers:** hairline `1px solid var(--line)` between every section. No drop shadows. No gradients.
- **Iconography:** none. Use Roman numeral / typographic glyphs (❶❷❸❹❺❻) at most.
- **Density:** generous whitespace, max-width 1180px, 56–72px section padding.

If asked for "more visual interest," add **more data** (heatmaps, sparklines, bar charts in the accent color), never decoration.

---

## Sections, in order

1. **§ I · Identity** — Vow headline in serif (max 22ch), supporting paragraph, 4 mono-numeric vital tiles (Done today / Best streak / Quarter % / Energy).
2. **§ II · Today's commitments** — 8 commitments tagged by domain + clock time, click to toggle. Beside it: a progress ring + 28-day streak grid.
3. **§ III · Momentum & ledger** — 4 stat tiles (each with 30-day sparkline), GitHub-style 53×7 year heatmap (today outlined, future dashed-empty), 12-week completion bars, per-pillar trend rows (sparkline + value + delta).
4. **§ IV · The Cascade** — left rail of 5 scope levels (Ultimate / Year / Quarter / Week / Today), clicking shows the items at that level with optional % progress.
5. **§ V · Six pillars** — 3×2 grid of cards. Each card: glyph + name, italic identity statement, current goal, 14-day mini-strip, 30-day sparkline, quarterly progress bar.
6. **§ VI · Verse & reflection** — Bhagavad Gītā verse (Sanskrit toggle) + ref + translation. Beside it: three input lines for the nightly journal.
7. **§ VII · Weekly review** — 4 quadrants: kept word / broke word / noticed / one change. Sunday 19:30.

Footer: program tag, a single italic mantra, current time.

---

## Tech

- React 18 + Babel standalone, pinned versions with integrity hashes (use the official pinned snippets — never unpinned).
- One HTML file with all CSS, one `app.jsx` for components, plus the `tweaks_panel.jsx` starter for the host's Tweaks toggle.
- Data is **deterministically generated** by a seeded PRNG (`mulberry32`) so charts render plausibly without persistence. Real persistence (localStorage) is a follow-up the user will request.
- Tweakable defaults inside `/*EDITMODE-BEGIN*/{...}/*EDITMODE-END*/` JSON markers.

### Tweaks to expose

- `theme` — warm / dark
- `accent` — 5 curated swatches (burnt sienna / slate / olive / wine / black)
- `focus` — which pillar to visually highlight today
- `showSanskrit` — show/hide the Devanagari verse

---

## Voice & copy rules

- Speak like a serious adult journaling at the end of the day. No emoji, no "let's crush it," no productivity-bro language.
- Use second-person sparingly. Prefer first-person identity statements: *"I am the steward of this body."*
- Headlines are short, often two-line; subtitles long enough to actually say something. Example: *"The day you don't track is the day you can lie to yourself. Numbers don't argue."*
- The Gītā verse displayed by default: **BG 2.47** (karmaṇyevādhikāraste mā phaleṣu kadācana...) — translate as: *"You have a right to your labour alone, never to its fruits. Do not let the fruit be the motive of action, nor let your attachment be to inaction."*
- Mantra at footer (Peterson-flavoured paraphrase, not a direct quote): *"Aim at the highest good you can conceive of, and walk toward it."*

---

## Definition of done

A single-page HTML file that:
1. Loads without console errors.
2. Renders all 7 sections in order, separated by hairlines.
3. Today's commitments toggle on click.
4. The Cascade rail switches the body content when clicked.
5. The year heatmap fits its container at any viewport ≥ 760px (test: 53 columns visible, no horizontal overflow — set `min-width: 0` on every nested grid container).
6. Tweaks panel toggles theme / accent / focus / Sanskrit and persists via `__edit_mode_set_keys`.
7. Mobile-readable at 375px (sections stack, heatmap remains but compresses).

---

## What not to build (anti-patterns)

- ❌ A login screen, sign-up, onboarding flow
- ❌ Trophies, levels, XP, achievement modals
- ❌ AI-generated motivational quotes that rotate
- ❌ Animated SVG mascots, illustrated heroes
- ❌ A second accent color, a gradient, a glassmorphism panel
- ❌ Stock-market-style green/red everywhere — use `--ok` / `--warn` only on actual deltas
- ❌ Tabs at the top. The whole page scrolls. Hierarchy is in type and rhythm, not navigation.
