import { err, ok, type Result } from "../common/result";
import { allocateByWeights } from "./allocate";
import { convertToBase } from "./currency";
import type { LedgerError } from "./errors";
import type { Expense, Ledger, MemberId, Shares, SplitRule } from "./types";
import {
  isPositiveSafeInteger,
  validateMemberExists,
  validatePositiveAmount,
} from "./validation";

interface WeightedParticipant {
  readonly memberId: MemberId;
  readonly weight: number;
}

/**
 * 計算一筆消費中每位參與者應負擔的基準幣金額。
 * 流程：驗證 → 先把總額換算成基準幣（只四捨五入一次）→ 依權重以最大餘數法分配。
 * 回傳的份額加總必定等於換算後的總額。
 *
 * UI 在儲存消費前也應呼叫此函式，用回傳的錯誤擋下不合法的輸入。
 */
export function computeShares(
  expense: Expense,
  ledger: Ledger,
): Result<Shares, LedgerError> {
  const amount = validatePositiveAmount(expense.amountMinor);
  if (!amount.ok) return amount;

  const payer = validateMemberExists(ledger, expense.payerId);
  if (!payer.ok) return payer;

  const participants = resolveWeightedParticipants(
    expense.split,
    expense.amountMinor,
    ledger,
  );
  if (!participants.ok) return participants;

  const baseTotal = convertToBase(
    expense.amountMinor,
    expense.currency,
    ledger.baseCurrency,
    expense.fxRateToBase,
  );
  if (!baseTotal.ok) return baseTotal;

  const amounts = allocateByWeights(
    baseTotal.value,
    participants.value.map((p) => p.weight),
  );
  return ok(
    new Map(participants.value.map((p, i) => [p.memberId, amounts[i] ?? 0])),
  );
}

/** 把分攤規則轉成「依成員加入順序排列」的權重清單 */
function resolveWeightedParticipants(
  split: SplitRule,
  expenseAmountMinor: number,
  ledger: Ledger,
): Result<WeightedParticipant[], LedgerError> {
  const participants =
    split.kind === "equal"
      ? resolveEqualSplit(split.participantIds)
      : resolveExactSplit(split.shares, expenseAmountMinor);
  if (!participants.ok) return participants;

  const membership = validateParticipantsInLedger(participants.value, ledger);
  if (!membership.ok) return membership;

  return ok(sortByMemberOrder(participants.value, ledger));
}

function resolveEqualSplit(
  participantIds: readonly MemberId[],
): Result<WeightedParticipant[], LedgerError> {
  return ok(participantIds.map((memberId) => ({ memberId, weight: 1 })));
}

function resolveExactSplit(
  shares: readonly { memberId: MemberId; amountMinor: number }[],
  expenseAmountMinor: number,
): Result<WeightedParticipant[], LedgerError> {
  for (const share of shares) {
    if (!isPositiveSafeInteger(share.amountMinor)) {
      return err({
        code: "SHARE_NOT_POSITIVE_INTEGER",
        memberId: share.memberId,
        amountMinor: share.amountMinor,
      });
    }
  }
  const sum = shares.reduce((acc, s) => acc + s.amountMinor, 0);
  if (shares.length > 0 && sum !== expenseAmountMinor) {
    return err({
      code: "EXACT_SHARES_SUM_MISMATCH",
      expectedMinor: expenseAmountMinor,
      actualMinor: sum,
    });
  }
  return ok(
    shares.map((s) => ({ memberId: s.memberId, weight: s.amountMinor })),
  );
}

function validateParticipantsInLedger(
  participants: readonly WeightedParticipant[],
  ledger: Ledger,
): Result<void, LedgerError> {
  if (participants.length === 0) {
    return err({ code: "NO_PARTICIPANTS" });
  }
  const seen = new Set<MemberId>();
  for (const { memberId } of participants) {
    if (seen.has(memberId))
      return err({ code: "DUPLICATE_PARTICIPANT", memberId });
    seen.add(memberId);
    const exists = validateMemberExists(ledger, memberId);
    if (!exists.ok) return exists;
  }
  return ok(undefined);
}

function sortByMemberOrder(
  participants: readonly WeightedParticipant[],
  ledger: Ledger,
): WeightedParticipant[] {
  const order = new Map(ledger.members.map((m, index) => [m.id, index]));
  return [...participants].sort(
    (a, b) => (order.get(a.memberId) ?? 0) - (order.get(b.memberId) ?? 0),
  );
}
