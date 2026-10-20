import { err, ok, type Result } from "../common/result";
import { parseAmountInput } from "./amount";
import type { LedgerError } from "./errors";
import type { CurrencyCode, ExactShare, MemberId } from "./types";

/** 指定金額分攤時，每位成員輸入框裡的文字 */
export interface ShareInput {
  readonly memberId: MemberId;
  readonly text: string;
}

/**
 * 把每位成員輸入的金額轉成 ExactShare。空白代表不分攤，直接略過。
 * 任一欄格式錯誤時回傳 INVALID_SHARE_INPUT，指出是哪位成員，讓畫面標在對的欄位上。
 * 加總是否等於消費金額由 computeShares 檢查。
 */
export function parseShareInputs(
  inputs: readonly ShareInput[],
  currency: CurrencyCode,
): Result<ExactShare[], LedgerError> {
  const shares: ExactShare[] = [];
  for (const { memberId, text } of inputs) {
    if (text.trim() === "") continue;
    const amount = parseAmountInput(text, currency);
    if (!amount.ok) {
      return err({
        code: "INVALID_SHARE_INPUT",
        memberId,
        cause: amount.error,
      });
    }
    shares.push({ memberId, amountMinor: amount.value });
  }
  return ok(shares);
}

/** 還沒分配的金額（最小單位）。負數代表分配超過總額 */
export function remainingToAllocate(
  totalMinor: number,
  shares: readonly ExactShare[],
): number {
  return shares.reduce((rest, share) => rest - share.amountMinor, totalMinor);
}
