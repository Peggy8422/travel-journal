import { err, ok, type Result } from "../common/result";
import type { LedgerError } from "./errors";
import type { Balances, Ledger, MemberId, Transfer } from "./types";

interface Position {
  readonly memberId: MemberId;
  readonly order: number;
  remaining: number;
}

/**
 * 把淨額轉成「誰付給誰多少」的轉帳清單。
 * 貪婪法：每一步讓目前欠最多的人付給目前應收最多的人。
 * 不保證理論上最少筆數，但最多 n - 1 筆，且結果可重現（平手依成員加入順序）。
 */
export function simplifyDebts(
  balances: Balances,
  ledger: Ledger,
): Result<Transfer[], LedgerError> {
  const sum = [...balances.values()].reduce((acc, v) => acc + v, 0);
  if (sum !== 0) {
    return err({ code: "BALANCES_NOT_ZERO_SUM", sumMinor: sum });
  }

  const order = new Map(ledger.members.map((m, index) => [m.id, index]));
  const toPosition = (memberId: MemberId, remaining: number): Position => ({
    memberId,
    order: order.get(memberId) ?? Number.MAX_SAFE_INTEGER,
    remaining,
  });

  const entries = [...balances.entries()];
  const debtors = entries
    .filter(([, v]) => v < 0)
    .map(([id, v]) => toPosition(id, -v));
  const creditors = entries
    .filter(([, v]) => v > 0)
    .map(([id, v]) => toPosition(id, v));

  const transfers: Transfer[] = [];
  for (;;) {
    const debtor = pickLargest(debtors);
    const creditor = pickLargest(creditors);
    if (!debtor || !creditor) break;

    const amountMinor = Math.min(debtor.remaining, creditor.remaining);
    transfers.push({
      fromId: debtor.memberId,
      toId: creditor.memberId,
      amountMinor,
    });
    debtor.remaining -= amountMinor;
    creditor.remaining -= amountMinor;
  }

  return ok(transfers);
}

/** 取剩餘金額最大的一位；平手時取加入順序較前者。沒有剩餘金額者視為已清空 */
function pickLargest(positions: readonly Position[]): Position | undefined {
  let best: Position | undefined;
  for (const p of positions) {
    if (p.remaining <= 0) continue;
    if (
      !best ||
      p.remaining > best.remaining ||
      (p.remaining === best.remaining && p.order < best.order)
    ) {
      best = p;
    }
  }
  return best;
}
