import type { BackupFileError } from "../../../data/backup/backupFile";
import type { SqlDatabase } from "../../../data/db/sqlDatabase";
import { pickTextFile, shareFile } from "../../../data/files/fileTransfer";
import { err, ok, type Result } from "../../../domain/common/result";
import { toTaipeiDate } from "../../../domain/fx";
import type { LedgerError } from "../../../domain/ledger";
import {
  buildBackupFile,
  restoreFromBackupText,
  type RestoreReport,
} from "./backupCommands";
import { buildExpensesCsv, exportFileName } from "./expenseCsv";
import type { LedgerSummary } from "./ledgerSummary";

/*
 * 匯出／匯入檔案的流程：組出內容後交給系統分享，或從選取的檔案還原。
 * 檔案 I/O 失敗（無法分享、讀檔失敗）直接 throw，由畫面顯示通用的錯誤訊息。
 */

/** 匯出所有帳本的備份檔並開啟分享選單 */
export async function shareBackup(db: SqlDatabase, now: Date): Promise<void> {
  const file = await buildBackupFile(db, now);
  await shareFile({
    name: file.fileName,
    content: file.content,
    mimeType: "application/json",
    uti: "public.json",
  });
}

/** 讓使用者選備份檔並還原；取消選檔時回傳 null */
export async function pickAndRestoreBackup(
  db: SqlDatabase,
): Promise<Result<RestoreReport, BackupFileError> | null> {
  const text = await pickTextFile();
  if (text === null) return null;
  return restoreFromBackupText(db, text);
}

/** 匯出單一帳本的消費明細 CSV 並開啟分享選單 */
export async function shareExpensesCsv(
  summary: LedgerSummary,
  categoryLabel: (category: string | null) => string,
  now: Date,
): Promise<Result<void, LedgerError>> {
  const csv = buildExpensesCsv(summary, categoryLabel);
  if (!csv.ok) return err(csv.error);
  const today = toTaipeiDate(now.toISOString());
  await shareFile({
    name: exportFileName(
      summary.ledger.name,
      today.ok ? today.value : "export",
      "csv",
    ),
    content: csv.value,
    mimeType: "text/csv",
    uti: "public.comma-separated-values-text",
  });
  return ok(undefined);
}
