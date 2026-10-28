import { err, ok, type Result } from "../common/result";

/**
 * 文字欄位的字數上限，輸入框（maxLength）與建立、修改的指令共用同一份。
 * 以 JavaScript 字串長度（UTF-16）計算，和 TextInput 的 maxLength 一致：
 * 中文、英數字各算 1，部分 emoji 算 2。
 * 只限制新的輸入與修改；還原備份不檢查，舊資料超過上限也照常還原。
 */
export const TEXT_LIMITS = {
  ledgerName: 20,
  memberName: 10,
  expenseTitle: 30,
  placeName: 40,
  note: 200,
} as const;

export type LimitedTextField = keyof typeof TEXT_LIMITS;

export interface TextTooLongError {
  readonly code: "TEXT_TOO_LONG";
  readonly field: LimitedTextField;
  readonly max: number;
}

/** 超過該欄位的上限時回傳錯誤；null（沒填的選填欄位）一律通過 */
export function checkTextLength(
  field: LimitedTextField,
  text: string | null,
): Result<void, TextTooLongError> {
  const max = TEXT_LIMITS[field];
  if (text !== null && text.length > max) {
    return err({ code: "TEXT_TOO_LONG", field, max });
  }
  return ok(undefined);
}
