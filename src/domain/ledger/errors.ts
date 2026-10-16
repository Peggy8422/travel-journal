import type { MemberId } from "./types";

export type LedgerError =
  | { readonly code: "UNSUPPORTED_CURRENCY"; readonly currency: string }
  | {
      readonly code: "AMOUNT_NOT_POSITIVE_INTEGER";
      readonly amountMinor: number;
    }
  | {
      readonly code: "SHARE_NOT_POSITIVE_INTEGER";
      readonly memberId: MemberId;
      readonly amountMinor: number;
    }
  | { readonly code: "UNKNOWN_MEMBER"; readonly memberId: MemberId }
  | { readonly code: "NO_PARTICIPANTS" }
  | { readonly code: "DUPLICATE_PARTICIPANT"; readonly memberId: MemberId }
  | {
      readonly code: "EXACT_SHARES_SUM_MISMATCH";
      readonly expectedMinor: number;
      readonly actualMinor: number;
    }
  | { readonly code: "FX_RATE_REQUIRED" }
  | { readonly code: "FX_RATE_UNEXPECTED" }
  | { readonly code: "INVALID_FX_RATE"; readonly rate: string }
  | { readonly code: "CONVERTED_AMOUNT_ZERO" }
  | { readonly code: "CONVERTED_AMOUNT_TOO_LARGE" }
  | { readonly code: "SELF_SETTLEMENT"; readonly memberId: MemberId }
  | {
      readonly code: "INVALID_EXPENSE";
      readonly expenseId: string;
      readonly cause: LedgerError;
    }
  | {
      readonly code: "INVALID_SETTLEMENT";
      readonly settlementId: string;
      readonly cause: LedgerError;
    }
  | { readonly code: "BALANCES_NOT_ZERO_SUM"; readonly sumMinor: number };
