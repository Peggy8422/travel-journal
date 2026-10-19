import type { SqlExecutor } from "../db/sqlDatabase";
import { createBotQuoteCacheRepository } from "./botQuoteCacheRepository";
import { createExpenseRepository } from "./expenseRepository";
import { createLedgerRepository } from "./ledgerRepository";
import { createMemberRepository } from "./memberRepository";
import { createSettlementRepository } from "./settlementRepository";

export { StoredDataError } from "./shared";

/**
 * 建立一組共用同一個連線的 repository。
 * 需要 transaction 時，在 db.transaction 的 task 裡用 tx 再呼叫一次，
 * 讓所有寫入都經過同一個 transaction。
 */
export function createRepositories(
  db: SqlExecutor,
  now: () => Date = () => new Date(),
) {
  return {
    ledgers: createLedgerRepository(db),
    members: createMemberRepository(db),
    expenses: createExpenseRepository(db),
    settlements: createSettlementRepository(db),
    botQuotes: createBotQuoteCacheRepository(db, now),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
