import type {
  ExpenseRecord,
  LedgerRecord,
  MemberRecord,
  SettlementRecord,
} from "./records";

/**
 * 一本帳本的完整資料，用於備份與還原。
 * 包含已刪除的消費與還款，還原後才能和原本完全一致。
 */
export interface LedgerBackup {
  readonly ledger: LedgerRecord;
  /** 依加入順序 */
  readonly members: readonly MemberRecord[];
  readonly expenses: readonly ExpenseRecord[];
  readonly settlements: readonly SettlementRecord[];
}
