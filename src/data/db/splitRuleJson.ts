import { err, ok, type Result } from "../../domain/common/result";
import type { ExactShare, SplitRule } from "../../domain/ledger";

/*
 * expenses.split 欄位的 JSON 格式，與 domain 的 SplitRule 一一對應：
 *   { "kind": "equal", "participantIds": ["m1", "m2"] }
 *   { "kind": "exact", "shares": [{ "memberId": "m1", "amountMinor": 1200 }] }
 * 這裡只檢查結構；成員是否屬於帳本、金額加總是否正確由 domain 的 computeShares 檢查。
 */

export type SplitRuleJsonError = {
  readonly code: "INVALID_SPLIT_JSON";
  readonly reason: string;
};

export function encodeSplitRule(rule: SplitRule): string {
  // 明確挑出欄位，避免把呼叫端物件上多餘的屬性寫進資料庫
  return JSON.stringify(
    rule.kind === "equal"
      ? { kind: "equal", participantIds: rule.participantIds }
      : {
          kind: "exact",
          shares: rule.shares.map((s) => ({
            memberId: s.memberId,
            amountMinor: s.amountMinor,
          })),
        },
  );
}

export function decodeSplitRule(
  json: string,
): Result<SplitRule, SplitRuleJsonError> {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return invalid("not valid JSON");
  }
  if (!isObject(value)) return invalid("not an object");

  if (value.kind === "equal") {
    const ids = value.participantIds;
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
      return invalid("participantIds must be an array of strings");
    }
    return ok({ kind: "equal", participantIds: ids });
  }

  if (value.kind === "exact") {
    const shares = value.shares;
    if (!Array.isArray(shares) || !shares.every(isExactShare)) {
      return invalid("shares must be an array of { memberId, amountMinor }");
    }
    return ok({
      kind: "exact",
      shares: shares.map((s) => ({
        memberId: s.memberId,
        amountMinor: s.amountMinor,
      })),
    });
  }

  return invalid(`unknown kind: ${String(value.kind)}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExactShare(value: unknown): value is ExactShare {
  return (
    isObject(value) &&
    typeof value.memberId === "string" &&
    typeof value.amountMinor === "number"
  );
}

function invalid(reason: string): Result<never, SplitRuleJsonError> {
  return err({ code: "INVALID_SPLIT_JSON", reason });
}
