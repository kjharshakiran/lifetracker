/* global React, ReactDOM, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakColor, TweakToggle, useTweaks */
const { useState, useMemo, useEffect } = React;

// ---------- Data ----------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "warm",
  "accent": "#b25a2b",
  "density": "comfortable",
  "showSanskrit": true,
  "focus": "spirit"
}/*EDITMODE-END*/;

const DOMAINS = [
  { id: "health",   glyph: "❶", name: "Body",   stmt: "I am the steward of this body; it will carry me to the end.",
    goal: "Run 5km in under 24:00 · 78kg lean", pct: 62, streak: 21, ritual: "Lift or run · Lights out 22:30" },
  { id: "wealth",   glyph: "❷", name: "Wealth", stmt: "I save before I spend; I build assets before lifestyle.",
    goal: "12mo emergency fund · index DCA monthly", pct: 48, streak: 9, ritual: "Track spend · weekly review" },
  { id: "work",     glyph: "❸", name: "Craft",  stmt: "I ship what I start. Done compounds; perfect doesn't.",
    goal: "Deliver Q2 milestone · 4hr deep work / day", pct: 71, streak: 14, ritual: "Deep work block 09–13" },
  { id: "father",   glyph: "❹", name: "Father", stmt: "I am present. The phone is down when they walk in.",
    goal: "1 dedicated hour with each child, daily", pct: 84, streak: 33, ritual: "Phone away 18–20 · bedtime story" },
  { id: "mind",     glyph: "❺", name: "Mind",   stmt: "I evolve in AI by building one small thing a week.",
    goal: "Ship 1 AI prototype/week · read 1 paper", pct: 55, streak: 7, ritual: "Build hour 21:00 · paper Sat" },
  { id: "spirit",   glyph: "❻", name: "Spirit", stmt: "Do the work; release the fruit. The doer is not me.",
    goal: "Gita chapter daily · 20min meditation", pct: 39, streak: 12, ritual: "Read 1 verse · sit 20min" },
];

const CASCADE = [
  { key: "ultimate", scope: "Ultimate Aim · 5 years",
    text: "Become a man whose word is reliable — strong in body, free in finances, present as a father, deep in craft, anchored in dharma.",
    items: [
      { tag: "becoming", txt: "The person my children would willingly model their life on." , pct: null },
      { tag: "refuse",   txt: "Refuse: cowardice, drift, performative effort, dishonest comfort.", pct: null },
      { tag: "evidence", txt: "Body, balance sheet, relationships and craft each visibly improving year over year.", pct: null },
      { tag: "north",    txt: "The aim is not arrival. The aim is the man the aim makes of me.", pct: null },
    ]
  },
  { key: "year", scope: "This Year · 2026",
    text: "Twelve months to compound: ship the AI side-craft, halve the debt, reclaim the body, never miss bedtime.",
    items: [
      { tag: "body",   txt: "5km under 24:00 · resting HR under 60.", pct: 58 },
      { tag: "wealth", txt: "12-month runway saved · debts cleared by Q4.", pct: 41 },
      { tag: "craft",  txt: "Promotion to Staff · 40 AI prototypes shipped.", pct: 64 },
      { tag: "family", txt: "Weekly date with partner · zero missed bedtimes.", pct: 79 },
    ]
  },
  { key: "quarter", scope: "This Quarter · Q2",
    text: "The quarter is the unit of real work. Three priorities, nothing else gets a slot.",
    items: [
      { tag: "p1",   txt: "Ship v1 of the AI life-tracker side project — public by June 30.", pct: 55 },
      { tag: "p2",   txt: "Drop 4kg, hold 5x/wk training, eat under 2200kcal weekdays.", pct: 47 },
      { tag: "p3",   txt: "Read Bhagavad Gita end-to-end with commentary; one chapter per week.", pct: 62 },
      { tag: "veto", txt: "Vetoed for the quarter: new courses, new gadgets, side gigs.", pct: null },
    ]
  },
  { key: "week", scope: "This Week",
    text: "Five workdays. One outcome per domain. The week is won on Wednesday.",
    items: [
      { tag: "mon", txt: "Deep work: ship onboarding flow draft.", pct: 100 },
      { tag: "tue", txt: "Long run · evening: chapter 3 of Gita with notes.", pct: 100 },
      { tag: "wed", txt: "Stand-up review with partner on finances · transfer to brokerage.", pct: 60 },
      { tag: "thu", txt: "Daughter's school recital — leave laptop at desk.", pct: 0 },
    ]
  },
  { key: "today", scope: "Today",
    text: "What gets done today is the only honest evidence I have of who I am becoming.",
    items: [
      { tag: "first", txt: "Cold water · 20min sit · read one verse before I open the laptop.", pct: null },
      { tag: "deep",  txt: "09:00–13:00 deep work — phone in drawer, one tab.", pct: null },
      { tag: "move",  txt: "Train at 17:30 — pull day, 45 minutes, no scrolling between sets.", pct: null },
      { tag: "close", txt: "Phone away 18–20. Bedtime story. Journal 3 lines. Sleep 22:30.", pct: null },
    ]
  },
];

// Commitments now come from the backend (see /api/commitments). The 8 stones are seeded
// from db/seed.js (mirrored from the original mock data).

// --- API helpers ---
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    ...opts,
  });
  if (res.status === 401) {
    // Session expired or never authenticated — bubble up so AuthGate can re-show.
    const err = new Error("unauthorized");
    err.status = 401;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const VERSE = {
  sanskrit: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि ॥",
  ref: "Bhagavad Gītā · 2.47",
  translation: {
    pre: "You have a right to your ",
    bold: "labour alone",
    post: ", never to its fruits. Do not let the fruit be the motive of action, nor let your attachment be to inaction.",
  },
};

const DOMAIN_PALETTE = {
  "Spirit": "spirit", "Body": "health", "Wealth": "wealth", "Craft": "work", "Father": "father", "Mind": "mind"
};

// ---------- Helpers ----------
function todayStr() {
  const d = new Date();
  const wd = d.toLocaleDateString("en-US", { weekday: "long" });
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return { wd, date };
}

function pad(n) { return String(n).padStart(2, "0"); }

// 'morning' before noon · 'evening' from 21:00 · 'day' otherwise.
// Re-evaluated on a 60s tick so the page transitions without a refresh.
function useDayMode() {
  const compute = () => {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h >= 21) return "evening";
    return "day";
  };
  const [mode, setMode] = useState(compute);
  useEffect(() => {
    const id = setInterval(() => setMode(compute()), 60_000);
    return () => clearInterval(id);
  }, []);
  return mode;
}

// "HH:MM" → minutes since midnight, for ordering commitments against the clock.
function minutesOfDay(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

// The "next stone": first undone commitment at or after now,
// else the earliest undone commitment of the day,
// else null when all eight stones are placed.
function nextStone(commitments) {
  if (!commitments || !commitments.length) return null;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const undone = commitments.filter(c => !c.done);
  if (!undone.length) return null;
  const upcoming = undone
    .map(c => ({ c, t: minutesOfDay(c.time) }))
    .filter(x => x.t >= nowMins)
    .sort((a, b) => a.t - b.t);
  if (upcoming.length) return upcoming[0].c;
  return undone.slice().sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time))[0];
}

// Deterministic streak grid (28 days x 1) for hero card
function streakCells(n) {
  const out = [];
  let seed = 7;
  for (let i = 0; i < n; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const r = seed / 233280;
    out.push(r < 0.16 ? "off" : r < 0.45 ? "lo" : "hi");
  }
  // Force last 6 to be "hi" for momentum
  for (let i = n - 6; i < n; i++) out[i] = "hi";
  return out;
}

// Seeded PRNG
function mulberry32(a) { return function() { a |= 0; a = a + 0x6D2B79F5 | 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 371 cells (53 weeks * 7 days). Rightmost col is current week; bottom-right is today.
// Returns array of {l: 0-4, today: bool, future: bool}
function genYearHeatmap(seed) {
  const rng = mulberry32(seed);
  const N = 53 * 7;
  const todayIdx = N - 1; // bottom-right
  // Trend that climbs gently
  const cells = [];
  for (let i = 0; i < N; i++) {
    const future = i > todayIdx;
    // weekday = i % 7 (col-major would differ — we build col-major below)
    // We'll fill grid as columns of 7. Index i = col*7 + row
    const col = Math.floor(i / 7);
    const row = i % 7;
    const isWeekend = row === 0 || row === 6;
    const trend = col / 53; // 0..1 climbing
    const r = rng();
    let l;
    if (future) l = 0;
    else if (r < 0.10 - trend * 0.06) l = 0;
    else {
      const base = r + trend * 0.4 - (isWeekend ? 0.18 : 0);
      if (base < 0.30) l = 1;
      else if (base < 0.55) l = 2;
      else if (base < 0.80) l = 3;
      else l = 4;
    }
    cells.push({ l, today: i === todayIdx, future });
  }
  return cells;
}

// 30-day sparkline values for each domain (seeded by domain id)
function genSeries(seedKey, n, opts = {}) {
  const seed = [...seedKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = mulberry32(seed * 31);
  const trend = opts.trend ?? 0.4;
  const noise = opts.noise ?? 0.4;
  const out = [];
  let v = 0.4;
  for (let i = 0; i < n; i++) {
    v += (rng() - 0.5) * noise * 0.3;
    v += trend * 0.01;
    v = Math.max(0.05, Math.min(0.98, v));
    out.push(v);
  }
  return out;
}

// 14-day strip per pillar, level 0-3
function genStrip14(seedKey) {
  const seed = [...seedKey].reduce((a, c) => a + c.charCodeAt(0), 7);
  const rng = mulberry32(seed * 17);
  const out = [];
  for (let i = 0; i < 14; i++) {
    const r = rng();
    out.push(r < 0.12 ? 0 : r < 0.40 ? 1 : r < 0.75 ? 2 : 3);
  }
  // Recent 4 days fully consistent
  for (let i = 10; i < 14; i++) out[i] = 3;
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];
const WEEK_BARS_12 = [62, 71, 48, 80, 55, 92, 74, 68, 84, 90, 77, 88];
const WEEK_DEEP_HRS = [12, 18, 9, 21, 15, 24, 19, 17, 22, 26, 20, 23];

const DOMAIN_TRENDS = {
  health: { unit: "kg",   value: 81.2, delta: -1.4, trend: 0.55 },
  wealth: { unit: "k$",   value: 36.4, delta: +2.1, trend: 0.65 },
  work:   { unit: "hrs",  value: 18.5, delta: +3.0, trend: 0.7 },
  father: { unit: "min",  value: 92,   delta: +12,  trend: 0.6 },
  mind:   { unit: "/wk",  value: 1.0,  delta: +1,   trend: 0.5 },
  spirit: { unit: "min",  value: 17,   delta: +4,   trend: 0.45 },
};

function Ring({ pct, label, sub }) {
  const r = 42, c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="ring">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--accent)" strokeWidth="3"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="butt" />
      </svg>
      <div className="lbl">
        <div>
          {label}
          <small>{sub}</small>
        </div>
      </div>
    </div>
  );
}

// Inline sparkline. values 0..1. Renders line + area + last-point dot.
function Sparkline({ values, w = 200, h = 40, stroke = "var(--accent)", area = true, fluid = false }) {
  if (!values || !values.length) return null;
  const pad = 2;
  const max = Math.max(...values), min = Math.min(...values);
  const range = Math.max(0.0001, max - min);
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const areaD = d + ` L ${pts[pts.length-1][0].toFixed(1)},${h} L ${pts[0][0].toFixed(1)},${h} Z`;
  const last = pts[pts.length-1];
  const svgProps = fluid
    ? { style: { width: "100%", height: h, display: "block" } }
    : { width: w, height: h };
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" {...svgProps}>
      {area && <path d={areaD} fill={stroke} opacity="0.13" />}
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={stroke} />
    </svg>
  );
}

function YearHeatmap() {
  const cells = useMemo(() => genYearHeatmap(42), []);
  // Build into 53 columns × 7 rows
  const cols = [];
  for (let c = 0; c < 53; c++) {
    const col = [];
    for (let r = 0; r < 7; r++) col.push(cells[c * 7 + r]);
    cols.push(col);
  }
  // Monthly labels — approximate by column index
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-head">
        <h3>The year in stone</h3>
        <div className="legend">
          <span>LESS</span>
          <span className="swatch">
            <i data-l="0" className="heatmap-cell" />
            <i style={{ background: "color-mix(in oklch, var(--accent) 18%, var(--bg-2))" }} />
            <i style={{ background: "color-mix(in oklch, var(--accent) 38%, var(--bg-2))" }} />
            <i style={{ background: "color-mix(in oklch, var(--accent) 62%, var(--bg-2))" }} />
            <i style={{ background: "var(--accent)" }} />
          </span>
          <span>MORE</span>
        </div>
      </div>
      <div className="heatmap-months">
        {MONTHS.map((m, i) => <span key={m} style={{ gridColumn: `${Math.round(i * 53 / 12) + 1} / span 4` }}>{m}</span>)}
      </div>
      <div className="heatmap">
        <div className="heatmap-days">
          {DAY_LABELS.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="heatmap-grid">
          {cols.map((col, ci) => (
            <div className="heatmap-col" key={ci}>
              {col.map((cell, ri) => (
                <div key={ri}
                  className={"heatmap-cell" + (cell.today ? " today" : "") + (cell.future ? " future" : "")}
                  data-l={cell.l}
                  title={cell.today ? "Today" : ""}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekBars() {
  const max = Math.max(...WEEK_BARS_12);
  return (
    <div className="bars-card">
      <div className="head">
        <h3>Last 12 weeks — % of commitments kept</h3>
        <div className="sub">avg <b style={{ color: "var(--fg)" }}>74%</b> · best <b style={{ color: "var(--fg)" }}>92%</b></div>
      </div>
      <div className="bars">
        {WEEK_BARS_12.map((v, i) => (
          <div className="bar-col" key={i}>
            <div className={"bar" + (i < 8 ? " thin" : "")}
              style={{ height: (v / 100) * 100 + "%" }}
              title={v + "%"} />
            <div className="lbl">W{30 + i}</div>
          </div>
        ))}
      </div>
      <div className="bars-foot">
        <span>WEEK 30 → 41</span>
        <span style={{ color: "var(--ok)" }}>+18 pts vs prior 12</span>
      </div>
    </div>
  );
}

function TrendRows() {
  const rows = DOMAINS.map(d => ({
    nm: d.name,
    series: genSeries(d.id, 30, { trend: DOMAIN_TRENDS[d.id].trend, noise: 0.5 }),
    v: DOMAIN_TRENDS[d.id].value,
    unit: DOMAIN_TRENDS[d.id].unit,
    delta: DOMAIN_TRENDS[d.id].delta,
  }));
  return (
    <div className="trends-card">
      <h3>By the numbers · last 30 days</h3>
      {rows.map(r => {
        const up = r.delta > 0;
        // For "health" weight loss, down is good. For "spirit" min, up is good. We'll show raw sign.
        const goodUp = r.nm !== "Body"; // body weight: down is good
        const cls = up ? (goodUp ? "up" : "dn") : (goodUp ? "dn" : "up");
        return (
          <div className="trend" key={r.nm}>
            <div className="nm">{r.nm}</div>
            <Sparkline values={r.series} w={180} h={28} fluid />
            <div className="v">{r.v}<span style={{ color: "var(--muted)", marginLeft: 3 }}>{r.unit}</span></div>
            <div className={"d " + cls}>{(r.delta > 0 ? "+" : "") + r.delta}</div>
          </div>
        );
      })}
    </div>
  );
}

function Momentum() {
  const totalKept = useMemo(() => {
    const cells = genYearHeatmap(42);
    return cells.filter(c => !c.future && c.l > 0).length;
  }, []);
  const sparkA = useMemo(() => genSeries("ledgerA", 30, { trend: 0.5 }), []);
  const sparkB = useMemo(() => genSeries("ledgerB", 30, { trend: 0.7 }), []);
  const sparkC = useMemo(() => genSeries("ledgerC", 12, { trend: 0.4, noise: 0.6 }), []);
  return (
    <section className="block">
      <div className="section-head">
        <div>
          <div className="eyebrow">§ III</div>
          <h2>Momentum &amp; the ledger</h2>
        </div>
        <div className="note">The day you don't track is the day you can lie to yourself. Numbers don't argue.</div>
      </div>
      <div className="ledger">
        <div>
          <div className="k">Days kept · YTD</div>
          <div className="v">{totalKept}<small>/ 136</small></div>
          <div className="sub"><span className="delta-up">+11</span> vs prior period</div>
          <div className="sparkbox"><Sparkline values={sparkA} w={200} h={28} fluid /></div>
        </div>
        <div>
          <div className="k">Current streak</div>
          <div className="v">21<small>days</small></div>
          <div className="sub">best · 33 · <span style={{ color: "var(--muted)" }}>Feb 03 → Mar 08</span></div>
          <div className="sparkbox"><Sparkline values={sparkB} w={200} h={28} fluid /></div>
        </div>
        <div>
          <div className="k">Deep work · this wk</div>
          <div className="v">23<small>hrs</small></div>
          <div className="sub"><span className="delta-up">+3 hrs</span> vs last week</div>
          <div className="sparkbox"><Sparkline values={WEEK_DEEP_HRS.map(v => v / 30)} w={200} h={28} fluid /></div>
        </div>
        <div>
          <div className="k">Perfect weeks · YTD</div>
          <div className="v">6<small>/ 20</small></div>
          <div className="sub">target · 26 by year end</div>
          <div className="sparkbox"><Sparkline values={sparkC} w={200} h={28} fluid /></div>
        </div>
      </div>

      <YearHeatmap />

      <div className="charts">
        <WeekBars />
        <TrendRows />
      </div>
    </section>
  );
}

function Topbar({ t }) {
  const { wd, date } = todayStr();
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">L</div>
        <div>
          <div className="brand-name">The Cascade <span className="brand-sub">/ life-tracker</span></div>
        </div>
      </div>
      <div className="topbar-meta">
        <span><b>{wd}</b> · {date}</span>
        <span>Wk <b>20</b> / 52</span>
        <span>Day <b>136</b> / 365</span>
      </div>
    </div>
  );
}

// Slope glyph for "trend, not streak" — defended in the brief (loss-aversion + what-the-hell).
function slopeGlyph(slope) {
  return slope === "up" ? "↑" : slope === "down" ? "↓" : "→";
}
function slopeWord(slope) {
  return slope === "up" ? "trending up" : slope === "down" ? "trending down" : "holding steady";
}

function Identity({ done, total, momentum }) {
  const propPct = momentum ? Math.round(momentum.proportion * 100) : null;
  return (
    <section className="identity">
      <div className="eyebrow">§ I · Identity</div>
      <div className="identity-grid">
        <div>
          <h1>
            I am the man <em>my word</em> will eventually describe.<br/>
            Today is one stone of that wall.
          </h1>
          <div className="vow">
            Father of one. Builder. Student of the Gītā. I do hard things on a schedule; I keep my word to myself first. The aim is not to be impressive — it is to be reliable.
          </div>
        </div>
        <div className="vitals">
          <div>
            <div className="vital-k">Done today</div>
            <div className="vital-v">{done}<small>of {total}</small></div>
          </div>
          <div>
            <div className="vital-k">Last 28 days</div>
            <div className="vital-v">
              {momentum ? `${momentum.kept}` : "—"}
              <small>of {momentum ? momentum.total : "—"} kept</small>
            </div>
          </div>
          <div>
            <div className="vital-k">Trend</div>
            <div className="vital-v">
              {momentum ? `${propPct}%` : "—"}
              <small>{momentum ? `${slopeGlyph(momentum.slope)} ${slopeWord(momentum.slope)}` : ""}</small>
            </div>
          </div>
          <div>
            <div className="vital-k">Quarter</div>
            <div className="vital-v">52<small>%</small></div>
          </div>
        </div>
      </div>
    </section>
  );
}

const DOMAIN_NAMES = ["Body", "Wealth", "Craft", "Father", "Mind", "Spirit"];

function CommitForm({ initial, onSave, onCancel, onDelete, saveLabel = "Save" }) {
  const [time, setTime] = useState(initial.time || "09:00");
  const [domain, setDomain] = useState(initial.domain || "Craft");
  const [text, setText] = useState(initial.text || "");
  const [trigger, setTrigger] = useState(initial.trigger || "");
  const [tinyText, setTinyText] = useState(initial.tiny_text || "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="commit-form">
      <div className="commit-form-row">
        <input type="time" className="time-input" value={time}
          onChange={e => setTime(e.target.value)} disabled={busy} />
        <select value={domain} onChange={e => setDomain(e.target.value)} disabled={busy}>
          {DOMAIN_NAMES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="text" autoFocus={!initial.id} value={text}
          placeholder="A stone to place today…"
          maxLength={140}
          onChange={e => setText(e.target.value)} disabled={busy} />
      </div>
      <div className="commit-form-row commit-form-sub">
        <input type="text" value={trigger}
          placeholder="When / where — the cue (e.g. 06:30 · kitchen, after coffee)"
          maxLength={120} className="commit-form-trigger"
          onChange={e => setTrigger(e.target.value)} disabled={busy} />
        <input type="text" value={tinyText}
          placeholder="Tiny version, for hard days (e.g. just put on shoes)"
          maxLength={100} className="commit-form-tiny"
          onChange={e => setTinyText(e.target.value)} disabled={busy} />
      </div>
      <div className="actions">
        <button type="button" className="save" disabled={!text.trim() || busy}
          onClick={async () => {
            setBusy(true);
            await onSave({ time, domain, text: text.trim(), trigger: trigger.trim(), tiny_text: tinyText.trim() });
            setBusy(false);
          }}>
          {saveLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        {onDelete && (
          <button type="button" className="delete" disabled={busy}
            onClick={async () => { setBusy(true); await onDelete(); setBusy(false); }}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function Recommendations({ items, dismissed, onPromote, onDismiss }) {
  const visible = items.filter(r => !dismissed.has(r.id));
  if (!visible.length) return null;
  return (
    <div className="recs">
      <div className="recs-head">
        <div className="eyebrow">Consider also</div>
        <div className="eyebrow" style={{ color: "var(--muted)" }}>from the Cascade</div>
      </div>
      {visible.map(r => (
        <div className="rec" key={r.id}>
          <div className="rec-tag">{r.scope_key === "week" ? r.tag : r.scope_key}</div>
          <div className="rec-txt">{r.txt}</div>
          <button type="button" className="promote" onClick={() => onPromote(r)}>Promote</button>
          <button type="button" className="dismiss" onClick={() => onDismiss(r.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}

function Today({ commitments, toggle, skip, onMutate, momentum }) {
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(null); // null | { prefillText?: string }
  const [recs, setRecs] = useState([]);
  const [skippingId, setSkippingId] = useState(null);
  const [skipReason, setSkipReason] = useState("");
  const dateISO = todayISO();
  const dismissKey = `lt-dismissed-recs:${dateISO}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      const raw = localStorage.getItem(dismissKey);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    let cancelled = false;
    api(`/api/recommendations?date=${dateISO}`).then(j => {
      if (!cancelled) setRecs(j.items);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [dateISO]);

  const persistDismissed = (next) => {
    setDismissed(next);
    try { localStorage.setItem(dismissKey, JSON.stringify([...next])); } catch {}
  };

  const startEdit = (id) => { setAdding(null); setEditingId(id); };
  const startAdd = (prefillText) => { setEditingId(null); setAdding({ prefillText }); };

  const saveEdit = async (id, body) => {
    try {
      await api(`/api/commitments/template/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      setEditingId(null);
      await onMutate();
    } catch (e) { console.error(e); }
  };

  const saveAdd = async (body, promotedRecId) => {
    try {
      await api(`/api/commitments/template`, { method: "POST", body: JSON.stringify(body) });
      setAdding(null);
      if (promotedRecId != null) {
        const next = new Set(dismissed); next.add(promotedRecId); persistDismissed(next);
      }
      await onMutate();
    } catch (e) { console.error(e); }
  };

  const deleteStone = async (id) => {
    try {
      await api(`/api/commitments/template/${id}`, { method: "DELETE" });
      setEditingId(null);
      await onMutate();
    } catch (e) { console.error(e); }
  };

  const dismissRec = (id) => {
    const next = new Set(dismissed); next.add(id); persistDismissed(next);
  };

  const done = commitments.filter(c => c.done).length;
  const total = commitments.length;

  const startSkip = (id) => { setSkippingId(id); setSkipReason(""); };
  const cancelSkip = () => { setSkippingId(null); setSkipReason(""); };
  const confirmSkip = async (id) => {
    if (!skipReason.trim()) return;
    await skip(id, skipReason.trim());
    cancelSkip();
  };

  return (
    <section className="block">
      <div className="section-head">
        <div>
          <div className="eyebrow">§ II</div>
          <h2>Today's commitments to myself</h2>
        </div>
        <div className="note">Stones, placed one at a time. Don't negotiate at 09:01 what was decided at 21:00.</div>
      </div>
      <div className="today">
        <div className="commitments">
          {commitments.map(c => (
            editingId === c.id ? (
              <CommitForm key={c.id}
                initial={{ id: c.id, time: c.time, domain: c.domain, text: c.text, trigger: c.trigger, tiny_text: c.tiny_text }}
                saveLabel="Save"
                onSave={(body) => saveEdit(c.id, body)}
                onCancel={() => setEditingId(null)}
                onDelete={() => deleteStone(c.id)}
              />
            ) : skippingId === c.id ? (
              <div key={c.id} className="commit-skip-form">
                <div className="eyebrow">Skip · why?</div>
                <input type="text" autoFocus value={skipReason}
                  placeholder="One honest line. Friction prevents reflexive skipping."
                  maxLength={200}
                  onChange={e => setSkipReason(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") confirmSkip(c.id); if (e.key === "Escape") cancelSkip(); }} />
                <div className="actions">
                  <button type="button" className="save" disabled={!skipReason.trim()} onClick={() => confirmSkip(c.id)}>Skip</button>
                  <button type="button" onClick={cancelSkip}>Cancel</button>
                </div>
              </div>
            ) : (
              <div key={c.id} className={"commit " + (c.done ? "done " : "") + (c.skipped ? "skipped" : "")}
                   onClick={() => toggle(c.id)}>
                <div className="check">
                  {c.done && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {c.skipped && !c.done && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3 L9 9 M9 3 L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>
                <div className="label">
                  <div className="label-main">{c.text}</div>
                  {c.trigger && <div className="commit-trigger mono">{c.trigger}</div>}
                  {c.tiny_text && <div className="commit-tiny">If hard: {c.tiny_text}</div>}
                  {c.skipped && c.skip_reason && <div className="commit-skip-reason">skipped — {c.skip_reason}</div>}
                </div>
                <div className="dtag">{c.domain}</div>
                <div className="time">{c.time}</div>
                <div className="commit-actions">
                  <button type="button" className="commit-edit-btn"
                    onClick={(e) => { e.stopPropagation(); startEdit(c.id); }}>Edit</button>
                  {!c.done && !c.skipped && (
                    <button type="button" className="commit-skip-btn"
                      onClick={(e) => { e.stopPropagation(); startSkip(c.id); }}>Skip</button>
                  )}
                </div>
              </div>
            )
          ))}
          {adding ? (
            <CommitForm
              initial={{ time: "09:00", domain: "Craft", text: adding.prefillText || "", trigger: "", tiny_text: "" }}
              saveLabel="Add"
              onSave={(body) => saveAdd(body, adding.promotedRecId)}
              onCancel={() => setAdding(null)}
            />
          ) : (
            <button type="button" className="commit-add" onClick={() => startAdd()}>
              + Add a commitment
            </button>
          )}
          <Recommendations
            items={recs}
            dismissed={dismissed}
            onPromote={(r) => { setEditingId(null); setAdding({ prefillText: r.txt, promotedRecId: r.id }); }}
            onDismiss={dismissRec}
          />
        </div>
        <div className="progress-card">
          <div className="ring-row">
            <Ring pct={(done/total)*100} label={`${done}/${total}`} sub="DAY" />
            <div>
              <h3>The day, in stone.</h3>
              <p>Eight commitments. Six tied to a domain, two to a time. Cross them off without ceremony.</p>
            </div>
          </div>
          <div>
            <div className="streak-meta" style={{ marginBottom: 8 }}>
              <span>LAST 28 DAYS</span>
              <span>
                {momentum
                  ? `${Math.round(momentum.proportion * 100)}% kept · ${slopeGlyph(momentum.slope)} ${slopeWord(momentum.slope)}`
                  : "loading…"}
              </span>
            </div>
            <div className="streak-grid">
              {(momentum?.cells || Array(28).fill(null)).map((cell, i) => {
                const lvl = !cell || cell.total === 0 ? "off"
                          : cell.kept === 0 ? "off"
                          : cell.kept / cell.total >= 0.66 ? "hi"
                          : cell.kept / cell.total >= 0.33 ? "lo"
                          : "lo";
                return <div key={i} className={"cell " + (lvl === "off" ? "" : lvl)}
                              title={cell ? `${cell.date}: ${cell.kept}/${cell.total}` : ""} />;
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Cascade() {
  const [active, setActive] = useState("today");
  const cur = CASCADE.find(c => c.key === active);
  return (
    <section className="block">
      <div className="section-head">
        <div>
          <div className="eyebrow">§ IV</div>
          <h2>The Cascade — from aim to action</h2>
        </div>
        <div className="note">Every goal is a smaller goal of a larger one. If the smallest action doesn't serve the largest aim, drop it.</div>
      </div>
      <div className="cascade">
        <div className="cascade-rail">
          {CASCADE.map((c, i) => (
            <div key={c.key} className={"lvl " + (c.key === active ? "active" : "")} onClick={() => setActive(c.key)}>
              <span className="n">{pad(i+1)}</span>
              <span className="t">{c.scope.split(" · ")[0]}</span>
            </div>
          ))}
        </div>
        <div className="cascade-body">
          <div className="scope">{cur.scope}</div>
          <h3>{cur.text}</h3>
          <div className="items">
            {cur.items.map((it, i) => (
              <div key={i} className="item">
                <div className="tag">{it.tag}</div>
                <div className="txt">{it.txt}</div>
                {it.pct != null && <div className="pct">{it.pct}%</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Domains({ focus }) {
  return (
    <section className="block">
      <div className="section-head">
        <div>
          <div className="eyebrow">§ V</div>
          <h2>The six pillars</h2>
        </div>
        <div className="note">Body, Wealth, Craft, Father, Mind, Spirit. Each carries an identity sentence — the &quot;I am&quot; that, when violated, signals the day is off.</div>
      </div>
      <div className="domains">
        {DOMAINS.map(d => {
          const strip = genStrip14(d.id);
          const series = genSeries(d.id + "-pillar", 30, { trend: DOMAIN_TRENDS[d.id].trend, noise: 0.5 });
          return (
            <div key={d.id}
                 className={"domain " + (d.id === focus ? "focus" : "")}
                 onClick={() => go(`/pillar/${d.id}`)}
                 role="link"
                 tabIndex={0}
                 onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") go(`/pillar/${d.id}`); }}>
              <div className="domain-head">
                <div className="glyph">{d.glyph}</div>
                <div className="name">{d.name}</div>
                <div className="domain-arrow mono">→</div>
              </div>
              <div className="id-stmt">{d.stmt}</div>
              <div className="goal">
                <span className="lbl">Current goal</span>
                {d.goal}
              </div>
              <div>
                <div className="strip-lbl"><span>LAST 14 DAYS</span><span>{d.streak}-day streak</span></div>
                <div className="mini-strip">
                  {strip.map((l, i) => <div key={i} className="c" data-l={l} />)}
                </div>
              </div>
              <div style={{ marginTop: "auto" }}>
                <Sparkline values={series} w={260} h={32} fluid />
                <div className="bar" style={{ marginTop: 8 }}><i style={{ width: d.pct + "%" }} /></div>
                <div className="meta" style={{ marginTop: 8 }}>
                  <span>{d.pct}% to quarterly aim</span>
                  <span>{DOMAIN_TRENDS[d.id].value}{DOMAIN_TRENDS[d.id].unit}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Verse({ showSanskrit }) {
  return (
    <section className="block">
      <div className="section-head">
        <div>
          <div className="eyebrow">§ VI</div>
          <h2>Verse &amp; reflection</h2>
        </div>
        <div className="note">One verse a day. Sit with it for three minutes before the day pulls you into motion.</div>
      </div>
      <div className="verse verse-solo">
        <div>
          {showSanskrit && (
            <div className="sanskrit" style={{ whiteSpace: "pre-line" }}>
              {VERSE.sanskrit}
            </div>
          )}
          <div className="ref">{VERSE.ref}</div>
          <div className="translation">
            {VERSE.translation.pre}<b>{VERSE.translation.bold}</b>{VERSE.translation.post}
          </div>
        </div>
        <div className="reflect verse-anchor">
          <div className="eyebrow">Tonight, in the Counsel</div>
          <p>The three evening questions live at the top of the page after 21:00 — controlled · pulled · tomorrow's stone. This verse is the anchor; the reflection is the practice.</p>
        </div>
      </div>
    </section>
  );
}

function Review() {
  return (
    <section className="block" style={{ borderBottom: 0 }}>
      <div className="section-head">
        <div>
          <div className="eyebrow">§ VII</div>
          <h2>Weekly review · Sunday, 19:30</h2>
        </div>
        <div className="note">Twenty minutes, pen and paper. The week you don't review is the week that doesn't compound.</div>
      </div>
      <div className="review">
        <div>
          <div className="k">Where I kept my word</div>
          <div className="v">Bedtimes. Training 5 of 5. Two deep-work blocks of four hours.</div>
          <div className="sm">— compounding</div>
        </div>
        <div>
          <div className="k">Where I broke it</div>
          <div className="v">Phone in hand at the dinner table on Thursday. Skipped journaling twice.</div>
          <div className="sm">— costing me</div>
        </div>
        <div>
          <div className="k">What I noticed</div>
          <div className="v">Mornings carrying the day. When the first hour is mine, the last hour is calm.</div>
          <div className="sm">— signal</div>
        </div>
        <div>
          <div className="k">One change next week</div>
          <div className="v">Phone charges in the kitchen, not the bedroom. Non-negotiable.</div>
          <div className="sm">— small, atomic, this week</div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <div className="foot">
      <span>LIFE-TRACKER · v0.1 · personal use</span>
      <span className="mantra">“Aim at the highest good you can conceive of, and walk toward it.”</span>
      <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  );
}

// ---------- Routing ----------
// Tiny hash router. Returns { name, params } for the current location.hash.
// Routes:  ""  → home   ·   "#/pillar/<id>" → pillar.
function parseHash() {
  const h = (window.location.hash || "").replace(/^#/, "");
  const m = /^\/pillar\/([a-z0-9_-]+)$/.exec(h);
  if (m) return { name: "pillar", params: { id: m[1] } };
  return { name: "home", params: {} };
}
function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  // Scroll to top on route change.
  useEffect(() => { window.scrollTo(0, 0); }, [route.name, route.params.id]);
  return route;
}
function go(hash) { window.location.hash = hash; }

// ---------- Wealth page ----------
const MS_DAY = 24 * 60 * 60 * 1000;
function fmtUSD(n, { compact = false } = {}) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const opts = compact && Math.abs(n) >= 10_000
    ? { notation: "compact", maximumFractionDigits: 1 }
    : { maximumFractionDigits: 0 };
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", ...opts }).format(n);
}
function fmtDelta(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = n >= 0 ? "+" : "−";
  return `${s}${fmtUSD(Math.abs(n))}`;
}
function daysBetween(aISO, bISO) {
  const a = new Date(aISO + "T00:00:00").getTime();
  const b = new Date(bISO + "T00:00:00").getTime();
  return Math.round((b - a) / MS_DAY);
}
function isoNDaysAgo(n) {
  return new Date(Date.now() - n * MS_DAY).toISOString().slice(0, 10);
}

// Build per-account series: { [account_id]: [{date, balance}, ...] } sorted ascending.
function groupSnapshots(snapshots) {
  const by = {};
  for (const s of snapshots) {
    (by[s.account_id] ||= []).push({ date: s.date, balance: s.balance });
  }
  for (const id in by) by[id].sort((x, y) => x.date.localeCompare(y.date));
  return by;
}

// Net worth at a given date = sum across accounts of the most-recent snapshot on/before that date.
function netWorthAt(byAccount, dateISO) {
  let sum = 0, anyData = false;
  for (const id in byAccount) {
    const series = byAccount[id];
    let latest = null;
    for (const p of series) { if (p.date <= dateISO) latest = p; else break; }
    if (latest) { sum += latest.balance; anyData = true; }
  }
  return anyData ? sum : null;
}

function WealthHero({ accounts, byAccount }) {
  const today = todayISO();
  const now  = netWorthAt(byAccount, today);
  const d7   = netWorthAt(byAccount, isoNDaysAgo(7));
  const d30  = netWorthAt(byAccount, isoNDaysAgo(30));
  const ytdISO = `${new Date().getFullYear() - 1}-12-31`;
  const ytd  = netWorthAt(byAccount, ytdISO);
  const delta = (a, b) => (a == null || b == null) ? null : a - b;

  return (
    <div className="wealth-hero">
      <div className="eyebrow">Net worth · today</div>
      <div className="wealth-now">{now == null ? "no data yet" : fmtUSD(now)}</div>
      <div className="wealth-deltas">
        <div><span className="lbl mono">7d</span><span className="v mono">{fmtDelta(delta(now, d7))}</span></div>
        <div><span className="lbl mono">30d</span><span className="v mono">{fmtDelta(delta(now, d30))}</span></div>
        <div><span className="lbl mono">YTD</span><span className="v mono">{fmtDelta(delta(now, ytd))}</span></div>
        <div><span className="lbl mono">accounts</span><span className="v mono">{accounts.length}</span></div>
      </div>
    </div>
  );
}

function UpdateToday({ accounts, byAccount, onSaved }) {
  const today = todayISO();
  // Prefill with today's snapshot if present, else latest known value.
  const initial = useMemo(() => {
    const out = {};
    for (const a of accounts) {
      const series = byAccount[a.id] || [];
      const todayRow = series.find(p => p.date === today);
      const latest = series.length ? series[series.length - 1] : null;
      out[a.id] = (todayRow ? todayRow.balance : (latest ? latest.balance : "")).toString();
    }
    return out;
  }, [accounts, byAccount, today]);

  const [vals, setVals] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  // Re-prefill when accounts or stored snapshots change.
  useEffect(() => { setVals(initial); }, [initial]);

  const set = (id) => (e) => setVals(v => ({ ...v, [id]: e.target.value }));

  const save = async () => {
    setSaving(true);
    const balances = {};
    for (const a of accounts) {
      const raw = (vals[a.id] || "").toString().replace(/[, $]/g, "");
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      balances[a.id] = n;
    }
    try {
      await api(`/api/wealth/snapshots`, {
        method: "PUT",
        body: JSON.stringify({ date: today, balances }),
      });
      setSavedAt(new Date());
      await onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <div className="wealth-update">
      <div className="section-head">
        <div>
          <div className="eyebrow">Update today · {today}</div>
          <h2>The day's balances</h2>
        </div>
        <div className="note">Pre-filled with last known values. Edit what moved; leave the rest. One snapshot per account per day.</div>
      </div>
      <div className="wealth-update-grid">
        {accounts.map(a => (
          <label key={a.id} className="wealth-update-row">
            <div className="wealth-update-name">
              <div className="serif">{a.name}</div>
              <div className="mono muted">{a.institution || a.kind}</div>
            </div>
            <div className="wealth-update-input">
              <span className="mono">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={vals[a.id] ?? ""}
                onChange={set(a.id)}
                placeholder="0"
              />
            </div>
          </label>
        ))}
      </div>
      <div className="wealth-update-foot">
        <button type="button" className="wealth-save" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save today's balances"}
        </button>
        {savedAt && <span className="mono muted">saved · {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
    </div>
  );
}

function AccountsList({ accounts, byAccount, onAdd, onMutate }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [kind, setKind] = useState("brokerage");

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await api(`/api/wealth/accounts`, { method: "POST", body: JSON.stringify({ name: name.trim(), kind, institution: institution.trim() }) });
      setName(""); setInstitution(""); setKind("brokerage"); setAdding(false);
      await onAdd();
    } catch (e) { console.error(e); }
  };

  const remove = async (id) => {
    if (!confirm("Remove this account from view? Snapshots stay in the database.")) return;
    try {
      await api(`/api/wealth/accounts/${id}`, { method: "DELETE" });
      await onMutate();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="wealth-accounts">
      <div className="section-head">
        <div>
          <div className="eyebrow">Accounts</div>
          <h2>What is being tracked</h2>
        </div>
      </div>
      <div className="wealth-accounts-list">
        {accounts.map(a => {
          const series = byAccount[a.id] || [];
          const latest = series.length ? series[series.length - 1] : null;
          const prev   = series.length > 1 ? series[series.length - 2] : null;
          const delta  = (latest && prev) ? latest.balance - prev.balance : null;
          const ageDays = latest ? daysBetween(latest.date, todayISO()) : null;
          return (
            <div key={a.id} className="wealth-account">
              <div>
                <div className="serif wealth-account-name">{a.name}</div>
                <div className="mono muted">{a.institution || a.kind}</div>
              </div>
              <div className="wealth-account-bal">
                <div className="serif">{latest ? fmtUSD(latest.balance) : "—"}</div>
                <div className="mono muted">
                  {delta != null && <span>{fmtDelta(delta)} · </span>}
                  {latest ? (ageDays === 0 ? "today" : ageDays === 1 ? "1d ago" : `${ageDays}d ago`) : "no data"}
                </div>
              </div>
              <div className="wealth-account-spark">
                {series.length > 1 && (
                  <Sparkline values={series.map(s => s.balance).map((b, _, arr) => {
                    const lo = Math.min(...arr), hi = Math.max(...arr);
                    return hi === lo ? 0.5 : (b - lo) / (hi - lo);
                  })} w={140} h={28} fluid />
                )}
              </div>
              <button type="button" className="wealth-account-rm" onClick={() => remove(a.id)}>Remove</button>
            </div>
          );
        })}
      </div>
      {adding ? (
        <div className="wealth-add-form">
          <input type="text" placeholder="Account name" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <input type="text" placeholder="Institution (optional)" value={institution} onChange={e => setInstitution(e.target.value)} />
          <select value={kind} onChange={e => setKind(e.target.value)}>
            <option value="brokerage">brokerage</option>
            <option value="retirement">retirement</option>
            <option value="cash">cash</option>
            <option value="debt">debt</option>
            <option value="other">other</option>
          </select>
          <button type="button" className="save" disabled={!name.trim()} onClick={submit}>Add</button>
          <button type="button" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : (
        <button type="button" className="commit-add" onClick={() => setAdding(true)}>+ Add an account</button>
      )}
    </div>
  );
}

function GoalsList({ goals, netNow, onMutate }) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="wealth-goals">
      <div className="section-head">
        <div>
          <div className="eyebrow">Goals</div>
          <h2>What net worth is in service of</h2>
        </div>
        <div className="note">Progress is your current net worth against the target. Add a deadline to see months remaining.</div>
      </div>
      {goals.length === 0 && !adding && (
        <div className="wealth-empty">No goals yet. The first one usually anchors the rest.</div>
      )}
      <div className="wealth-goals-list">
        {goals.map(g => <GoalCard key={g.id} goal={g} netNow={netNow} onMutate={onMutate} />)}
      </div>
      {adding ? (
        <GoalForm onCancel={() => setAdding(false)} onSaved={async () => { setAdding(false); await onMutate(); }} />
      ) : (
        <button type="button" className="commit-add" onClick={() => setAdding(true)}>+ Add a goal</button>
      )}
    </div>
  );
}

function GoalCard({ goal, netNow, onMutate }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return <GoalForm initial={goal} onCancel={() => setEditing(false)}
                     onSaved={async () => { setEditing(false); await onMutate(); }}
                     onDelete={async () => {
                       if (!confirm("Delete this goal?")) return;
                       try { await api(`/api/wealth/goals/${goal.id}`, { method: "DELETE" }); await onMutate(); }
                       catch (e) { console.error(e); }
                     }} />;
  }
  const pct = (netNow != null && goal.target_amount > 0)
    ? Math.max(0, Math.min(100, (netNow / goal.target_amount) * 100))
    : 0;
  const remaining = (netNow != null) ? (goal.target_amount - netNow) : goal.target_amount;
  const daysLeft = goal.deadline ? daysBetween(todayISO(), goal.deadline) : null;
  return (
    <div className="wealth-goal" onClick={() => setEditing(true)}>
      <div className="wealth-goal-head">
        <div className="serif wealth-goal-title">{goal.title}</div>
        <div className="mono muted">{fmtUSD(goal.target_amount)}{goal.deadline ? ` · by ${goal.deadline}` : ""}</div>
      </div>
      <div className="bar"><i style={{ width: pct + "%" }} /></div>
      <div className="wealth-goal-meta mono">
        <span>{netNow != null ? fmtUSD(netNow) : "—"} of {fmtUSD(goal.target_amount)}</span>
        <span>{pct.toFixed(0)}%</span>
        <span>{remaining > 0 ? `${fmtUSD(remaining)} to go` : "reached"}</span>
        {daysLeft != null && <span>{daysLeft >= 0 ? `${daysLeft}d left` : `${-daysLeft}d past`}</span>}
      </div>
      {goal.notes && <div className="wealth-goal-notes">{goal.notes}</div>}
    </div>
  );
}

function GoalForm({ initial = {}, onSaved, onCancel, onDelete }) {
  const [title, setTitle] = useState(initial.title || "");
  const [target, setTarget] = useState(initial.target_amount != null ? String(initial.target_amount) : "");
  const [deadline, setDeadline] = useState(initial.deadline || "");
  const [notes, setNotes] = useState(initial.notes || "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const tgt = Number(String(target).replace(/[, $]/g, ""));
    if (!title.trim() || !Number.isFinite(tgt)) return;
    setBusy(true);
    try {
      const path = initial.id ? `/api/wealth/goals/${initial.id}` : `/api/wealth/goals`;
      const method = initial.id ? "PATCH" : "POST";
      await api(path, { method, body: JSON.stringify({ title: title.trim(), target_amount: tgt, deadline: deadline || null, notes }) });
      await onSaved();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  return (
    <div className="wealth-goal-form" onClick={e => e.stopPropagation()}>
      <input type="text" placeholder="Goal title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <input type="text" inputMode="decimal" placeholder="Target $" value={target} onChange={e => setTarget(e.target.value)} />
      <input type="date" value={deadline || ""} onChange={e => setDeadline(e.target.value)} />
      <input type="text" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="actions">
        <button type="button" className="save" disabled={busy || !title.trim() || !target} onClick={submit}>
          {initial.id ? "Save" : "Add"}
        </button>
        <button type="button" onClick={onCancel}>Cancel</button>
        {onDelete && <button type="button" className="danger" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  );
}

function WealthPage() {
  const [accounts, setAccounts] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadAll = async () => {
    try {
      const [a, s, g] = await Promise.all([
        api(`/api/wealth/accounts`),
        api(`/api/wealth/snapshots?days=365`),
        api(`/api/wealth/goals`),
      ]);
      setAccounts(a.accounts);
      setSnapshots(s.snapshots);
      setGoals(g.goals);
      setLoaded(true);
    } catch (e) {
      if (e.status === 401) window.location.reload();
    }
  };
  useEffect(() => { loadAll(); }, []);

  const byAccount = useMemo(() => groupSnapshots(snapshots), [snapshots]);
  const netNow = useMemo(() => netWorthAt(byAccount, todayISO()), [byAccount]);

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand">
          <button type="button" className="back-btn" onClick={() => go("")} aria-label="Back to dashboard">←</button>
          <div className="brand-mark">L</div>
          <div>
            <div className="brand-name">Wealth <span className="brand-sub">/ pillar</span></div>
          </div>
        </div>
        <div className="topbar-meta">
          <span><b>{todayStr().wd}</b> · {todayStr().date}</span>
        </div>
      </div>

      <section className="identity">
        <div className="eyebrow">§ II · Wealth</div>
        <div className="identity-grid">
          <div>
            <h1>I save before I spend.<br/>I build assets before lifestyle.</h1>
            <div className="vow">Net worth is the receipt of decisions made earlier. Tend it daily; let it compound.</div>
          </div>
          {loaded && <WealthHero accounts={accounts} byAccount={byAccount} />}
        </div>
      </section>

      {loaded ? (
        <>
          <section className="block">
            <UpdateToday accounts={accounts} byAccount={byAccount} onSaved={loadAll} />
          </section>
          <section className="block">
            <AccountsList accounts={accounts} byAccount={byAccount} onAdd={loadAll} onMutate={loadAll} />
          </section>
          <section className="block" style={{ borderBottom: 0 }}>
            <GoalsList goals={goals} netNow={netNow} onMutate={loadAll} />
          </section>
        </>
      ) : (
        <section className="block"><div className="muted mono">Loading…</div></section>
      )}
    </div>
  );
}

// ---------- Generic pillars (Body / Craft / Father / Mind / Spirit) ----------
// Pillar metadata shown at the top of each pillar page — the identity line
// and the question this pillar exists to answer. Edit freely; nothing persists from here.
const PILLAR_META = {
  health: {
    name: "Body", section: "§ I", glyph: "❶",
    identity: "I am the steward of this body;\nit will carry me to the end.",
    vow: "The body is the vehicle. Train it, feed it, rest it. Treat it like equipment you will need for forty more years."
  },
  work: {
    name: "Craft", section: "§ III", glyph: "❸",
    identity: "I ship what I start.\nDone compounds; perfect doesn't.",
    vow: "The craft is the proof. Deep work is the only currency that compounds — protect the hours, ship the work, judge yourself by what's in production."
  },
  father: {
    name: "Father", section: "§ IV", glyph: "❹",
    identity: "I am present.\nThe phone is down when they walk in.",
    vow: "Presence is the only gift that can't be replaced later. Be where your feet are. The years are short and they're watching."
  },
  mind: {
    name: "Mind", section: "§ V", glyph: "❺",
    identity: "I evolve in AI by\nbuilding one small thing a week.",
    vow: "The field is moving. Stay close to the work — read, build, ship. The cure for being behind is making something."
  },
  spirit: {
    name: "Spirit", section: "§ VI", glyph: "❻",
    identity: "Do the work; release the fruit.\nThe doer is not me.",
    vow: "The Gītā is the anchor. Sit daily. Read a verse. The aim is not enlightenment — it is to stop being yanked around by every passing storm."
  },
};

// Curated suggestions per pillar. These are the "Claude recommends" library —
// stable defaults the user can adopt with one click. Edit the goals/trackers
// over time; this list is just a starting point, not a constraint.
const SUGGESTIONS = {
  health: {
    trackers: [
      { title: "Weight",            unit: "kg",   direction: "down", target: 78, why: "The honest weekly signal. Weigh at the same time, same conditions." },
      { title: "Workouts this week", unit: "count", direction: "up",  target: 5,  why: "Five is the lift-or-run habit. Less than three and the body forgets." },
      { title: "Sleep",             unit: "hrs",  direction: "up",   target: 7.5, why: "Sleep is the multiplier on every other input. Track it and you'll defend it." },
      { title: "Resting heart rate", unit: "bpm", direction: "down", target: 60, why: "Trending RHR is a truer fitness signal than any single workout." },
    ],
    goals: [
      { title: "5K under 24:00",       target_value: 24,   target_unit: "min",    deadline: "2026-12-31", notes: "Time-trial monthly." },
      { title: "78kg lean",            target_value: 78,   target_unit: "kg",     deadline: "2026-09-30", notes: "Slow drop — 0.5kg/wk max." },
      { title: "Resting HR below 60",  target_value: 60,   target_unit: "bpm",    deadline: "2026-12-31", notes: "Morning, pre-coffee, supine." },
    ],
  },
  work: {
    trackers: [
      { title: "Deep work hours",       unit: "hrs",   direction: "up", target: 4, why: "The single highest-leverage number on this page. Defend the morning block." },
      { title: "PRs shipped this week", unit: "count", direction: "up", target: 5, why: "Output, not input. Five small PRs beat one giant one." },
      { title: "Code reviews done",     unit: "count", direction: "up", target: 3, why: "Reviewing is teaching is leadership. The Staff-level signal." },
    ],
    goals: [
      { title: "Promotion to Staff",            target_value: null, target_unit: "",        deadline: "2026-12-31", notes: "Build the packet quarterly. Show, don't tell." },
      { title: "Ship 40 AI prototypes in 2026", target_value: 40,   target_unit: "shipped", deadline: "2026-12-31", notes: "One per week, minimum. Publish all of them." },
      { title: "4-hour daily deep-work avg",    target_value: 4,    target_unit: "hrs/day", deadline: "2026-12-31", notes: "Calendar block 09-13. Phone in drawer." },
    ],
  },
  father: {
    trackers: [
      { title: "1:1 time with my child",    unit: "min",  direction: "up", target: 60, why: "Dedicated, undistracted minutes. The only number that matters here." },
      { title: "Bedtime hit (1=yes, 0=no)", unit: "y/n",  direction: "up", target: 1,  why: "Binary, brutal, honest. You either showed up or you didn't." },
      { title: "Phone-down dinners",        unit: "/wk",  direction: "up", target: 7,  why: "Dinner is the daily ritual. Phone in the other room, every time." },
    ],
    goals: [
      { title: "Zero missed bedtimes this quarter", target_value: 0,    target_unit: "missed", deadline: "2026-06-30", notes: "Re-evaluate quarterly. One missed = recovery plan." },
      { title: "Weekly date with partner",          target_value: 1,    target_unit: "/wk",    deadline: "2026-12-31", notes: "Out of the house. Pre-booked Friday." },
      { title: "One trip with each child in 2026",  target_value: null, target_unit: "",        deadline: "2026-12-31", notes: "Just us. Even a one-night camp counts." },
    ],
  },
  mind: {
    trackers: [
      { title: "Reading time",         unit: "min",   direction: "up", target: 30, why: "The compounding input. 30 minutes daily becomes a book a month." },
      { title: "Papers read this week", unit: "count", direction: "up", target: 1, why: "One paper a week is two-a-month is fluency in a year." },
      { title: "Prototypes shipped",   unit: "/wk",   direction: "up", target: 1, why: "Building is learning. One small shipped thing per week, no exceptions." },
    ],
    goals: [
      { title: "Read 12 books in 2026",    target_value: 12,   target_unit: "books",    deadline: "2026-12-31", notes: "Mix of technical, philosophy, history." },
      { title: "Ship 40 AI prototypes",    target_value: 40,   target_unit: "shipped",  deadline: "2026-12-31", notes: "Public repo. Demo video on each." },
      { title: "Write one essay per month", target_value: 12,  target_unit: "essays",   deadline: "2026-12-31", notes: "Long-form. Synthesis is the test of understanding." },
    ],
  },
  spirit: {
    trackers: [
      { title: "Meditation",            unit: "min",  direction: "up", target: 20, why: "The non-negotiable. Same time, same seat. Even five counts." },
      { title: "Gītā verses read",      unit: "count", direction: "up", target: 1, why: "One verse, slowly, with the commentary. The whole text takes a year at this pace." },
      { title: "Journal entries this week", unit: "count", direction: "up", target: 7, why: "Daily. Three lines is plenty. The point is the looking back, not the writing." },
    ],
    goals: [
      { title: "Complete the Gītā with commentary", target_value: 18,   target_unit: "chapters", deadline: "2026-09-30", notes: "Chapter every two weeks. Notes in the margins." },
      { title: "Sit 365 days in 2026",              target_value: 365,  target_unit: "days",     deadline: "2026-12-31", notes: "Any length. The streak is the practice." },
      { title: "One silent retreat",                target_value: null, target_unit: "",          deadline: "2026-12-31", notes: "Three days minimum. Vipassana or local equivalent." },
    ],
  },
};

// Latest log per tracker (helper for the hero + cards).
function latestLog(logs, trackerId) {
  let latest = null;
  for (const l of logs) {
    if (l.tracker_id !== trackerId) continue;
    if (!latest || l.date > latest.date) latest = l;
  }
  return latest;
}

function PillarHero({ trackers, logs }) {
  // Hero metric = first tracker with any logged data; else the first tracker.
  const tWithData = trackers.find(t => latestLog(logs, t.id)) || trackers[0];
  if (!tWithData) {
    return (
      <div className="wealth-hero">
        <div className="eyebrow">No trackers yet</div>
        <div className="wealth-now muted">—</div>
        <div className="counsel-meta mono">Add a tracker below — or adopt one from the suggestions.</div>
      </div>
    );
  }
  const latest = latestLog(logs, tWithData.id);
  const series = logs.filter(l => l.tracker_id === tWithData.id).sort((a, b) => a.date.localeCompare(b.date));
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const delta = (latest && prev) ? latest.value - prev.value : null;
  const deltaGood = (delta == null) ? null
                  : tWithData.direction === "down" ? (delta <= 0) : (delta >= 0);
  return (
    <div className="wealth-hero">
      <div className="eyebrow">{tWithData.title}{tWithData.unit ? ` · ${tWithData.unit}` : ""}</div>
      <div className="wealth-now">{latest ? latest.value : "—"}</div>
      <div className="wealth-deltas">
        <div><span className="lbl mono">last</span><span className="v mono">{latest ? latest.date.slice(5) : "—"}</span></div>
        <div><span className="lbl mono">Δ</span><span className="v mono" style={deltaGood === false ? { color: "var(--accent)" } : undefined}>{delta == null ? "—" : (delta > 0 ? "+" : "") + delta.toFixed(2)}</span></div>
        <div><span className="lbl mono">target</span><span className="v mono">{tWithData.target ?? "—"}</span></div>
        <div><span className="lbl mono">trend</span><span className="v mono">{tWithData.direction === "down" ? "↓ better" : "↑ better"}</span></div>
      </div>
    </div>
  );
}

function LogToday({ pillarId, trackers, logs, onSaved }) {
  const today = todayISO();
  const initial = useMemo(() => {
    const out = {};
    for (const t of trackers) {
      const todayRow = logs.find(l => l.tracker_id === t.id && l.date === today);
      out[t.id] = todayRow != null ? String(todayRow.value) : "";
    }
    return out;
  }, [trackers, logs, today]);

  const [vals, setVals] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  useEffect(() => { setVals(initial); }, [initial]);

  const set = (id) => (e) => setVals(v => ({ ...v, [id]: e.target.value }));

  const save = async () => {
    setSaving(true);
    const values = {};
    for (const t of trackers) {
      const raw = (vals[t.id] || "").toString().trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      values[t.id] = n;
    }
    try {
      await api(`/api/pillars/${pillarId}/logs`, { method: "PUT", body: JSON.stringify({ date: today, values }) });
      setSavedAt(new Date());
      await onSaved();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (!trackers.length) return null;

  return (
    <div className="wealth-update">
      <div className="section-head">
        <div>
          <div className="eyebrow">Log today · {today}</div>
          <h2>The day's numbers</h2>
        </div>
        <div className="note">Empty fields are skipped. One log per tracker per day; re-saving overwrites.</div>
      </div>
      <div className="wealth-update-grid">
        {trackers.map(t => (
          <label key={t.id} className="wealth-update-row">
            <div className="wealth-update-name">
              <div className="serif">{t.title}</div>
              <div className="mono muted">{t.unit || "value"} · target {t.target ?? "—"} · {t.direction === "down" ? "↓ better" : "↑ better"}</div>
            </div>
            <div className="wealth-update-input">
              <input type="text" inputMode="decimal" value={vals[t.id] ?? ""} onChange={set(t.id)} placeholder="0" />
              {t.unit && <span className="mono">{t.unit}</span>}
            </div>
          </label>
        ))}
      </div>
      <div className="wealth-update-foot">
        <button type="button" className="wealth-save" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save today's log"}
        </button>
        {savedAt && <span className="mono muted">saved · {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
    </div>
  );
}

function TrackerCard({ tracker, logs, onMutate, pillarId }) {
  const [editing, setEditing] = useState(false);
  const series = useMemo(() =>
    logs.filter(l => l.tracker_id === tracker.id).sort((a, b) => a.date.localeCompare(b.date)),
  [logs, tracker.id]);
  const latest = series.length ? series[series.length - 1] : null;
  const prev   = series.length > 1 ? series[series.length - 2] : null;
  const delta  = (latest && prev) ? latest.value - prev.value : null;

  const remove = async () => {
    if (!confirm(`Remove "${tracker.title}"? Logged values stay in the DB.`)) return;
    try { await api(`/api/pillars/${pillarId}/trackers/${tracker.id}`, { method: "DELETE" }); await onMutate(); }
    catch (e) { console.error(e); }
  };

  if (editing) {
    return (
      <TrackerForm
        pillarId={pillarId}
        initial={tracker}
        onCancel={() => setEditing(false)}
        onSaved={async () => { setEditing(false); await onMutate(); }}
      />
    );
  }

  return (
    <div className="wealth-account">
      <div onClick={() => setEditing(true)} style={{ cursor: "pointer" }}>
        <div className="serif wealth-account-name">{tracker.title}</div>
        <div className="mono muted">{tracker.unit || "value"} · {tracker.direction === "down" ? "↓ better" : "↑ better"}{tracker.target != null ? ` · target ${tracker.target}` : ""}</div>
      </div>
      <div className="wealth-account-bal">
        <div className="serif">{latest ? latest.value : "—"}</div>
        <div className="mono muted">
          {delta != null && <span>{(delta > 0 ? "+" : "") + delta.toFixed(2)} · </span>}
          {latest ? latest.date.slice(5) : "no data"}
        </div>
      </div>
      <div className="wealth-account-spark">
        {series.length > 1 && (
          <Sparkline values={series.map(s => s.value).map((v, _, arr) => {
            const lo = Math.min(...arr), hi = Math.max(...arr);
            return hi === lo ? 0.5 : (v - lo) / (hi - lo);
          })} w={140} h={28} fluid />
        )}
      </div>
      <button type="button" className="wealth-account-rm" onClick={remove}>Remove</button>
    </div>
  );
}

function TrackerForm({ pillarId, initial = {}, onCancel, onSaved }) {
  const [title, setTitle] = useState(initial.title || "");
  const [unit, setUnit] = useState(initial.unit || "");
  const [direction, setDirection] = useState(initial.direction || "up");
  const [target, setTarget] = useState(initial.target != null ? String(initial.target) : "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const path = initial.id ? `/api/pillars/${pillarId}/trackers/${initial.id}` : `/api/pillars/${pillarId}/trackers`;
      const method = initial.id ? "PATCH" : "POST";
      const body = { title: title.trim(), unit: unit.trim(), direction, target: target === "" ? null : Number(target) };
      await api(path, { method, body: JSON.stringify(body) });
      await onSaved();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  return (
    <div className="wealth-add-form">
      <input type="text" placeholder="Tracker title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <input type="text" placeholder="unit (kg, min, count…)" value={unit} onChange={e => setUnit(e.target.value)} />
      <select value={direction} onChange={e => setDirection(e.target.value)}>
        <option value="up">↑ higher better</option>
        <option value="down">↓ lower better</option>
      </select>
      <input type="text" inputMode="decimal" placeholder="target (optional)" value={target} onChange={e => setTarget(e.target.value)} />
      <button type="button" className="save" disabled={busy || !title.trim()} onClick={submit}>{initial.id ? "Save" : "Add"}</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </div>
  );
}

function PillarGoalCard({ goal, latestByTracker, trackers, pillarId, onMutate }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <PillarGoalForm pillarId={pillarId} initial={goal}
                      onCancel={() => setEditing(false)}
                      onSaved={async () => { setEditing(false); await onMutate(); }}
                      onDelete={async () => {
                        if (!confirm("Delete this goal?")) return;
                        try { await api(`/api/pillars/${pillarId}/goals/${goal.id}`, { method: "DELETE" }); await onMutate(); }
                        catch (e) { console.error(e); }
                      }} />
    );
  }
  // Try to compute progress from a matching tracker (same unit).
  const tracker = trackers.find(t => goal.target_unit && t.unit === goal.target_unit);
  let pct = 0, currentText = null;
  if (tracker && goal.target_value != null) {
    const cur = latestByTracker[tracker.id];
    if (cur != null) {
      const target = goal.target_value;
      if (tracker.direction === "down") {
        const start = Math.max(cur, target * 1.4);
        pct = Math.max(0, Math.min(100, ((start - cur) / (start - target)) * 100));
      } else {
        pct = Math.max(0, Math.min(100, (cur / target) * 100));
      }
      currentText = `${cur} ${tracker.unit} now · target ${target} ${tracker.unit}`;
    }
  }
  const daysLeft = goal.deadline ? daysBetween(todayISO(), goal.deadline) : null;
  return (
    <div className="wealth-goal" onClick={() => setEditing(true)}>
      <div className="wealth-goal-head">
        <div className="serif wealth-goal-title">{goal.title}</div>
        <div className="mono muted">
          {goal.target_value != null ? `${goal.target_value}${goal.target_unit ? " " + goal.target_unit : ""}` : "milestone"}
          {goal.deadline ? ` · by ${goal.deadline}` : ""}
        </div>
      </div>
      {tracker && goal.target_value != null && (
        <>
          <div className="bar"><i style={{ width: pct + "%" }} /></div>
          <div className="wealth-goal-meta mono">
            {currentText && <span>{currentText}</span>}
            <span>{pct.toFixed(0)}%</span>
            {daysLeft != null && <span>{daysLeft >= 0 ? `${daysLeft}d left` : `${-daysLeft}d past`}</span>}
          </div>
        </>
      )}
      {(!tracker || goal.target_value == null) && daysLeft != null && (
        <div className="wealth-goal-meta mono"><span>{daysLeft >= 0 ? `${daysLeft}d left` : `${-daysLeft}d past`}</span></div>
      )}
      {goal.notes && <div className="wealth-goal-notes">{goal.notes}</div>}
    </div>
  );
}

function PillarGoalForm({ pillarId, initial = {}, onSaved, onCancel, onDelete }) {
  const [title, setTitle] = useState(initial.title || "");
  const [targetValue, setTargetValue] = useState(initial.target_value != null ? String(initial.target_value) : "");
  const [targetUnit, setTargetUnit] = useState(initial.target_unit || "");
  const [deadline, setDeadline] = useState(initial.deadline || "");
  const [notes, setNotes] = useState(initial.notes || "");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const path = initial.id ? `/api/pillars/${pillarId}/goals/${initial.id}` : `/api/pillars/${pillarId}/goals`;
      const method = initial.id ? "PATCH" : "POST";
      const body = {
        title: title.trim(),
        target_value: targetValue === "" ? null : Number(targetValue),
        target_unit: targetUnit.trim(),
        deadline: deadline || null,
        notes,
      };
      await api(path, { method, body: JSON.stringify(body) });
      await onSaved();
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  };

  return (
    <div className="wealth-goal-form" onClick={e => e.stopPropagation()}>
      <input type="text" placeholder="Goal title" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <input type="text" inputMode="decimal" placeholder="Target (optional)" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
      <input type="text" placeholder="Unit (optional)" value={targetUnit} onChange={e => setTargetUnit(e.target.value)} />
      <input type="date" value={deadline || ""} onChange={e => setDeadline(e.target.value)} />
      <input type="text" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="actions">
        <button type="button" className="save" disabled={busy || !title.trim()} onClick={submit}>{initial.id ? "Save" : "Add"}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
        {onDelete && <button type="button" className="danger" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  );
}

function Suggestions({ pillarId, trackers, goals, onMutate }) {
  const sug = SUGGESTIONS[pillarId];
  if (!sug) return null;
  const existingTrackerTitles = new Set(trackers.map(t => t.title.toLowerCase()));
  const existingGoalTitles = new Set(goals.map(g => g.title.toLowerCase()));
  const tSug = sug.trackers.filter(s => !existingTrackerTitles.has(s.title.toLowerCase()));
  const gSug = sug.goals.filter(s => !existingGoalTitles.has(s.title.toLowerCase()));
  if (!tSug.length && !gSug.length) return null;

  const adoptTracker = async (s) => {
    try {
      await api(`/api/pillars/${pillarId}/trackers`, { method: "POST",
        body: JSON.stringify({ title: s.title, unit: s.unit, direction: s.direction, target: s.target }) });
      await onMutate();
    } catch (e) { console.error(e); }
  };
  const adoptGoal = async (s) => {
    try {
      await api(`/api/pillars/${pillarId}/goals`, { method: "POST",
        body: JSON.stringify({ title: s.title, target_value: s.target_value, target_unit: s.target_unit, deadline: s.deadline, notes: s.notes }) });
      await onMutate();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="suggestions">
      <div className="section-head">
        <div>
          <div className="eyebrow">Suggested · curated</div>
          <h2>What I'd recommend tracking here</h2>
        </div>
        <div className="note">Click <em>Use this</em> to adopt — you can edit or remove after. Already-added items are hidden.</div>
      </div>
      {tSug.length > 0 && (
        <>
          <div className="suggestions-sub mono">Trackers</div>
          <div className="suggestions-list">
            {tSug.map((s, i) => (
              <div className="suggestion" key={"t" + i}>
                <div>
                  <div className="serif suggestion-title">{s.title}
                    <span className="mono muted"> · {s.unit} · target {s.target ?? "—"} · {s.direction === "down" ? "↓" : "↑"}</span>
                  </div>
                  <div className="suggestion-why">{s.why}</div>
                </div>
                <button type="button" className="use-btn" onClick={() => adoptTracker(s)}>Use this</button>
              </div>
            ))}
          </div>
        </>
      )}
      {gSug.length > 0 && (
        <>
          <div className="suggestions-sub mono">Goals</div>
          <div className="suggestions-list">
            {gSug.map((s, i) => (
              <div className="suggestion" key={"g" + i}>
                <div>
                  <div className="serif suggestion-title">{s.title}
                    <span className="mono muted"> · {s.target_value != null ? `${s.target_value} ${s.target_unit}` : "milestone"}{s.deadline ? ` · by ${s.deadline}` : ""}</span>
                  </div>
                  <div className="suggestion-why">{s.notes}</div>
                </div>
                <button type="button" className="use-btn" onClick={() => adoptGoal(s)}>Use this</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PillarPage({ pillarId }) {
  const meta = PILLAR_META[pillarId];
  const [trackers, setTrackers] = useState([]);
  const [goals, setGoals] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [addingTracker, setAddingTracker] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);

  const loadAll = async () => {
    try {
      const j = await api(`/api/pillars/${pillarId}?days=180`);
      setTrackers(j.trackers);
      setGoals(j.goals);
      setLogs(j.logs);
      setLoaded(true);
    } catch (e) {
      if (e.status === 401) window.location.reload();
    }
  };
  useEffect(() => { loadAll(); }, [pillarId]);

  const latestByTracker = useMemo(() => {
    const out = {};
    for (const t of trackers) {
      const l = latestLog(logs, t.id);
      if (l) out[t.id] = l.value;
    }
    return out;
  }, [trackers, logs]);

  if (!meta) {
    return <div className="page"><section className="block"><div className="muted">Unknown pillar.</div></section></div>;
  }

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand">
          <button type="button" className="back-btn" onClick={() => go("")} aria-label="Back to dashboard">←</button>
          <div className="brand-mark">L</div>
          <div>
            <div className="brand-name">{meta.name} <span className="brand-sub">/ pillar</span></div>
          </div>
        </div>
        <div className="topbar-meta">
          <span><b>{todayStr().wd}</b> · {todayStr().date}</span>
        </div>
      </div>

      <section className="identity">
        <div className="eyebrow">{meta.section} · {meta.name}</div>
        <div className="identity-grid">
          <div>
            <h1 style={{ whiteSpace: "pre-line" }}>{meta.identity}</h1>
            <div className="vow">{meta.vow}</div>
          </div>
          {loaded && <PillarHero trackers={trackers} logs={logs} />}
        </div>
      </section>

      {loaded ? (
        <>
          <section className="block">
            <LogToday pillarId={pillarId} trackers={trackers} logs={logs} onSaved={loadAll} />
          </section>

          <section className="block">
            <div className="section-head">
              <div>
                <div className="eyebrow">Trackers</div>
                <h2>What gets measured here</h2>
              </div>
            </div>
            <div className="wealth-accounts-list">
              {trackers.map(t => <TrackerCard key={t.id} tracker={t} logs={logs} pillarId={pillarId} onMutate={loadAll} />)}
            </div>
            {addingTracker ? (
              <TrackerForm pillarId={pillarId}
                           onCancel={() => setAddingTracker(false)}
                           onSaved={async () => { setAddingTracker(false); await loadAll(); }} />
            ) : (
              <button type="button" className="commit-add" onClick={() => setAddingTracker(true)}>+ Add a tracker</button>
            )}
          </section>

          <section className="block">
            <div className="section-head">
              <div>
                <div className="eyebrow">Goals</div>
                <h2>What this pillar is in service of</h2>
              </div>
              <div className="note">Goals with a unit that matches a tracker auto-compute progress from your latest log.</div>
            </div>
            {goals.length === 0 && !addingGoal && (
              <div className="wealth-empty">No goals yet — try one from the suggestions below.</div>
            )}
            <div className="wealth-goals-list">
              {goals.map(g => (
                <PillarGoalCard key={g.id} goal={g} trackers={trackers} latestByTracker={latestByTracker}
                                pillarId={pillarId} onMutate={loadAll} />
              ))}
            </div>
            {addingGoal ? (
              <PillarGoalForm pillarId={pillarId}
                              onCancel={() => setAddingGoal(false)}
                              onSaved={async () => { setAddingGoal(false); await loadAll(); }} />
            ) : (
              <button type="button" className="commit-add" onClick={() => setAddingGoal(true)}>+ Add a goal</button>
            )}
          </section>

          <section className="block" style={{ borderBottom: 0 }}>
            <Suggestions pillarId={pillarId} trackers={trackers} goals={goals} onMutate={loadAll} />
          </section>
        </>
      ) : (
        <section className="block"><div className="muted mono">Loading…</div></section>
      )}
    </div>
  );
}

// ---------- Counsel ----------
// The verse, posed as a question for the morning. Hardcoded against the current
// verse (2.47). If/when verses rotate, lift this to the DB alongside the verse row.
const VERSE_QUESTION = "Where today will you act, and let the fruit go?";

// Loads /api/journal once for `date` and gives debounced PUT-on-change for any subset of fields.
// `fields` = subset of ["obstacle", "line1", "line2", "line3"]. Renders nothing if empty.
function useJournalField(date) {
  const [vals, setVals] = useState({ obstacle: "", line1: "", line2: "", line3: "" });
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/api/journal?date=${date}`).then(j => {
      if (cancelled) return;
      setVals({ obstacle: j.obstacle || "", line1: j.line1 || "", line2: j.line2 || "", line3: j.line3 || "" });
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, [date]);

  useEffect(() => {
    if (!loaded || !dirty) return;
    const id = setTimeout(() => {
      api(`/api/journal`, { method: "PUT", body: JSON.stringify({ date, ...vals }) })
        .then(() => { setSavedAt(new Date()); setDirty(false); })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(id);
  }, [vals, loaded, dirty, date]);

  const set = (k) => (e) => { setVals(v => ({ ...v, [k]: e.target.value })); setDirty(true); };
  return { vals, loaded, savedAt, set };
}

// The three stoic evening questions. These replace the prior generic prompts —
// chosen to map Seneca's evening review (control / disturbance / next-day promise).
const EVENING_QUESTIONS = [
  { k: "line1", q: "What did I control well today?" },
  { k: "line2", q: "What pulled me off?" },
  { k: "line3", q: "Tomorrow's one stone — the action that makes the rest easier." },
];

function Counsel({ commitments, commitmentsLoaded, toggle }) {
  const mode = useDayMode();
  const stone = nextStone(commitments);
  const done = commitments.filter(c => c.done).length;
  const total = commitments.length;
  const allKept = commitmentsLoaded && total > 0 && done === total;
  const date = todayISO();
  const journal = useJournalField(date);

  const eyebrow = mode === "morning" ? "Begin here."
                : mode === "evening" ? "Close the day."
                : "The next stone.";

  return (
    <section className="counsel" data-mode={mode}>
      <div className="counsel-head">
        <div className="eyebrow">{eyebrow}</div>
        <div className="counsel-meta mono">
          {mode === "morning" && "before noon"}
          {mode === "day" && `${done}/${total || 8} kept so far`}
          {mode === "evening" && `${done}/${total || 8} kept · sit with the day`}
        </div>
      </div>

      {mode !== "evening" && (
        <div className="counsel-stone">
          {stone ? (
            <button type="button" className="counsel-stone-btn" onClick={() => toggle(stone.id)}>
              <div className="counsel-stone-time mono">{stone.trigger ? `${stone.time} · ${stone.trigger}` : stone.time}</div>
              <div className="counsel-stone-text serif">{stone.text}</div>
              <div className="counsel-stone-domain mono">{stone.domain}</div>
              {stone.tiny_text && <div className="counsel-stone-tiny">If hard: {stone.tiny_text}</div>}
            </button>
          ) : allKept ? (
            <div className="counsel-stone-text serif">All eight stones placed. The day is yours to spend, not to spend itself on you.</div>
          ) : (
            <div className="counsel-stone-text serif muted">Loading the day…</div>
          )}
        </div>
      )}

      {/* Morning: WOOP "mental contrasting" — what's likely to get in the way? */}
      {mode === "morning" && (
        <div className="counsel-obstacle">
          <label className="counsel-line">
            <span className="counsel-q">What is likely to get in the way today?</span>
            <textarea rows={2} value={journal.vals.obstacle}
              placeholder="Name it. Plan around it. (Oettingen: mental contrasting beats positive fantasy.)"
              onChange={journal.set("obstacle")} />
          </label>
          <div className="counsel-save">
            {journal.savedAt ? `saved · ${journal.savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : (journal.loaded ? "draft" : "loading…")}
          </div>
        </div>
      )}

      {/* Evening: the daily review IS the product (Seneca / Aurelius). */}
      {mode === "evening" && (
        <div className="counsel-evening">
          <div className="counsel-evening-questions">
            {EVENING_QUESTIONS.map(({ k, q }) => (
              <label className="counsel-line" key={k}>
                <span className="counsel-q">{q}</span>
                <textarea rows={2} value={journal.vals[k]} placeholder="…" onChange={journal.set(k)} />
              </label>
            ))}
          </div>
          <div className="counsel-save">
            {journal.savedAt ? `saved · ${journal.savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : (journal.loaded ? "draft" : "loading…")}
          </div>
        </div>
      )}

      <div className="counsel-verse">
        <span className="counsel-verse-q serif">{VERSE_QUESTION}</span>
        <span className="counsel-verse-ref mono">{VERSE.ref}</span>
      </div>
    </section>
  );
}

// ---------- Auth gate ----------
function AuthGate({ children }) {
  const [state, setState] = useState("checking"); // checking | locked | open | offline
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/me", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(j => setState(j.authenticated ? "open" : "locked"))
      .catch(() => setState("offline"));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!passcode || submitting) return;
    setSubmitting(true);
    setErr("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (r.ok) { setPasscode(""); setState("open"); return; }
      setErr(r.status === 401 ? "Wrong passcode." : `Error ${r.status}.`);
    } catch {
      setErr("Server unreachable.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "open") return children;

  return (
    <div className="auth-gate">
      <div className="auth-card">
        <div className="eyebrow">{state === "offline" ? "Server offline" : "Enter passcode"}</div>
        <h1>The day you don't track is the day you can <em>lie to yourself.</em></h1>
        <form onSubmit={submit}>
          <input
            type="password"
            autoFocus
            disabled={state !== "locked"}
            value={passcode}
            onChange={e => { setPasscode(e.target.value); setErr(""); }}
            placeholder="passcode"
            autoComplete="current-password"
          />
          <button type="submit" disabled={!passcode || submitting || state !== "locked"}>
            {submitting ? "Checking…" : "Enter"}
          </button>
          <div className="err">{err || (state === "offline" ? "Cannot reach the server. Refresh once it's running." : "")}</div>
        </form>
      </div>
    </div>
  );
}

// ---------- App ----------
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [commitments, setCommitments] = useState([]);
  const [commitmentsLoaded, setCommitmentsLoaded] = useState(false);

  // Apply theme & accent
  useEffect(() => {
    document.documentElement.classList.toggle("dark", t.theme === "dark");
    document.documentElement.style.setProperty("--accent", t.accent);
    // derive soft accent
    document.documentElement.style.setProperty("--accent-soft",
      t.theme === "dark" ? `color-mix(in oklch, ${t.accent} 35%, black)` : `color-mix(in oklch, ${t.accent} 22%, white)`);
  }, [t.theme, t.accent]);

  // 28-day momentum — replaces the streak counter (loss-aversion / what-the-hell effect).
  const [momentum, setMomentum] = useState(null);
  const refetchMomentum = async () => {
    try { setMomentum(await api(`/api/momentum?days=28`)); }
    catch (e) { if (e.status === 401) window.location.reload(); }
  };

  // Load today's commitments from the backend.
  const refetchCommitments = async () => {
    try {
      const j = await api(`/api/commitments?date=${todayISO()}`);
      setCommitments(j.commitments);
      setCommitmentsLoaded(true);
    } catch (e) {
      if (e.status === 401) window.location.reload();
    }
  };
  useEffect(() => { refetchCommitments(); refetchMomentum(); }, []);

  // Toggle: optimistic local update, then POST. Revert on failure.
  // done=true clears any prior skip server-side; we mirror that locally.
  const toggle = async (templateId) => {
    let prev;
    setCommitments(cs => {
      prev = cs;
      return cs.map(c => c.id === templateId ? { ...c, done: !c.done, skipped: false, skip_reason: "" } : c);
    });
    try {
      const j = await api(`/api/commitments/toggle`, {
        method: "POST",
        body: JSON.stringify({ date: todayISO(), template_id: templateId }),
      });
      setCommitments(cs => cs.map(c => c.id === templateId ? { ...c, done: j.done, skipped: j.skipped } : c));
      refetchMomentum();
    } catch (e) {
      if (prev) setCommitments(prev);
      if (e.status === 401) window.location.reload();
    }
  };

  // Skip with a one-line reason — asymmetric friction (Kahneman / defaults).
  const skip = async (templateId, reason) => {
    if (!reason || !reason.trim()) return;
    let prev;
    setCommitments(cs => {
      prev = cs;
      return cs.map(c => c.id === templateId ? { ...c, done: false, skipped: true, skip_reason: reason.trim() } : c);
    });
    try {
      await api(`/api/commitments/skip`, {
        method: "POST",
        body: JSON.stringify({ date: todayISO(), template_id: templateId, reason: reason.trim() }),
      });
      refetchMomentum();
    } catch (e) {
      if (prev) setCommitments(prev);
      if (e.status === 401) window.location.reload();
    }
  };

  const done = commitments.filter(c => c.done).length;
  const total = commitmentsLoaded ? commitments.length : 8; // keep vital tile stable while loading

  const route = useRoute();

  return (
    <>
      {route.name === "pillar" && route.params.id === "wealth" ? (
        <WealthPage />
      ) : route.name === "pillar" && PILLAR_META[route.params.id] ? (
        <PillarPage pillarId={route.params.id} />
      ) : route.name === "pillar" ? (
        <div className="page">
          <div className="topbar">
            <div className="brand">
              <button type="button" className="back-btn" onClick={() => go("")} aria-label="Back">←</button>
              <div className="brand-name">{route.params.id}</div>
            </div>
          </div>
          <section className="block" style={{ borderBottom: 0 }}>
            <div className="eyebrow">Pillar</div>
            <h2 className="serif" style={{ fontSize: 28, margin: "12px 0" }}>Unknown pillar</h2>
            <p className="muted">No pillar by that id.</p>
          </section>
        </div>
      ) : (
      <div className="page">
        <Topbar t={t} />
        <Counsel commitments={commitments} commitmentsLoaded={commitmentsLoaded} toggle={toggle} />
        <Identity t={t} done={done} total={total} momentum={momentum} />
        <Today commitments={commitments} toggle={toggle} skip={skip} onMutate={refetchCommitments} momentum={momentum} />
        <Momentum />
        <Cascade />
        <Domains focus={t.focus} />
        <Verse showSanskrit={t.showSanskrit} />
        <Review />
        <Footer />
      </div>
      )}

      <TweaksPanel>
        <TweakSection label="Atmosphere">
          <TweakRadio label="Theme" value={t.theme}
            options={["warm", "dark"]}
            onChange={(v) => setTweak("theme", v)} />
          <TweakColor label="Accent" value={t.accent}
            options={["#b25a2b", "#385a6e", "#5a6b3a", "#7a4a4a", "#2a2a2a"]}
            onChange={(v) => setTweak("accent", v)} />
        </TweakSection>
        <TweakSection label="Focus">
          <TweakSelect label="Today's domain" value={t.focus}
            options={[
              { value: "health", label: "Body" },
              { value: "wealth", label: "Wealth" },
              { value: "work",   label: "Craft" },
              { value: "father", label: "Father" },
              { value: "mind",   label: "Mind" },
              { value: "spirit", label: "Spirit" },
            ]}
            onChange={(v) => setTweak("focus", v)} />
          <TweakToggle label="Show Sanskrit verse" value={t.showSanskrit}
            onChange={(v) => setTweak("showSanskrit", v)} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthGate><App /></AuthGate>
);
