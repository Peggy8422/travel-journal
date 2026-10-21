import { ok, type Result } from "../../../domain/common/result";
import {
  parseAmountInput,
  parseShareInputs,
  remainingToAllocate,
  type CurrencyCode,
  type ExpenseFx,
  type LedgerError,
  type MemberId,
  type SplitRule,
} from "../../../domain/ledger";
import { expenseFxFromResolution, manualFx } from "./expenseFx";
import { toLocalIsoString } from "./localTimestamp";
import type { FxRateResolution, ResolveFxRateError } from "./resolveFxRate";

/*
 * 新增／編輯消費表單裡的判斷，獨立出來以便測試。
 */

export interface FxChoice {
  readonly isForeign: boolean;
  /** 使用者手動輸入的匯率；null 代表沒有手動輸入 */
  readonly manualRate: string | null;
  /** 編輯時沿用的原本匯率（幣別或時間改了就會被清掉） */
  readonly storedFx: ExpenseFx | undefined;
  /** 這次查詢的結果；查詢中或沒有查詢時為 undefined */
  readonly resolution: Result<FxRateResolution, ResolveFxRateError> | undefined;
}

/**
 * 決定要存的匯率，優先順序：基準幣不需要 → 手動輸入 → 原本的匯率 → 這次查到的臺銀匯率。
 * 回傳 undefined 代表還缺匯率（查詢中、查詢失敗，或需要手動輸入但還沒輸入）。
 */
export function chooseExpenseFx(
  choice: FxChoice,
): ExpenseFx | null | undefined {
  if (!choice.isForeign) return null;
  if (choice.manualRate !== null) return manualFx(choice.manualRate.trim());
  if (choice.storedFx) return choice.storedFx;
  if (!choice.resolution?.ok) return undefined;
  return expenseFxFromResolution(choice.resolution.value);
}

/**
 * 決定要存的消費時間。編輯時沒改過時間就原樣保留原本的字串（例如在東京記的 +09:00），
 * 不換成目前裝置的時區；新增或改過時間時，存成選擇的時間加上裝置當下的時區。
 */
export function resolveOccurredAt(
  original: string | undefined,
  touched: boolean,
  picked: Date,
  offsetMinutes?: number,
): string {
  if (original !== undefined && !touched) return original;
  return toLocalIsoString(picked, offsetMinutes);
}

/** 備註去掉前後空白；只有空白時存成 null，不存空字串 */
export function normalizeNote(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

/** 表單裡分攤方式的草稿：平均分攤記勾選的人，指定金額記每人輸入框的文字 */
export type SplitDraft =
  | { readonly kind: "equal"; readonly participantIds: readonly MemberId[] }
  | {
      readonly kind: "exact";
      readonly shareTexts: Readonly<Record<MemberId, string>>;
    };

/**
 * 把草稿轉成要存的分攤規則，成員一律依 memberOrder（加入順序）排列。
 * 只檢查輸入格式；人數、加總等規則交給 computeShares 在儲存時檢查。
 */
export function buildSplitRule(
  draft: SplitDraft,
  memberOrder: readonly MemberId[],
  currency: CurrencyCode,
): Result<SplitRule, LedgerError> {
  if (draft.kind === "equal") {
    return ok({
      kind: "equal",
      participantIds: memberOrder.filter((id) =>
        draft.participantIds.includes(id),
      ),
    });
  }
  const shares = parseShareInputs(
    memberOrder.map((memberId) => ({
      memberId,
      text: draft.shareTexts[memberId] ?? "",
    })),
    currency,
  );
  return shares.ok ? ok({ kind: "exact", shares: shares.value }) : shares;
}

/**
 * 指定金額時「還剩多少沒分配」（最小單位，負數代表超出）。
 * 總金額或任一欄位還不是有效金額時回傳 undefined，畫面就先不顯示。
 */
export function previewRemaining(
  amountText: string,
  shareTexts: Readonly<Record<MemberId, string>>,
  memberOrder: readonly MemberId[],
  currency: CurrencyCode,
): number | undefined {
  const total = parseAmountInput(amountText, currency);
  if (!total.ok) return undefined;
  const shares = parseShareInputs(
    memberOrder.map((memberId) => ({
      memberId,
      text: shareTexts[memberId] ?? "",
    })),
    currency,
  );
  return shares.ok ? remainingToAllocate(total.value, shares.value) : undefined;
}
