// 只能新增 migration，已發佈的 migration 不可修改
// 收藏地點：想去／去過的地點與照片、自訂評分項目與分數
export const migration008 = {
  version: 8,
  sql: `
CREATE TABLE rating_criteria (
  id          TEXT PRIMARY KEY NOT NULL,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL,
  archived_at TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
-- 預設的三個評分項目用固定的 id：每支手機都一樣，還原別支手機的備份時不會多出重複的項目
INSERT INTO rating_criteria (id, label, sort_order, archived_at, created_at, updated_at) VALUES
  ('taste', '好吃', 0, NULL, '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z'),
  ('vibe', '氣氛', 1, NULL, '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z'),
  ('value', 'CP值', 2, NULL, '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z');

CREATE TABLE saved_places (
  id         TEXT PRIMARY KEY NOT NULL,
  name       TEXT NOT NULL,
  latitude   REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude  REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  city       TEXT NOT NULL,
  -- 類型、狀態只能新增代碼，所以不加 CHECK，讀回時認不得的退回預設
  kind       TEXT NOT NULL,
  status     TEXT NOT NULL,
  note       TEXT NOT NULL,
  revisit    INTEGER NOT NULL CHECK (revisit IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE saved_place_photos (
  place_id   TEXT NOT NULL REFERENCES saved_places(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  photo      TEXT NOT NULL,
  PRIMARY KEY (place_id, sort_order)
) WITHOUT ROWID;

-- 評分項目不能刪除（只能封存），所以分數不跟著評分項目 CASCADE
CREATE TABLE saved_place_ratings (
  place_id     TEXT NOT NULL REFERENCES saved_places(id) ON DELETE CASCADE,
  criterion_id TEXT NOT NULL REFERENCES rating_criteria(id),
  score        INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  PRIMARY KEY (place_id, criterion_id)
) WITHOUT ROWID;
`,
} as const;
