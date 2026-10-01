require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'lifetracker.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(fs.readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8'));

// Idempotent migrations for columns added after the initial schema shipped.
// SQLite's CREATE TABLE IF NOT EXISTS won't add columns to an existing table.
function addColumnIfMissing(table, col, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some(c => c.name === col)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
addColumnIfMissing('commitment_template', 'trigger',     `trigger TEXT NOT NULL DEFAULT ''`);
addColumnIfMissing('commitment_template', 'tiny_text',   `tiny_text TEXT NOT NULL DEFAULT ''`);
addColumnIfMissing('commitment_log',      'skipped',     `skipped INTEGER NOT NULL DEFAULT 0`);
addColumnIfMissing('commitment_log',      'skip_reason', `skip_reason TEXT NOT NULL DEFAULT ''`);
addColumnIfMissing('journal',             'obstacle',    `obstacle TEXT NOT NULL DEFAULT ''`);

require('./db/seed').seedIfEmpty(db);

const PASSCODE_HASH = process.env.PASSCODE_HASH || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const SESSION_DAYS = 90;
const COOKIE_NAME = 'lt_session';

if (!PASSCODE_HASH || !SESSION_SECRET) {
  console.error('\nMissing PASSCODE_HASH or SESSION_SECRET in .env.');
  console.error('Run:  npm run passcode -- "your passcode"\n');
  process.exit(1);
}

function signSession() {
  const expiry = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expiry);
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

function verifySession(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  if (mac.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  const expiry = Number(payload);
  return Number.isFinite(expiry) && expiry > Date.now();
}

function setSessionCookie(res) {
  res.cookie(COOKIE_NAME, signSession(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // LAN over plain HTTP — flip to true when behind HTTPS
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function requireAuth(req, res, next) {
  if (verifySession(req.cookies[COOKIE_NAME])) return next();
  res.status(401).json({ error: 'unauthorized' });
}

const app = express();
app.use(express.json());
app.use(cookieParser());

// --- Auth (open) ---
app.post('/api/auth', async (req, res) => {
  const { passcode } = req.body || {};
  if (!passcode || typeof passcode !== 'string') return res.status(400).json({ error: 'passcode required' });
  const ok = await bcrypt.compare(passcode, PASSCODE_HASH);
  if (!ok) return res.status(401).json({ error: 'wrong passcode' });
  setSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  res.json({ authenticated: verifySession(req.cookies[COOKIE_NAME]) });
});

// --- Health (open — used to detect server reachable before login) ---
app.get('/api/health', (_req, res) => {
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all().map(t => t.name);
  const counts = Object.fromEntries(tables.map(t => [t, db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c]));
  res.json({ ok: true, tables, counts });
});

// --- Data routes (gated) ---
const api = express.Router();
api.use(requireAuth);

// Step 3 wires this; lazy-create log rows on first toggle.
api.get('/commitments', (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD required' });
  const rows = db.prepare(`
    SELECT t.id AS id, t.time, t.domain, t.text, t.trigger, t.tiny_text, t.order_index,
           COALESCE(l.done, 0)    AS done,
           COALESCE(l.skipped, 0) AS skipped,
           COALESCE(l.skip_reason, '') AS skip_reason
    FROM commitment_template t
    LEFT JOIN commitment_log l ON l.template_id = t.id AND l.date = ?
    WHERE t.active = 1
    ORDER BY t.order_index
  `).all(date);
  res.json({ date, commitments: rows.map(r => ({ ...r, done: !!r.done, skipped: !!r.skipped })) });
});

api.post('/commitments/template', (req, res) => {
  const { time, domain, text, trigger, tiny_text } = req.body || {};
  if (!time || typeof time !== 'string' || !/^\d{1,2}:\d{2}$/.test(time)) return res.status(400).json({ error: 'time HH:MM required' });
  if (!domain || typeof domain !== 'string') return res.status(400).json({ error: 'domain required' });
  if (!text || typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text required' });
  const trg = String(trigger || '').trim();
  const tny = String(tiny_text || '').trim();
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(order_index), -1) AS m FROM commitment_template WHERE active = 1`).get().m;
  const info = db.prepare(`INSERT INTO commitment_template (time, domain, text, trigger, tiny_text, order_index, active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
                 .run(time, domain, text.trim(), trg, tny, maxOrder + 1);
  res.json({ id: info.lastInsertRowid, time, domain, text: text.trim(), trigger: trg, tiny_text: tny, order_index: maxOrder + 1, done: false });
});

api.patch('/commitments/template/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id required' });
  const row = db.prepare(`SELECT * FROM commitment_template WHERE id = ?`).get(id);
  if (!row) return res.status(404).json({ error: 'not found' });
  const { time, domain, text, trigger, tiny_text } = req.body || {};
  const fields = [], vals = [];
  if (time !== undefined) {
    if (!/^\d{1,2}:\d{2}$/.test(String(time))) return res.status(400).json({ error: 'time HH:MM' });
    fields.push('time = ?'); vals.push(time);
  }
  if (domain !== undefined) {
    if (typeof domain !== 'string' || !domain.trim()) return res.status(400).json({ error: 'domain' });
    fields.push('domain = ?'); vals.push(domain.trim());
  }
  if (text !== undefined) {
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text' });
    fields.push('text = ?'); vals.push(text.trim());
  }
  if (trigger !== undefined)   { fields.push('trigger = ?');   vals.push(String(trigger).trim()); }
  if (tiny_text !== undefined) { fields.push('tiny_text = ?'); vals.push(String(tiny_text).trim()); }
  if (!fields.length) return res.json({ id, ...row });
  vals.push(id);
  db.prepare(`UPDATE commitment_template SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  const updated = db.prepare(`SELECT * FROM commitment_template WHERE id = ?`).get(id);
  res.json(updated);
});

api.delete('/commitments/template/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id required' });
  const info = db.prepare(`UPDATE commitment_template SET active = 0 WHERE id = ? AND active = 1`).run(id);
  if (!info.changes) return res.status(404).json({ error: 'not found or already deleted' });
  res.json({ id, active: false });
});

api.get('/recommendations', (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD required' });
  const limit = Math.max(1, Math.min(10, Number(req.query.limit) || 3));
  const weekdayTag = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(date + 'T12:00:00').getDay()];
  // Tag-match for today (week scope) first, then other incomplete week items, then quarter goals as filler.
  const rows = db.prepare(`
    SELECT id, scope_key, tag, txt, pct,
           CASE
             WHEN scope_key = 'week' AND LOWER(tag) = ? THEN 0
             WHEN scope_key = 'week'                     THEN 1
             WHEN scope_key = 'quarter'                  THEN 2
             ELSE 3
           END AS rank
    FROM cascade_items
    WHERE scope_key IN ('week', 'quarter')
      AND (pct IS NULL OR pct < 100)
    ORDER BY rank, order_index
    LIMIT ?
  `).all(weekdayTag, limit);
  res.json({ date, weekday: weekdayTag, items: rows });
});

api.get('/journal', (req, res) => {
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date=YYYY-MM-DD required' });
  const row = db.prepare(`SELECT date, obstacle, line1, line2, line3 FROM journal WHERE date = ?`).get(date);
  res.json(row || { date, obstacle: '', line1: '', line2: '', line3: '' });
});

// Partial PUT: only updates fields present in the body. obstacle is morning; line1-3 are evening.
api.put('/journal', (req, res) => {
  const { date, obstacle, line1, line2, line3 } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error: 'date required' });
  const incoming = { obstacle, line1, line2, line3 };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    if (typeof v !== 'string') return res.status(400).json({ error: `${k} must be a string` });
    if (v.length > 600) return res.status(400).json({ error: `${k} too long` });
  }
  // Ensure row exists, then patch only what was sent.
  db.prepare(`INSERT OR IGNORE INTO journal (date) VALUES (?)`).run(date);
  const fields = [], vals = [];
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined) continue;
    fields.push(`${k} = ?`); vals.push(v);
  }
  if (fields.length) {
    vals.push(date);
    db.prepare(`UPDATE journal SET ${fields.join(', ')} WHERE date = ?`).run(...vals);
  }
  const row = db.prepare(`SELECT date, obstacle, line1, line2, line3 FROM journal WHERE date = ?`).get(date);
  res.json(row);
});

api.post('/commitments/toggle', (req, res) => {
  const { date, template_id } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error: 'date required' });
  if (!Number.isInteger(template_id)) return res.status(400).json({ error: 'template_id required' });
  const exists = db.prepare(`SELECT 1 FROM commitment_template WHERE id = ? AND active = 1`).get(template_id);
  if (!exists) return res.status(404).json({ error: 'unknown template_id' });

  const current = db.prepare(`SELECT done FROM commitment_log WHERE date = ? AND template_id = ?`).get(date, template_id);
  const next = current ? (current.done ? 0 : 1) : 1;
  // Toggling done always clears any prior skip — done wins over skipped.
  db.prepare(`
    INSERT INTO commitment_log (date, template_id, done, skipped, skip_reason)
    VALUES (?, ?, ?, 0, '')
    ON CONFLICT(date, template_id) DO UPDATE SET
      done = excluded.done,
      skipped = 0,
      skip_reason = ''
  `).run(date, template_id, next);
  res.json({ date, template_id, done: !!next, skipped: false });
});

// Explicit skip with a one-line reason. Friction prevents reflexive skipping (Kahneman/defaults).
api.post('/commitments/skip', (req, res) => {
  const { date, template_id, reason } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error: 'date required' });
  if (!Number.isInteger(template_id)) return res.status(400).json({ error: 'template_id required' });
  const r = String(reason || '').trim();
  if (!r) return res.status(400).json({ error: 'reason required' });
  if (r.length > 200) return res.status(400).json({ error: 'reason too long (max 200)' });
  const exists = db.prepare(`SELECT 1 FROM commitment_template WHERE id = ? AND active = 1`).get(template_id);
  if (!exists) return res.status(404).json({ error: 'unknown template_id' });
  db.prepare(`
    INSERT INTO commitment_log (date, template_id, done, skipped, skip_reason)
    VALUES (?, ?, 0, 1, ?)
    ON CONFLICT(date, template_id) DO UPDATE SET
      done = 0,
      skipped = 1,
      skip_reason = excluded.skip_reason
  `).run(date, template_id, r);
  res.json({ date, template_id, done: false, skipped: true, skip_reason: r });
});

// 28-day momentum: per-day proportion of active stones kept + overall proportion + slope.
// slope = (second-half proportion) - (first-half proportion), bucketed to up/flat/down.
api.get('/momentum', (req, res) => {
  const days = Math.max(7, Math.min(120, Number(req.query.days) || 28));
  // Build the date list, oldest → newest.
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  const totalActive = db.prepare(`SELECT COUNT(*) AS c FROM commitment_template WHERE active = 1`).get().c;
  if (!totalActive) {
    return res.json({ days, cells: dates.map(d => ({ date: d, kept: 0, total: 0 })), kept: 0, total: 0, proportion: 0, slope: 'flat' });
  }
  const rows = db.prepare(`
    SELECT date, SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS kept
    FROM commitment_log
    WHERE date >= ? AND date <= ?
    GROUP BY date
  `).all(dates[0], dates[dates.length - 1]);
  const byDate = Object.fromEntries(rows.map(r => [r.date, r.kept]));
  const cells = dates.map(d => ({ date: d, kept: byDate[d] || 0, total: totalActive }));
  const totalKept = cells.reduce((s, c) => s + c.kept, 0);
  const totalCells = cells.length * totalActive;
  // Slope: compare last half vs first half. Threshold of ±3 percentage points = "up"/"down".
  const half = Math.floor(cells.length / 2);
  const firstHalf = cells.slice(0, half);
  const secondHalf = cells.slice(cells.length - half);
  const propA = firstHalf.reduce((s, c) => s + c.kept, 0) / (firstHalf.length * totalActive || 1);
  const propB = secondHalf.reduce((s, c) => s + c.kept, 0) / (secondHalf.length * totalActive || 1);
  const diff = propB - propA;
  const slope = diff > 0.03 ? 'up' : diff < -0.03 ? 'down' : 'flat';
  res.json({
    days, cells,
    kept: totalKept, total: totalCells,
    proportion: totalCells ? totalKept / totalCells : 0,
    slope,
  });
});

// --- Wealth: accounts, snapshots, goals ---
const ACCOUNT_KINDS = new Set(['brokerage', 'retirement', 'cash', 'debt', 'other']);

api.get('/wealth/accounts', (_req, res) => {
  const rows = db.prepare(`
    SELECT a.id, a.name, a.kind, a.institution, a.currency, a.order_index,
           (SELECT s.balance FROM balance_snapshots s WHERE s.account_id = a.id ORDER BY s.date DESC LIMIT 1) AS latest_balance,
           (SELECT s.date    FROM balance_snapshots s WHERE s.account_id = a.id ORDER BY s.date DESC LIMIT 1) AS latest_date
    FROM accounts a
    WHERE a.active = 1
    ORDER BY a.order_index, a.id
  `).all();
  res.json({ accounts: rows });
});

api.post('/wealth/accounts', (req, res) => {
  const { name, kind, institution } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name required' });
  const k = ACCOUNT_KINDS.has(kind) ? kind : 'brokerage';
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(order_index), -1) AS m FROM accounts WHERE active = 1`).get().m;
  const info = db.prepare(`INSERT INTO accounts (name, kind, institution, order_index, active) VALUES (?, ?, ?, ?, 1)`)
                 .run(name.trim(), k, (institution || '').trim(), maxOrder + 1);
  res.json({ id: info.lastInsertRowid, name: name.trim(), kind: k, institution: (institution || '').trim() });
});

api.patch('/wealth/accounts/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id required' });
  if (!db.prepare(`SELECT 1 FROM accounts WHERE id = ? AND active = 1`).get(id)) return res.status(404).json({ error: 'not found' });
  const { name, kind, institution } = req.body || {};
  const fields = [], vals = [];
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name' });
    fields.push('name = ?'); vals.push(name.trim());
  }
  if (kind !== undefined) {
    if (!ACCOUNT_KINDS.has(kind)) return res.status(400).json({ error: 'kind' });
    fields.push('kind = ?'); vals.push(kind);
  }
  if (institution !== undefined) {
    fields.push('institution = ?'); vals.push(String(institution || '').trim());
  }
  if (!fields.length) return res.json({ id });
  vals.push(id);
  db.prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json(db.prepare(`SELECT id, name, kind, institution FROM accounts WHERE id = ?`).get(id));
});

api.delete('/wealth/accounts/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id required' });
  const info = db.prepare(`UPDATE accounts SET active = 0 WHERE id = ? AND active = 1`).run(id);
  if (!info.changes) return res.status(404).json({ error: 'not found' });
  res.json({ id, active: false });
});

// Snapshots: return per-account series in a date range (default: last 90 days).
api.get('/wealth/snapshots', (req, res) => {
  const days = Math.max(1, Math.min(3650, Number(req.query.days) || 90));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT date, account_id, balance
    FROM balance_snapshots
    WHERE date >= ?
    ORDER BY date ASC, account_id ASC
  `).all(since);
  res.json({ since, snapshots: rows });
});

// Upsert balances for a date. Body: { date, balances: { [account_id]: number } }
// Only includes accounts where the value is a finite number (skip blanks).
api.put('/wealth/snapshots', (req, res) => {
  const { date, balances } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error: 'date required' });
  if (!balances || typeof balances !== 'object') return res.status(400).json({ error: 'balances object required' });
  const accountIds = new Set(db.prepare(`SELECT id FROM accounts WHERE active = 1`).all().map(r => r.id));
  const stmt = db.prepare(`
    INSERT INTO balance_snapshots (date, account_id, balance) VALUES (?, ?, ?)
    ON CONFLICT(date, account_id) DO UPDATE SET balance = excluded.balance
  `);
  const written = [];
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(balances)) {
      const id = Number(k);
      const n = Number(v);
      if (!accountIds.has(id)) continue;
      if (!Number.isFinite(n)) continue;
      stmt.run(date, id, n);
      written.push({ account_id: id, balance: n });
    }
  });
  tx();
  res.json({ date, written });
});

api.get('/wealth/goals', (_req, res) => {
  const rows = db.prepare(`SELECT id, title, target_amount, deadline, notes, order_index FROM wealth_goals WHERE active = 1 ORDER BY order_index, id`).all();
  res.json({ goals: rows });
});

api.post('/wealth/goals', (req, res) => {
  const { title, target_amount, deadline, notes } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'title required' });
  const tgt = Number(target_amount);
  if (!Number.isFinite(tgt)) return res.status(400).json({ error: 'target_amount required' });
  if (deadline !== undefined && deadline !== null && deadline !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(deadline))) {
    return res.status(400).json({ error: 'deadline must be YYYY-MM-DD' });
  }
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(order_index), -1) AS m FROM wealth_goals WHERE active = 1`).get().m;
  const info = db.prepare(`INSERT INTO wealth_goals (title, target_amount, deadline, notes, order_index, active) VALUES (?, ?, ?, ?, ?, 1)`)
                 .run(title.trim(), tgt, deadline || null, (notes || '').trim(), maxOrder + 1);
  res.json({ id: info.lastInsertRowid, title: title.trim(), target_amount: tgt, deadline: deadline || null, notes: (notes || '').trim() });
});

api.patch('/wealth/goals/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id required' });
  if (!db.prepare(`SELECT 1 FROM wealth_goals WHERE id = ? AND active = 1`).get(id)) return res.status(404).json({ error: 'not found' });
  const { title, target_amount, deadline, notes } = req.body || {};
  const fields = [], vals = [];
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'title' });
    fields.push('title = ?'); vals.push(title.trim());
  }
  if (target_amount !== undefined) {
    const n = Number(target_amount);
    if (!Number.isFinite(n)) return res.status(400).json({ error: 'target_amount' });
    fields.push('target_amount = ?'); vals.push(n);
  }
  if (deadline !== undefined) {
    if (deadline !== null && deadline !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(deadline))) return res.status(400).json({ error: 'deadline' });
    fields.push('deadline = ?'); vals.push(deadline || null);
  }
  if (notes !== undefined) { fields.push('notes = ?'); vals.push(String(notes || '').trim()); }
  if (!fields.length) return res.json({ id });
  vals.push(id);
  db.prepare(`UPDATE wealth_goals SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json(db.prepare(`SELECT id, title, target_amount, deadline, notes FROM wealth_goals WHERE id = ?`).get(id));
});

api.delete('/wealth/goals/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id required' });
  const info = db.prepare(`UPDATE wealth_goals SET active = 0 WHERE id = ? AND active = 1`).run(id);
  if (!info.changes) return res.status(404).json({ error: 'not found' });
  res.json({ id, active: false });
});

// --- Generic pillars (Body / Craft / Father / Mind / Spirit) ---
const PILLAR_IDS = new Set(['health', 'work', 'father', 'mind', 'spirit']);
const DIRECTIONS = new Set(['up', 'down']);

function requirePillar(req, res) {
  const id = String(req.params.id || '');
  if (!PILLAR_IDS.has(id)) { res.status(400).json({ error: 'unknown pillar' }); return null; }
  return id;
}

api.get('/pillars/:id', (req, res) => {
  const id = requirePillar(req, res); if (!id) return;
  const trackers = db.prepare(`
    SELECT id, title, unit, direction, target, order_index
    FROM trackers WHERE pillar_id = ? AND active = 1
    ORDER BY order_index, id
  `).all(id);
  const goals = db.prepare(`
    SELECT id, title, target_value, target_unit, deadline, notes, order_index
    FROM pillar_goals WHERE pillar_id = ? AND active = 1
    ORDER BY order_index, id
  `).all(id);
  const days = Math.max(1, Math.min(3650, Number(req.query.days) || 90));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let logs = [];
  if (trackers.length) {
    const placeholders = trackers.map(() => '?').join(',');
    logs = db.prepare(`
      SELECT date, tracker_id, value FROM tracker_logs
      WHERE tracker_id IN (${placeholders}) AND date >= ?
      ORDER BY date ASC, tracker_id ASC
    `).all(...trackers.map(t => t.id), since);
  }
  res.json({ pillar_id: id, trackers, goals, logs, since });
});

api.post('/pillars/:id/trackers', (req, res) => {
  const id = requirePillar(req, res); if (!id) return;
  const { title, unit, direction, target } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'title required' });
  const dir = DIRECTIONS.has(direction) ? direction : 'up';
  const tgt = target == null || target === '' ? null : Number(target);
  if (tgt !== null && !Number.isFinite(tgt)) return res.status(400).json({ error: 'target' });
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(order_index), -1) AS m FROM trackers WHERE pillar_id = ? AND active = 1`).get(id).m;
  const info = db.prepare(`INSERT INTO trackers (pillar_id, title, unit, direction, target, order_index, active) VALUES (?, ?, ?, ?, ?, ?, 1)`)
                 .run(id, title.trim(), String(unit || '').trim(), dir, tgt, maxOrder + 1);
  res.json({ id: info.lastInsertRowid, pillar_id: id, title: title.trim(), unit: String(unit || '').trim(), direction: dir, target: tgt });
});

api.patch('/pillars/:id/trackers/:tid', (req, res) => {
  const id = requirePillar(req, res); if (!id) return;
  const tid = Number(req.params.tid);
  if (!Number.isInteger(tid)) return res.status(400).json({ error: 'tid required' });
  if (!db.prepare(`SELECT 1 FROM trackers WHERE id = ? AND pillar_id = ? AND active = 1`).get(tid, id)) return res.status(404).json({ error: 'not found' });
  const { title, unit, direction, target } = req.body || {};
  const fields = [], vals = [];
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'title' });
    fields.push('title = ?'); vals.push(title.trim());
  }
  if (unit !== undefined) { fields.push('unit = ?'); vals.push(String(unit || '').trim()); }
  if (direction !== undefined) {
    if (!DIRECTIONS.has(direction)) return res.status(400).json({ error: 'direction' });
    fields.push('direction = ?'); vals.push(direction);
  }
  if (target !== undefined) {
    const n = target == null || target === '' ? null : Number(target);
    if (n !== null && !Number.isFinite(n)) return res.status(400).json({ error: 'target' });
    fields.push('target = ?'); vals.push(n);
  }
  if (!fields.length) return res.json({ id: tid });
  vals.push(tid);
  db.prepare(`UPDATE trackers SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json(db.prepare(`SELECT id, title, unit, direction, target FROM trackers WHERE id = ?`).get(tid));
});

api.delete('/pillars/:id/trackers/:tid', (req, res) => {
  const id = requirePillar(req, res); if (!id) return;
  const tid = Number(req.params.tid);
  if (!Number.isInteger(tid)) return res.status(400).json({ error: 'tid required' });
  const info = db.prepare(`UPDATE trackers SET active = 0 WHERE id = ? AND pillar_id = ? AND active = 1`).run(tid, id);
  if (!info.changes) return res.status(404).json({ error: 'not found' });
  res.json({ id: tid, active: false });
});

// Upsert today's logs for any subset of this pillar's trackers.
// Body: { date, values: { [tracker_id]: number } }
api.put('/pillars/:id/logs', (req, res) => {
  const id = requirePillar(req, res); if (!id) return;
  const { date, values } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return res.status(400).json({ error: 'date required' });
  if (!values || typeof values !== 'object') return res.status(400).json({ error: 'values object required' });
  const trackerIds = new Set(db.prepare(`SELECT id FROM trackers WHERE pillar_id = ? AND active = 1`).all(id).map(r => r.id));
  const stmt = db.prepare(`
    INSERT INTO tracker_logs (date, tracker_id, value) VALUES (?, ?, ?)
    ON CONFLICT(date, tracker_id) DO UPDATE SET value = excluded.value
  `);
  const written = [];
  const tx = db.transaction(() => {
    for (const [k, v] of Object.entries(values)) {
      const tid = Number(k);
      const n = Number(v);
      if (!trackerIds.has(tid)) continue;
      if (!Number.isFinite(n)) continue;
      stmt.run(date, tid, n);
      written.push({ tracker_id: tid, value: n });
    }
  });
  tx();
  res.json({ date, written });
});

api.post('/pillars/:id/goals', (req, res) => {
  const id = requirePillar(req, res); if (!id) return;
  const { title, target_value, target_unit, deadline, notes } = req.body || {};
  if (!title || typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'title required' });
  const tv = target_value == null || target_value === '' ? null : Number(target_value);
  if (tv !== null && !Number.isFinite(tv)) return res.status(400).json({ error: 'target_value' });
  if (deadline !== undefined && deadline !== null && deadline !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(deadline))) {
    return res.status(400).json({ error: 'deadline must be YYYY-MM-DD' });
  }
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(order_index), -1) AS m FROM pillar_goals WHERE pillar_id = ? AND active = 1`).get(id).m;
  const info = db.prepare(`INSERT INTO pillar_goals (pillar_id, title, target_value, target_unit, deadline, notes, order_index, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`)
                 .run(id, title.trim(), tv, String(target_unit || '').trim(), deadline || null, (notes || '').trim(), maxOrder + 1);
  res.json({ id: info.lastInsertRowid, pillar_id: id, title: title.trim(), target_value: tv, target_unit: String(target_unit || '').trim(), deadline: deadline || null, notes: (notes || '').trim() });
});

api.patch('/pillars/:id/goals/:gid', (req, res) => {
  const id = requirePillar(req, res); if (!id) return;
  const gid = Number(req.params.gid);
  if (!Number.isInteger(gid)) return res.status(400).json({ error: 'gid required' });
  if (!db.prepare(`SELECT 1 FROM pillar_goals WHERE id = ? AND pillar_id = ? AND active = 1`).get(gid, id)) return res.status(404).json({ error: 'not found' });
  const { title, target_value, target_unit, deadline, notes } = req.body || {};
  const fields = [], vals = [];
  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'title' });
    fields.push('title = ?'); vals.push(title.trim());
  }
  if (target_value !== undefined) {
    const n = target_value == null || target_value === '' ? null : Number(target_value);
    if (n !== null && !Number.isFinite(n)) return res.status(400).json({ error: 'target_value' });
    fields.push('target_value = ?'); vals.push(n);
  }
  if (target_unit !== undefined) { fields.push('target_unit = ?'); vals.push(String(target_unit || '').trim()); }
  if (deadline !== undefined) {
    if (deadline !== null && deadline !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(deadline))) return res.status(400).json({ error: 'deadline' });
    fields.push('deadline = ?'); vals.push(deadline || null);
  }
  if (notes !== undefined) { fields.push('notes = ?'); vals.push(String(notes || '').trim()); }
  if (!fields.length) return res.json({ id: gid });
  vals.push(gid);
  db.prepare(`UPDATE pillar_goals SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  res.json(db.prepare(`SELECT id, title, target_value, target_unit, deadline, notes FROM pillar_goals WHERE id = ?`).get(gid));
});

api.delete('/pillars/:id/goals/:gid', (req, res) => {
  const id = requirePillar(req, res); if (!id) return;
  const gid = Number(req.params.gid);
  if (!Number.isInteger(gid)) return res.status(400).json({ error: 'gid required' });
  const info = db.prepare(`UPDATE pillar_goals SET active = 0 WHERE id = ? AND pillar_id = ? AND active = 1`).run(gid, id);
  if (!info.changes) return res.status(404).json({ error: 'not found' });
  res.json({ id: gid, active: false });
});

app.use('/api', api);

// --- Static (open, after API so /api/* wins) ---
app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'Life Tracker.html')));
app.use(express.static(ROOT, { index: false, extensions: ['html'] }));

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Life Tracker  →  http://localhost:${port}`);
  console.log(`On your LAN   →  http://<laptop-ip>:${port}   (find with: ipconfig getifaddr en0)`);
});
