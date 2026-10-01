-- The 8 recurring stones. Edit-in-place lives here.
-- trigger   = the cue/context that fires the action ("kitchen, after coffee") per implementation-intention research.
-- tiny_text = the minimum viable version per Fogg's B=MAP, surfaced on hard days ("put on shoes").
CREATE TABLE IF NOT EXISTS commitment_template (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  time         TEXT    NOT NULL,
  domain       TEXT    NOT NULL,
  text         TEXT    NOT NULL,
  trigger      TEXT    NOT NULL DEFAULT '',
  tiny_text    TEXT    NOT NULL DEFAULT '',
  order_index  INTEGER NOT NULL,
  active       INTEGER NOT NULL DEFAULT 1
);

-- Per-day completion record. Rows are lazy-created on first toggle.
-- skipped = 1 when explicitly skipped (with a one-line reason — friction prevents reflexive skipping).
CREATE TABLE IF NOT EXISTS commitment_log (
  date         TEXT    NOT NULL,
  template_id  INTEGER NOT NULL REFERENCES commitment_template(id) ON DELETE CASCADE,
  done         INTEGER NOT NULL DEFAULT 0,
  skipped      INTEGER NOT NULL DEFAULT 0,
  skip_reason  TEXT    NOT NULL DEFAULT '',
  PRIMARY KEY (date, template_id)
);

-- Daily journal. obstacle = morning WOOP line ("what gets in the way today?").
-- line1-3 = three stoic evening questions: controlled / pulled off / tomorrow's stone.
CREATE TABLE IF NOT EXISTS journal (
  date      TEXT PRIMARY KEY,
  obstacle  TEXT NOT NULL DEFAULT '',
  line1     TEXT NOT NULL DEFAULT '',
  line2     TEXT NOT NULL DEFAULT '',
  line3     TEXT NOT NULL DEFAULT ''
);

-- The five scope levels (ultimate / year / quarter / week / today).
CREATE TABLE IF NOT EXISTS cascade_scopes (
  key          TEXT PRIMARY KEY,
  scope        TEXT NOT NULL,
  text         TEXT NOT NULL,
  order_index  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cascade_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_key    TEXT    NOT NULL REFERENCES cascade_scopes(key) ON DELETE CASCADE,
  tag          TEXT    NOT NULL,
  txt          TEXT    NOT NULL,
  pct          INTEGER,
  order_index  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cascade_items_scope ON cascade_items(scope_key, order_index);

-- The six pillars.
CREATE TABLE IF NOT EXISTS domains (
  id           TEXT PRIMARY KEY,
  glyph        TEXT NOT NULL,
  name         TEXT NOT NULL,
  stmt         TEXT NOT NULL,
  goal         TEXT NOT NULL,
  pct          INTEGER NOT NULL DEFAULT 0,
  streak       INTEGER NOT NULL DEFAULT 0,
  ritual       TEXT NOT NULL,
  order_index  INTEGER NOT NULL
);

-- One Gita verse per date. Default verse lives under date='default' and is used as a fallback.
CREATE TABLE IF NOT EXISTS verse (
  date              TEXT PRIMARY KEY,
  sanskrit          TEXT NOT NULL,
  ref               TEXT NOT NULL,
  translation_pre   TEXT NOT NULL,
  translation_bold  TEXT NOT NULL,
  translation_post  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_review (
  week_start  TEXT PRIMARY KEY,
  kept        TEXT NOT NULL DEFAULT '',
  broke       TEXT NOT NULL DEFAULT '',
  noticed     TEXT NOT NULL DEFAULT '',
  change      TEXT NOT NULL DEFAULT ''
);

-- Wealth: accounts the user holds, with daily-or-whenever balance snapshots.
CREATE TABLE IF NOT EXISTS accounts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  kind         TEXT    NOT NULL DEFAULT 'brokerage',  -- brokerage | retirement | cash | debt | other
  institution  TEXT    NOT NULL DEFAULT '',
  currency     TEXT    NOT NULL DEFAULT 'USD',
  order_index  INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1
);

-- One row per (account, date). Re-entering same-day upserts.
-- Balance is signed (positive for assets, negative for debts) so net-worth = SUM.
CREATE TABLE IF NOT EXISTS balance_snapshots (
  date        TEXT    NOT NULL,
  account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  balance     REAL    NOT NULL,
  PRIMARY KEY (date, account_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_account ON balance_snapshots(account_id, date);

-- Generic trackers for the non-wealth pillars. One numeric value per (date, tracker).
-- direction='up' means higher is better (e.g., workouts); 'down' means lower is better (weight, RHR).
CREATE TABLE IF NOT EXISTS trackers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  pillar_id    TEXT    NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  unit         TEXT    NOT NULL DEFAULT '',
  direction    TEXT    NOT NULL DEFAULT 'up',
  target       REAL,
  order_index  INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_trackers_pillar ON trackers(pillar_id, order_index);

CREATE TABLE IF NOT EXISTS tracker_logs (
  date         TEXT    NOT NULL,
  tracker_id   INTEGER NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  value        REAL    NOT NULL,
  PRIMARY KEY (date, tracker_id)
);

CREATE INDEX IF NOT EXISTS idx_tracker_logs_tid ON tracker_logs(tracker_id, date);

-- Milestone goals per pillar (used by all non-wealth pillars).
CREATE TABLE IF NOT EXISTS pillar_goals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pillar_id     TEXT    NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  title         TEXT    NOT NULL,
  target_value  REAL,
  target_unit   TEXT    NOT NULL DEFAULT '',
  deadline      TEXT,
  notes         TEXT    NOT NULL DEFAULT '',
  order_index   INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_pillar_goals_pillar ON pillar_goals(pillar_id, order_index);

CREATE TABLE IF NOT EXISTS wealth_goals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  target_amount REAL    NOT NULL,
  deadline      TEXT,           -- nullable YYYY-MM-DD
  notes         TEXT    NOT NULL DEFAULT '',
  order_index   INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);
