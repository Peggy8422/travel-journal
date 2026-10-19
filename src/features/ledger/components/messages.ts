import type { LedgerCommandError } from "../services/ledgerCommands";
import type { LedgerSummaryError } from "../services/ledgerSummary";
import type {
  ManualReason,
  ResolveFxRateError,
} from "../services/resolveFxRate";

type DisplayableError =
  LedgerCommandError | LedgerSummaryError | ResolveFxRateError;

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
