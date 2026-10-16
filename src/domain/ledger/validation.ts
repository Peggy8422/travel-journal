import { err, ok, type Result } from "../common/result";
import type { LedgerError } from "./errors";
import type { Ledger, MemberId } from "./types";

export function validatePositiveAmount(
  amountMinor: number,
): Result<number, LedgerError> {
  return isPositiveSafeInteger(amountMinor)
    ? ok(amountMinor)
    : err({ code: "AMOUNT_NOT_POSITIVE_INTEGER", amountMinor });
}

export function validateMemberExists(
  ledger: Ledger,
  memberId: MemberId,
): Result<MemberId, LedgerError> {
  return ledger.members.some((m) => m.id === memberId)
    ? ok(memberId)
    : err({ code: "UNKNOWN_MEMBER", memberId });
}

export function isPositiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}
