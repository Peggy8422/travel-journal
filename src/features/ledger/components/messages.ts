import { formatMinorAmount, type CurrencyCode } from "../../../domain/ledger";
import type { BackupFileError } from "../../../data/backup/backupFile";
import type { RestoreReport } from "../services/backupCommands";
import type { LedgerCommandError } from "../services/ledgerCommands";
import type { LedgerSummaryError } from "../services/ledgerSummary";
import type { LocateError } from "../services/locateCurrentPlace";
import type {
  ManualReason,
  ResolveFxRateError,
} from "../services/resolveFxRate";

type DisplayableError =
  | LedgerCommandError
  | LedgerSummaryError
  | ResolveFxRateError
  | BackupFileError
  | LocateError;

/** 錯誤代碼轉成給使用者看的訊息 */
export function describeError(error: DisplayableError): string {
  switch (error.code) {
    case "EMPTY_NAME":
      return "名稱不能空白";
    case "NO_MEMBERS":
      return "至少要有一位成員";
    case "LEDGER_NOT_FOUND":
      return "找不到這本帳本";
    case "EXPENSE_NOT_FOUND":
      return "找不到這筆消費，可能已被刪除";
    case "SETTLEMENT_NOT_FOUND":
      return "找不到這筆還款，可能已被刪除";
    case "MEMBER_NOT_FOUND":
      return "找不到這位成員，可能已被刪除";
    case "MEMBER_REFERENCED":
      return "這位成員已經有消費或還款紀錄，不能刪除，可以改用封存";
    case "LAST_ACTIVE_MEMBER":
      return "帳本至少要保留一位未封存的成員";
    case "INVALID_AMOUNT_INPUT":
      return "請輸入正確的金額";
    case "TOO_MANY_DECIMALS":
      return error.decimals === 0
        ? `${error.currency} 只能輸入整數`
        : `${error.currency} 最多 ${error.decimals} 位小數`;
    case "AMOUNT_NOT_POSITIVE_INTEGER":
      return "金額必須大於 0";
    case "UNSUPPORTED_CURRENCY":
      return `不支援的幣別：${error.currency}`;
    case "INVALID_SHARE_INPUT":
      return `分攤金額有誤：${describeError(error.cause)}`;
    case "EXACT_SHARES_SUM_MISMATCH":
      return "每個人的分攤金額加總和消費金額不符";
    case "SHARE_NOT_POSITIVE_INTEGER":
      return "分攤金額必須大於 0，不分攤的人請留空";
    case "DUPLICATE_PARTICIPANT":
      return "同一位成員重複出現在分攤名單中";
    case "FX_RATE_UNEXPECTED":
      return "新台幣消費不需要匯率";
    case "INVALID_EXPENSE":
      return `有一筆消費資料有誤（${describeError(error.cause)}），請編輯或刪除該筆消費`;
    case "INVALID_SETTLEMENT":
      return `有一筆還款資料有誤（${describeError(error.cause)}）`;
    case "INVALID_BACKUP":
      return "這不是有效的備份檔，或檔案已損壞";
    case "UNSUPPORTED_BACKUP_VERSION":
      return "這份備份是較新版本的 App 匯出的，請先更新 App";
    case "NO_PARTICIPANTS":
      return "請至少選一位分攤的人";
    case "UNKNOWN_MEMBER":
      return "有成員不在這本帳本中";
    case "ARCHIVED_MEMBER":
      return "已封存的成員不能加入新的消費";
    case "FX_RATE_REQUIRED":
      return "外幣消費需要匯率";
    case "INVALID_FX_RATE":
      return "請輸入正確的匯率，例如 0.2134";
    case "CONVERTED_AMOUNT_ZERO":
      return "換算成新台幣後金額為 0，請確認金額或匯率";
    case "CONVERTED_AMOUNT_TOO_LARGE":
      return "金額過大";
    case "SELF_SETTLEMENT":
      return "不能自己還錢給自己";
    case "INVALID_TIMESTAMP":
    case "INVALID_DATE":
      return "時間格式錯誤";
    case "FUTURE_DATE":
      return "消費時間不能是未來";
    case "LOCATION_PERMISSION_DENIED":
      return "沒有定位權限，請到系統設定開啟，或直接輸入地名";
    case "LOCATION_UNAVAILABLE":
      return "目前無法定位，請確認定位服務已開啟，或直接輸入地名";
    default:
      return `資料有誤（${error.code}）`;
  }
}

/** 需要手動輸入匯率的原因 */
export function describeManualReason(reason: ManualReason): string {
  switch (reason) {
    case "currency-not-quoted":
      return "臺灣銀行沒有這個幣別的牌告匯率";
    case "date-out-of-range":
      return "超過臺灣銀行可查詢的日期範圍";
    case "no-cached-quote":
      return "目前離線，也沒有這個幣別的匯率紀錄";
    case "cached-quote-too-old":
      return "目前離線，最近的匯率紀錄太舊";
    case "cached-quote-unusable":
    case "cache-read-failed":
      return "無法讀取匯率紀錄";
  }
}

/**
 * 指定金額分攤時，加總與消費金額不符的說明；剛好分配完時回傳 null。
 * remainingMinor 為正代表還沒分配完，為負代表分配超過。
 */
export function describeAllocationGap(
  remainingMinor: number,
  currency: CurrencyCode,
): string | null {
  if (remainingMinor === 0) return null;
  const amount = `${currency} ${formatMinorAmount(Math.abs(remainingMinor), currency)}`;
  return remainingMinor > 0
    ? `還有 ${amount} 沒有分配，請調整每個人的金額，讓加總等於消費金額。`
    : `分配的金額超出 ${amount}，請調整每個人的金額，讓加總等於消費金額。`;
}

/** 還原結果的說明，分成還原、略過、失敗三段 */
export function describeRestoreReport(report: RestoreReport): string {
  const names = (ledgers: readonly { readonly name: string }[]) =>
    ledgers.map((l) => `「${l.name}」`).join("、");
  const lines: string[] = [];
  if (report.restored.length > 0) {
    lines.push(
      `已還原 ${report.restored.length} 本：${names(report.restored)}`,
    );
  }
  if (report.skipped.length > 0) {
    lines.push(
      `手機上已經有 ${report.skipped.length} 本，沒有變動：${names(report.skipped)}`,
    );
  }
  if (report.failed.length > 0) {
    lines.push(
      `${report.failed.length} 本資料有誤，沒有還原：${names(report.failed.map((f) => f.ledger))}`,
    );
  }
  if (report.personalExpensesAdded > 0) {
    lines.push(`個人消費補進 ${report.personalExpensesAdded} 筆`);
  }
  return lines.length > 0 ? lines.join("\n") : "備份裡沒有任何帳本";
}
