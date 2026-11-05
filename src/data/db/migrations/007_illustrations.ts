// 只能新增 migration，已發佈的 migration 不可修改
// 手繪插圖：插圖本身（筆畫存成 JSON），以及貼在日記頁上的位置
export const migration007 = {
  version: 7,
  sql: `
CREATE TABLE illustrations (
  id         TEXT PRIMARY KEY NOT NULL,
  strokes    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 刪除插圖時，貼在日記上的（含已刪除的日記）一起拿掉
CREATE TABLE journal_entry_stickers (
  entry_id        TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL,
  illustration_id TEXT NOT NULL REFERENCES illustrations(id) ON DELETE CASCADE,
  x               REAL NOT NULL,
  y               REAL NOT NULL,
  size            REAL NOT NULL,
  rotation        REAL NOT NULL,
  PRIMARY KEY (entry_id, sort_order)
) WITHOUT ROWID;
CREATE INDEX idx_journal_entry_stickers_illustration
  ON journal_entry_stickers(illustration_id);
`,
} as const;
