import { err, ok, type Result } from "../common/result";
import type { LedgerError } from "./errors";
import type { Ledger, Settlement } from "./types";
import { validateMemberExists, validatePositiveAmount } from "./validation";

/** 驗證一筆結算紀錄（某人付錢給另一人）是否合法 */
export function validateSettlement(
  settlement: Settlement,
  ledger: Ledger,
): Result<Settlement, LedgerError> {
  const amount = validatePositiveAmount(settlement.amountMinor);
  if (!amount.ok) return amount;

  const from = validateMemberExists(ledger, settlement.fromId);
  if (!from.ok) return from;

  const to = validateMemberExists(ledger, settlement.toId);
  if (!to.ok) return to;

  if (settlement.fromId === settlement.toId) {
    return err({ code: "SELF_SETTLEMENT", memberId: settlement.fromId });
  }
  return ok(settlement);
}
