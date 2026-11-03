// 只能新增 migration，已發佈的 migration 不可修改
// 照片封面的檔名（存在 App 的封面照片資料夾）；只有 cover_style = 'photo' 的帳本才有
export const migration005 = {
  version: 5,
  sql: `
ALTER TABLE ledgers ADD COLUMN cover_photo TEXT;
`,
} as const;
