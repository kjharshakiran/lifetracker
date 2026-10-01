// Seed mock data from app.jsx into the SQLite DB on first run.
// Each section is independent: if its table is empty, seed it.

const DOMAINS = [
  { id: "health", glyph: "❶", name: "Body",   stmt: "I am the steward of this body; it will carry me to the end.",
    goal: "Run 5km in under 24:00 · 78kg lean", pct: 62, streak: 21, ritual: "Lift or run · Lights out 22:30" },
  { id: "wealth", glyph: "❷", name: "Wealth", stmt: "I save before I spend; I build assets before lifestyle.",
    goal: "12mo emergency fund · index DCA monthly", pct: 48, streak: 9, ritual: "Track spend · weekly review" },
  { id: "work",   glyph: "❸", name: "Craft",  stmt: "I ship what I start. Done compounds; perfect doesn't.",
    goal: "Deliver Q2 milestone · 4hr deep work / day", pct: 71, streak: 14, ritual: "Deep work block 09–13" },
  { id: "father", glyph: "❹", name: "Father", stmt: "I am present. The phone is down when they walk in.",
    goal: "1 dedicated hour with each child, daily", pct: 84, streak: 33, ritual: "Phone away 18–20 · bedtime story" },
  { id: "mind",   glyph: "❺", name: "Mind",   stmt: "I evolve in AI by building one small thing a week.",
    goal: "Ship 1 AI prototype/week · read 1 paper", pct: 55, streak: 7, ritual: "Build hour 21:00 · paper Sat" },
  { id: "spirit", glyph: "❻", name: "Spirit", stmt: "Do the work; release the fruit. The doer is not me.",
    goal: "Gita chapter daily · 20min meditation", pct: 39, streak: 12, ritual: "Read 1 verse · sit 20min" },
];

const CASCADE_SCOPES = [
  { key: "ultimate", scope: "Ultimate Aim · 5 years",
    text: "Become a man whose word is reliable — strong in body, free in finances, present as a father, deep in craft, anchored in dharma." },
  { key: "year", scope: "This Year · 2026",
    text: "Twelve months to compound: ship the AI side-craft, halve the debt, reclaim the body, never miss bedtime." },
  { key: "quarter", scope: "This Quarter · Q2",
    text: "The quarter is the unit of real work. Three priorities, nothing else gets a slot." },
  { key: "week", scope: "This Week",
    text: "Five workdays. One outcome per domain. The week is won on Wednesday." },
  { key: "today", scope: "Today",
    text: "What gets done today is the only honest evidence I have of who I am becoming." },
];

const CASCADE_ITEMS = {
  ultimate: [
    { tag: "becoming", txt: "The person my children would willingly model their life on.", pct: null },
    { tag: "refuse",   txt: "Refuse: cowardice, drift, performative effort, dishonest comfort.", pct: null },
    { tag: "evidence", txt: "Body, balance sheet, relationships and craft each visibly improving year over year.", pct: null },
    { tag: "north",    txt: "The aim is not arrival. The aim is the man the aim makes of me.", pct: null },
  ],
  year: [
    { tag: "body",   txt: "5km under 24:00 · resting HR under 60.", pct: 58 },
    { tag: "wealth", txt: "12-month runway saved · debts cleared by Q4.", pct: 41 },
    { tag: "craft",  txt: "Promotion to Staff · 40 AI prototypes shipped.", pct: 64 },
    { tag: "family", txt: "Weekly date with partner · zero missed bedtimes.", pct: 79 },
  ],
  quarter: [
    { tag: "p1",   txt: "Ship v1 of the AI life-tracker side project — public by June 30.", pct: 55 },
    { tag: "p2",   txt: "Drop 4kg, hold 5x/wk training, eat under 2200kcal weekdays.", pct: 47 },
    { tag: "p3",   txt: "Read Bhagavad Gita end-to-end with commentary; one chapter per week.", pct: 62 },
    { tag: "veto", txt: "Vetoed for the quarter: new courses, new gadgets, side gigs.", pct: null },
  ],
  week: [
    { tag: "mon", txt: "Deep work: ship onboarding flow draft.", pct: 100 },
    { tag: "tue", txt: "Long run · evening: chapter 3 of Gita with notes.", pct: 100 },
    { tag: "wed", txt: "Stand-up review with partner on finances · transfer to brokerage.", pct: 60 },
    { tag: "thu", txt: "Daughter's school recital — leave laptop at desk.", pct: 0 },
  ],
  today: [
    { tag: "first", txt: "Cold water · 20min sit · read one verse before I open the laptop.", pct: null },
    { tag: "deep",  txt: "09:00–13:00 deep work — phone in drawer, one tab.", pct: null },
    { tag: "move",  txt: "Train at 17:30 — pull day, 45 minutes, no scrolling between sets.", pct: null },
    { tag: "close", txt: "Phone away 18–20. Bedtime story. Journal 3 lines. Sleep 22:30.", pct: null },
  ],
};

const COMMITMENT_TEMPLATE = [
  { time: "05:30", domain: "Spirit", text: "Cold water, then 20-minute sit" },
  { time: "06:00", domain: "Spirit", text: "Read one verse of the Gita, write one line" },
  { time: "07:00", domain: "Body",   text: "Mobility · 6,000 steps before noon" },
  { time: "09:00", domain: "Craft",  text: "Deep work block — ship the onboarding draft" },
  { time: "13:00", domain: "Mind",   text: "30 min reading on AI agents · one short note" },
  { time: "17:30", domain: "Body",   text: "Train — pull day, 45 minutes" },
  { time: "18:00", domain: "Father", text: "Phone in drawer. Be where my feet are." },
  { time: "22:00", domain: "Wealth", text: "Log the day's spend. No exceptions." },
];

const ACCOUNTS = [
  { name: "Robinhood",  kind: "brokerage",  institution: "Robinhood" },
  { name: "NetBenefits", kind: "retirement", institution: "Fidelity NetBenefits" },
  { name: "Principal",  kind: "retirement", institution: "Principal" },
  { name: "Public",     kind: "brokerage",  institution: "Public" },
];

const DEFAULT_VERSE = {
  sanskrit: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि ॥",
  ref: "Bhagavad Gītā · 2.47",
  translation_pre: "You have a right to your ",
  translation_bold: "labour alone",
  translation_post: ", never to its fruits. Do not let the fruit be the motive of action, nor let your attachment be to inaction.",
};

function tableEmpty(db, name) {
  return db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get().c === 0;
}

function seedIfEmpty(db) {
  const tx = db.transaction(() => {
    if (tableEmpty(db, "domains")) {
      const ins = db.prepare(`INSERT INTO domains (id, glyph, name, stmt, goal, pct, streak, ritual, order_index)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      DOMAINS.forEach((d, i) => ins.run(d.id, d.glyph, d.name, d.stmt, d.goal, d.pct, d.streak, d.ritual, i));
    }

    if (tableEmpty(db, "cascade_scopes")) {
      const insScope = db.prepare(`INSERT INTO cascade_scopes (key, scope, text, order_index) VALUES (?, ?, ?, ?)`);
      const insItem  = db.prepare(`INSERT INTO cascade_items  (scope_key, tag, txt, pct, order_index) VALUES (?, ?, ?, ?, ?)`);
      CASCADE_SCOPES.forEach((s, i) => {
        insScope.run(s.key, s.scope, s.text, i);
        (CASCADE_ITEMS[s.key] || []).forEach((it, j) => insItem.run(s.key, it.tag, it.txt, it.pct, j));
      });
    }

    if (tableEmpty(db, "commitment_template")) {
      const ins = db.prepare(`INSERT INTO commitment_template (time, domain, text, order_index, active)
                              VALUES (?, ?, ?, ?, 1)`);
      COMMITMENT_TEMPLATE.forEach((c, i) => ins.run(c.time, c.domain, c.text, i));
    }

    if (tableEmpty(db, "accounts")) {
      const ins = db.prepare(`INSERT INTO accounts (name, kind, institution, order_index, active)
                              VALUES (?, ?, ?, ?, 1)`);
      ACCOUNTS.forEach((a, i) => ins.run(a.name, a.kind, a.institution, i));
    }

    // Verse: always ensure a 'default' row exists. The API falls back to it when no row matches today's date.
    const hasDefault = db.prepare(`SELECT 1 FROM verse WHERE date = 'default'`).get();
    if (!hasDefault) {
      db.prepare(`INSERT INTO verse (date, sanskrit, ref, translation_pre, translation_bold, translation_post)
                  VALUES ('default', ?, ?, ?, ?, ?)`).run(
        DEFAULT_VERSE.sanskrit, DEFAULT_VERSE.ref,
        DEFAULT_VERSE.translation_pre, DEFAULT_VERSE.translation_bold, DEFAULT_VERSE.translation_post
      );
    }
  });
  tx();
}

module.exports = { seedIfEmpty };
