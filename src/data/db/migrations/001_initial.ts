// 只能新增 migration，已發佈的 migration 不可修改
export const migration001 = {
  version: 1,
  sql: `
CREATE TABLE ledgers (
  id            TEXT PRIMARY KEY NOT NULL,
  name          TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'TWD' CHECK (length(base_currency) = 3),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE members (
  id          TEXT PRIMARY KEY NOT NULL,
  ledger_id   TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  archived_at TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (ledger_id, sort_order),
  UNIQUE (ledger_id, id)
);

CREATE TABLE expenses (
  id              TEXT PRIMARY KEY NOT NULL,
  ledger_id       TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  payer_id        TEXT NOT NULL,
  amount_minor    INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),
  currency        TEXT NOT NULL CHECK (length(currency) = 3),
  fx_rate_to_base TEXT,
  fx_source       TEXT CHECK (fx_source IN ('bot-live', 'bot-cached', 'manual')),
  fx_quote_date   TEXT,
  fx_basis        TEXT CHECK (fx_basis IN ('spot', 'cash')),
  split           TEXT NOT NULL CHECK (json_valid(split)),
  title           TEXT NOT NULL,
  note            TEXT,
  category        TEXT,
  place_name      TEXT,
  latitude        REAL CHECK (latitude BETWEEN -90 AND 90),
  longitude       REAL CHECK (longitude BETWEEN -180 AND 180),
  occurred_at     TEXT NOT NULL,
  occurred_at_ms  INTEGER NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT,
  FOREIGN KEY (ledger_id, payer_id) REFERENCES members(ledger_id, id),
  CHECK ((fx_rate_to_base IS NULL) = (fx_source IS NULL)),
  CHECK ((coalesce(fx_source, '') IN ('bot-live', 'bot-cached')) = (fx_quote_date IS NOT NULL)),
  CHECK ((coalesce(fx_source, '') IN ('bot-live', 'bot-cached')) = (fx_basis IS NOT NULL)),
  CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE INDEX idx_expenses_ledger ON expenses(ledger_id, occurred_at_ms);

CREATE TABLE settlements (
  id           TEXT PRIMARY KEY NOT NULL,
  ledger_id    TEXT NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  from_id      TEXT NOT NULL,
  to_id        TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),
  settled_at   TEXT NOT NULL,
  settled_at_ms INTEGER NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  CHECK (from_id <> to_id),
  FOREIGN KEY (ledger_id, from_id) REFERENCES members(ledger_id, id),
  FOREIGN KEY (ledger_id, to_id)   REFERENCES members(ledger_id, id)
);
CREATE INDEX idx_settlements_ledger ON settlements(ledger_id, settled_at_ms);

CREATE TABLE bot_quotes (
  currency   TEXT NOT NULL,
  quote_date TEXT NOT NULL,
  cash_buy   TEXT,
  cash_sell  TEXT,
  spot_buy   TEXT,
  spot_sell  TEXT,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (currency, quote_date)
) WITHOUT ROWID;
`,
} as const;
