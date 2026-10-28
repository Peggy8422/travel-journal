// 只能新增 migration，已發佈的 migration 不可修改
// 帳本封面的三個代碼。舊帳本是 NULL，畫面依帳本 id 補一個固定的封面；
// 不加 CHECK，之後新增代碼時不必再改資料表（讀不認得的代碼時會當作 NULL）
export const migration003 = {
  version: 3,
  sql: `
ALTER TABLE ledgers ADD COLUMN cover_style TEXT;
ALTER TABLE ledgers ADD COLUMN cover_palette TEXT;
ALTER TABLE ledgers ADD COLUMN cover_pattern TEXT;
`,
} as const;
