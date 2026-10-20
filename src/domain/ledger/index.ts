// 分帳模組的公開 API。其他層只從這裡 import，不直接引用內部檔案。
export type {
  Balances,
  CurrencyCode,
  ExactShare,
  Expense,
  Ledger,
  Member,
  MemberId,
  Settlement,
  Shares,
  SplitRule,
  Transfer,
} from "./types";
export type { LedgerError } from "./errors";
export type {
  ExpenseFx,
  ExpenseRecord,
  FxRateSource,
  GeoPoint,
  LedgerRecord,
  MemberRecord,
  SettlementRecord,
} from "./records";
export {
  expenseMemberIds,
  toExpense,
  toLedger,
  toSettlement,
  validateNoArchivedMembers,
} from "./records";
export type {
  ExpenseRepository,
  LedgerRepository,
  MemberRepository,
  NewMember,
  SettlementRepository,
} from "./ports";
export { computeShares } from "./split";
export { computeBalances } from "./balance";
export { simplifyDebts } from "./simplify";
export { findExpenseStatuses, type ExpenseStatus } from "./expenseStatus";
export {
  computeLedgerStats,
  type CategoryTotal,
  type LedgerStats,
  type MemberSpending,
} from "./stats";
export { validateSettlement } from "./settlement";
export {
  convertToBase,
  getCurrencyDecimals,
  parseFxRate,
  SUPPORTED_CURRENCIES,
} from "./currency";
export { formatMinorAmount, parseAmountInput, toAmountInput } from "./amount";
export {
  parseShareInputs,
  remainingToAllocate,
  type ShareInput,
} from "./exactSplitInput";
export {
  EXPENSE_CATEGORIES,
  isExpenseCategory,
  type ExpenseCategory,
} from "./categories";
