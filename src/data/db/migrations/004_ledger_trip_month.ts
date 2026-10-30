// 只能新增 migration，已發佈的 migration 不可修改
// 手動指定的旅行月份（YYYY-MM）；NULL 代表自動判斷（最早一筆消費的月份）
export const migration004 = {
  version: 4,
  sql: `
ALTER TABLE ledgers ADD COLUMN trip_month TEXT;
`,
} as const;
