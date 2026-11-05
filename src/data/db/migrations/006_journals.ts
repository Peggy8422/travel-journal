// 只能新增 migration，已發佈的 migration 不可修改
// 旅遊手帳：手帳（可綁一本帳本）、日記，以及日記的照片與地點
export const migration006 = {
  version: 6,
  sql: `
CREATE TABLE journals (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  ledger_id   TEXT REFERENCES ledgers(id) ON DELETE SET NULL,
  cover_tape  TEXT NOT NULL,
  cover_photo TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
-- 一本帳本最多綁一本手帳
CREATE UNIQUE INDEX idx_journals_ledger ON journals(ledger_id) WHERE ledger_id IS NOT NULL;

CREATE TABLE journal_entries (
  id         TEXT PRIMARY KEY NOT NULL,
  journal_id TEXT NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  entry_date TEXT NOT NULL CHECK (entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  weather    TEXT,
  mood       TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_journal_entries_journal ON journal_entries(journal_id, entry_date);

CREATE TABLE journal_entry_photos (
  entry_id   TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  photo      TEXT NOT NULL,
  PRIMARY KEY (entry_id, sort_order)
) WITHOUT ROWID;

CREATE TABLE journal_entry_places (
  entry_id   TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  name       TEXT NOT NULL,
  latitude   REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude  REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  PRIMARY KEY (entry_id, sort_order)
) WITHOUT ROWID;
`,
} as const;
