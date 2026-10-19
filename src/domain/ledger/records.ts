import { err, ok, type Result } from "../common/result";
import type { RateBasis } from "../fx/types";
import type { LedgerError } from "./errors";
import type {
  CurrencyCode,
  Expense,
  Ledger,
  MemberId,
  Settlement,
  SplitRule,
} from "./types";

/*
 * 儲存與顯示用的完整紀錄。
 * types.ts 的 Ledger、Expense 等只保留計算需要的欄位，
 * 名稱、時間、匯率來源這些資訊放在這裡，要計算時再用 to* 函式取出計算用的部分。
 * 時間戳記（createdAt 等）一律是 ISO 8601 UTC 字串。
 */

export interface LedgerRecord {
  readonly id: string;
  readonly name: string;
  readonly baseCurrency: CurrencyCode;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MemberRecord {
  readonly id: MemberId;
  readonly ledgerId: string;
  readonly name: string;
  /** 加入順序，由 repository 在新增時指派，之後不會改變 */
  readonly sortOrder: number;
  /** 封存的成員不能再被選為新消費的參與者，但舊資料仍會參與計算 */
  readonly archivedAt: string | null;
  readonly createdAt: string;
}

export type FxRateSource = "bot-live" | "bot-cached" | "manual";

/** 消費使用的匯率與來源。手動輸入時沒有臺銀報價日期與報價種類 */
export type ExpenseFx =
  | { readonly rateToBase: string; readonly source: "manual" }
  | {
      readonly rateToBase: string;
      readonly source: "bot-live" | "bot-cached";
      /** 實際使用的臺銀報價日期（臺灣時間 YYYY-MM-DD） */
      readonly quoteDate: string;
      readonly basis: RateBasis;
    };

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export interface ExpenseRecord {
  readonly id: string;
  readonly ledgerId: string;
  readonly payerId: MemberId;
  /** 原幣金額，以該幣別最小單位表示的正整數 */
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  /** 原幣與基準幣相同時為 null */
  readonly fx: ExpenseFx | null;
  readonly split: SplitRule;
  readonly title: string;
  readonly note: string | null;
  readonly category: string | null;
  readonly placeName: string | null;
  readonly location: GeoPoint | null;
  /** 消費當地時間，必須帶時區，例如 2026-10-12T10:00:00+09:00 */
  readonly occurredAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface SettlementRecord {
  readonly id: string;
  readonly ledgerId: string;
  readonly fromId: MemberId;
  readonly toId: MemberId;
  /** 基準幣最小單位的正整數 */
  readonly amountMinor: number;
  /** 實際還款時間，必須帶時區 */
  readonly settledAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

/** 消費涉及的所有成員：付款人與分攤對象 */
export function expenseMemberIds(
  expense: Pick<ExpenseRecord, "payerId" | "split">,
): MemberId[] {
  const participants =
    expense.split.kind === "equal"
      ? expense.split.participantIds
      : expense.split.shares.map((s) => s.memberId);
  return [...new Set([expense.payerId, ...participants])];
}

/**
 * 封存的成員不能被加進消費。
 * 編輯既有消費時傳入 alreadyIncluded，原本就在消費裡的封存成員可以保留，避免舊消費無法修改。
 * 不在帳本裡的成員交給 computeShares 回報 UNKNOWN_MEMBER。
 */
export function validateNoArchivedMembers(
  memberIds: readonly MemberId[],
  members: readonly MemberRecord[],
  alreadyIncluded: readonly MemberId[] = [],
): Result<void, LedgerError> {
  const archived = new Set(
    members.filter((m) => m.archivedAt !== null).map((m) => m.id),
  );
  const added = memberIds.find(
    (id) => archived.has(id) && !alreadyIncluded.includes(id),
  );
  return added === undefined
    ? ok(undefined)
    : err({ code: "ARCHIVED_MEMBER", memberId: added });
}

/** 組出計算用的 Ledger。成員依加入順序排列，封存的成員也包含在內 */
export function toLedger(
  ledger: LedgerRecord,
  members: readonly MemberRecord[],
): Ledger {
  return {
    id: ledger.id,
    baseCurrency: ledger.baseCurrency,
    members: [...members]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({ id: m.id })),
  };
}

export function toExpense(record: ExpenseRecord): Expense {
  return {
    id: record.id,
    payerId: record.payerId,
    amountMinor: record.amountMinor,
    currency: record.currency,
    ...(record.fx && { fxRateToBase: record.fx.rateToBase }),
    split: record.split,
    deletedAt: record.deletedAt,
  };
}

export function toSettlement(record: SettlementRecord): Settlement {
  return {
    id: record.id,
    fromId: record.fromId,
    toId: record.toId,
    amountMinor: record.amountMinor,
    deletedAt: record.deletedAt,
  };
}
