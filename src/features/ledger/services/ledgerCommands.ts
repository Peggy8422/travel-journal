import { err, ok, type Result } from "../../../domain/common/result";
import { toTaipeiDate } from "../../../domain/fx";
import {
  computeShares,
  expenseMemberIds,
  toExpense,
  toLedger,
  toSettlement,
  validateNoArchivedMembers,
  validateSettlement,
  type ExpenseRecord,
  type LedgerError,
  type LedgerRecord,
  type MemberId,
  type MemberRecord,
  type SettlementRecord,
} from "../../../domain/ledger";
import type { SqlDatabase } from "../../../data/db/sqlDatabase";
import {
  createRepositories,
  type Repositories,
} from "../../../data/repositories";

/*
 * 帳本的寫入流程：產生 id 與時間 → 用 domain 函式驗證 → 寫入資料庫。
 * 驗證失敗回傳 Result；資料庫錯誤（I/O、違反約束）直接 throw，代表程式有 bug。
 */

/** 帳本的基準幣別固定為新台幣 */
const BASE_CURRENCY = "TWD";

export interface LedgerCommandDeps {
  readonly db: SqlDatabase;
  readonly newId: () => string;
  readonly now: () => Date;
}

export type LedgerCommandError =
  | LedgerError
  | { readonly code: "EMPTY_NAME" }
  | { readonly code: "NO_MEMBERS" }
  | { readonly code: "INVALID_TIMESTAMP"; readonly value: string }
  | { readonly code: "LEDGER_NOT_FOUND"; readonly ledgerId: string }
  | { readonly code: "EXPENSE_NOT_FOUND"; readonly expenseId: string }
  | { readonly code: "SETTLEMENT_NOT_FOUND"; readonly settlementId: string };

type CommandResult<T> = Promise<Result<T, LedgerCommandError>>;

/** 使用者輸入的消費內容；id、帳本與時間戳記由這一層補上 */
export type ExpenseInput = Omit<
  ExpenseRecord,
  "id" | "ledgerId" | "createdAt" | "updatedAt" | "deletedAt"
>;

export type SettlementInput = Pick<
  SettlementRecord,
  "fromId" | "toId" | "amountMinor" | "settledAt"
>;

/** 建立帳本與初始成員（依傳入順序加入），在同一個 transaction 完成 */
export async function createLedger(
  deps: LedgerCommandDeps,
  input: { readonly name: string; readonly memberNames: readonly string[] },
): CommandResult<{ ledger: LedgerRecord; members: MemberRecord[] }> {
  const name = input.name.trim();
  if (name === "") return err({ code: "EMPTY_NAME" });
  const memberNames = input.memberNames.map((n) => n.trim());
  if (memberNames.length === 0) return err({ code: "NO_MEMBERS" });
  if (memberNames.some((n) => n === "")) return err({ code: "EMPTY_NAME" });

  const timestamp = deps.now().toISOString();
  const ledger: LedgerRecord = {
    id: deps.newId(),
    name,
    baseCurrency: BASE_CURRENCY,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const members = await deps.db.transaction(async (tx) => {
    const repos = createRepositories(tx);
    await repos.ledgers.insert(ledger);
    const inserted: MemberRecord[] = [];
    for (const memberName of memberNames) {
      inserted.push(
        await repos.members.insert({
          id: deps.newId(),
          ledgerId: ledger.id,
          name: memberName,
          createdAt: timestamp,
        }),
      );
    }
    return inserted;
  });
  return ok({ ledger, members });
}

export async function addMember(
  deps: LedgerCommandDeps,
  ledgerId: string,
  name: string,
): CommandResult<MemberRecord> {
  const trimmed = name.trim();
  if (trimmed === "") return err({ code: "EMPTY_NAME" });
  const repos = createRepositories(deps.db);
  if (!(await repos.ledgers.findById(ledgerId))) {
    return err({ code: "LEDGER_NOT_FOUND", ledgerId });
  }
  return ok(
    await repos.members.insert({
      id: deps.newId(),
      ledgerId,
      name: trimmed,
      createdAt: deps.now().toISOString(),
    }),
  );
}

export async function addExpense(
  deps: LedgerCommandDeps,
  ledgerId: string,
  input: ExpenseInput,
): CommandResult<ExpenseRecord> {
  const timestamp = deps.now().toISOString();
  const expense: ExpenseRecord = {
    ...input,
    id: deps.newId(),
    ledgerId,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
  const repos = createRepositories(deps.db);
  const valid = await validateExpense(repos, expense, []);
  if (!valid.ok) return valid;

  await repos.expenses.insert(expense);
  return ok(expense);
}

/** 以 input 覆寫整筆消費。原本就在消費裡的封存成員可以保留 */
export async function updateExpense(
  deps: LedgerCommandDeps,
  expenseId: string,
  input: ExpenseInput,
): CommandResult<ExpenseRecord> {
  const repos = createRepositories(deps.db);
  const existing = await repos.expenses.findById(expenseId);
  if (!existing || existing.deletedAt !== null) {
    return err({ code: "EXPENSE_NOT_FOUND", expenseId });
  }

  const expense: ExpenseRecord = {
    ...input,
    id: existing.id,
    ledgerId: existing.ledgerId,
    createdAt: existing.createdAt,
    updatedAt: deps.now().toISOString(),
    deletedAt: null,
  };
  const valid = await validateExpense(
    repos,
    expense,
    expenseMemberIds(existing),
  );
  if (!valid.ok) return valid;

  await repos.expenses.update(expense);
  return ok(expense);
}

export async function deleteExpense(
  deps: LedgerCommandDeps,
  expenseId: string,
): CommandResult<void> {
  const repos = createRepositories(deps.db);
  const existing = await repos.expenses.findById(expenseId);
  if (!existing || existing.deletedAt !== null) {
    return err({ code: "EXPENSE_NOT_FOUND", expenseId });
  }
  await repos.expenses.softDelete(expenseId, deps.now().toISOString());
  return ok(undefined);
}

/** 封存的成員仍可以參與結算，例如提早離開的人之後再還錢 */
export async function addSettlement(
  deps: LedgerCommandDeps,
  ledgerId: string,
  input: SettlementInput,
): CommandResult<SettlementRecord> {
  if (!toTaipeiDate(input.settledAt).ok) {
    return err({ code: "INVALID_TIMESTAMP", value: input.settledAt });
  }
  const repos = createRepositories(deps.db);
  const loaded = await loadLedger(repos, ledgerId);
  if (!loaded.ok) return loaded;

  const timestamp = deps.now().toISOString();
  const settlement: SettlementRecord = {
    ...input,
    id: deps.newId(),
    ledgerId,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
  const valid = validateSettlement(
    toSettlement(settlement),
    toLedger(loaded.value.ledger, loaded.value.members),
  );
  if (!valid.ok) return valid;

  await repos.settlements.insert(settlement);
  return ok(settlement);
}

export async function deleteSettlement(
  deps: LedgerCommandDeps,
  settlementId: string,
): CommandResult<void> {
  const repos = createRepositories(deps.db);
  const existing = await repos.settlements.findById(settlementId);
  if (!existing || existing.deletedAt !== null) {
    return err({ code: "SETTLEMENT_NOT_FOUND", settlementId });
  }
  await repos.settlements.softDelete(settlementId, deps.now().toISOString());
  return ok(undefined);
}

async function loadLedger(
  repos: Repositories,
  ledgerId: string,
): CommandResult<{ ledger: LedgerRecord; members: MemberRecord[] }> {
  const ledger = await repos.ledgers.findById(ledgerId);
  if (!ledger) return err({ code: "LEDGER_NOT_FOUND", ledgerId });
  return ok({ ledger, members: await repos.members.listByLedger(ledgerId) });
}

async function validateExpense(
  repos: Repositories,
  expense: ExpenseRecord,
  alreadyIncluded: readonly MemberId[],
): CommandResult<void> {
  if (!toTaipeiDate(expense.occurredAt).ok) {
    return err({ code: "INVALID_TIMESTAMP", value: expense.occurredAt });
  }
  const loaded = await loadLedger(repos, expense.ledgerId);
  if (!loaded.ok) return loaded;
  const { ledger, members } = loaded.value;

  const active = validateNoArchivedMembers(
    expenseMemberIds(expense),
    members,
    alreadyIncluded,
  );
  if (!active.ok) return active;

  const shares = computeShares(toExpense(expense), toLedger(ledger, members));
  if (!shares.ok) return shares;
  return ok(undefined);
}
