import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import { toTaipeiDate } from "../../../domain/fx";
import type { ExpenseRecord, LedgerRecord } from "../../../domain/ledger";
import { loadLedgerSummary } from "./ledgerSummary";

/** 帳本列表上每一本的摘要 */
export type LedgerOverview = (
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
  | { readonly kind: "invalid"; readonly ledger: LedgerRecord }
) & {
  /** 旅行月份 YYYY-MM，書架依它分組與篩選 */
  readonly tripMonth: string;
};

/**
 * 旅行月份：最早一筆消費在消費當地的月份；還沒有消費時用建立帳本的月份（臺灣時間）。
 * 帳本本身沒有旅行日期，用消費推算比建立時間準（常常出發前就先建好帳本）。
 */
export function tripMonthOf(
  ledger: LedgerRecord,
  expenses: readonly ExpenseRecord[],
): string {
  const first = expenses.reduce<ExpenseRecord | undefined>(
    (earliest, e) =>
      !earliest || Date.parse(e.occurredAt) < Date.parse(earliest.occurredAt)
        ? e
        : earliest,
    undefined,
  );
  if (first) return first.occurredAt.slice(0, 7);
  const created = toTaipeiDate(ledger.createdAt);
  return (created.ok ? created.value : ledger.createdAt).slice(0, 7);
}

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
      overviews.push({
        kind: "invalid",
        ledger,
        tripMonth: tripMonthOf(ledger, []),
      });
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
      tripMonth: tripMonthOf(ledger, expenses),
    });
  }
  return overviews;
}
