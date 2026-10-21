// 只能新增 migration，已發佈的 migration 不可修改
// 帳本分成「分帳」與「個人」兩種；成員可以標記為「我」（每本帳本最多一位）
export const migration002 = {
  version: 2,
  sql: `
ALTER TABLE ledgers ADD COLUMN kind TEXT NOT NULL DEFAULT 'shared'
  CHECK (kind IN ('shared', 'personal'));
-- 整個 App 只會有一本個人帳本
CREATE UNIQUE INDEX idx_ledgers_single_personal ON ledgers(kind) WHERE kind = 'personal';

ALTER TABLE members ADD COLUMN is_self INTEGER NOT NULL DEFAULT 0
  CHECK (is_self IN (0, 1));
-- 每本帳本最多一位「我」
CREATE UNIQUE INDEX idx_members_single_self ON members(ledger_id) WHERE is_self = 1;
`,
} as const;
