import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import type { LedgerRecord } from "../../../domain/ledger";
import { loadLedgerSummary } from "./ledgerSummary";

/** 帳本列表上每一本的摘要 */
export type LedgerOverview =
  | {
      readonly kind: "ok";
      readonly ledger: LedgerRecord;
      /** 未封存的成員人數 */
      readonly activeMemberCount: number;
      /** 未刪除的消費筆數 */
      readonly expenseCount: number;
      /** 消費總額（基準幣最小單位） */
      readonly totalBaseMinor: number;
      /** 還款建議的筆數，0 代表沒有欠款 */
      readonly pendingTransferCount: number;
    }
  /** 這本帳本的資料有誤，算不出摘要；只影響這一本，不影響整個列表 */
  | { readonly kind: "invalid"; readonly ledger: LedgerRecord };

/** 所有分帳帳本的摘要，依建立時間由新到舊 */
export async function loadLedgerOverviews(
  db: SqlExecutor,
): Promise<LedgerOverview[]> {
  // 個人帳本不出現在帳本列表
  const ledgers = await createRepositories(db).ledgers.list({ kind: "shared" });
  const overviews: LedgerOverview[] = [];
  for (const ledger of ledgers) {
    const summary = await loadLedgerSummary(db, ledger.id);
    if (!summary.ok) {
      overviews.push({ kind: "invalid", ledger });
      continue;
    }
    const { members, expenses, expenseBaseAmounts, transfers } = summary.value;
    overviews.push({
      kind: "ok",
      ledger,
      activeMemberCount: members.filter((m) => m.archivedAt === null).length,
      expenseCount: expenses.length,
      totalBaseMinor: [...expenseBaseAmounts.values()].reduce(
        (sum, amount) => sum + amount,
        0,
      ),
      pendingTransferCount: transfers.length,
    });
  }
  return overviews;
}
