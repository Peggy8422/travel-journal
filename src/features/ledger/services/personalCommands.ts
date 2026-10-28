import { createRepositories } from "../../../data/repositories";
import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { err, ok, type Result } from "../../../domain/common/result";
import {
  collectPersonalEntries,
  type ExpenseRecord,
  type LedgerError,
  type LedgerRecord,
  type LedgerSnapshot,
  type MemberRecord,
  type PersonalEntry,
} from "../../../domain/ledger";
import {
  addExpense,
  deleteExpense,
  updateExpense,
  type CommandResult,
  type ExpenseInput,
  type LedgerCommandDeps,
} from "./ledgerCommands";

/*
 * 個人分頁：個人消費存在一本隱藏的個人帳本（kind = personal，只有「我」一位成員），
 * 不出現在帳本列表。付款人與分攤固定是「我」，所以輸入時不需要這兩個欄位。
 * 個人分頁只能修改個人帳本的消費；分帳消費要回原本的帳本修改。
 */

const PERSONAL_LEDGER_NAME = "個人";
const SELF_NAME = "我";

/** 個人消費的輸入；付款人與分攤由這一層補上 */
export type PersonalExpenseInput = Omit<ExpenseInput, "payerId" | "split">;

/** 取得個人帳本，還沒有時建立（含「我」這位成員） */
export async function ensurePersonalLedger(
  deps: LedgerCommandDeps,
): Promise<{ ledger: LedgerRecord; self: MemberRecord }> {
  return deps.db.transaction(async (tx) => {
    const repos = createRepositories(tx);
    const existing = await repos.ledgers.findPersonal();
    if (existing) {
      const members = await repos.members.listByLedger(existing.id);
      const self = members.find((m) => m.isSelf);
      if (!self) {
        throw new Error(`Personal ledger ${existing.id} has no self member`);
      }
      return { ledger: existing, self };
    }

    const timestamp = deps.now().toISOString();
    const ledger: LedgerRecord = {
      id: deps.newId(),
      kind: "personal",
      name: PERSONAL_LEDGER_NAME,
      baseCurrency: "TWD",
      cover: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await repos.ledgers.insert(ledger);
    const member = await repos.members.insert({
      id: deps.newId(),
      ledgerId: ledger.id,
      name: SELF_NAME,
      createdAt: timestamp,
    });
    await repos.members.setSelf(ledger.id, member.id);
    return { ledger, self: { ...member, isSelf: true } };
  });
}

export async function addPersonalExpense(
  deps: LedgerCommandDeps,
  input: PersonalExpenseInput,
): CommandResult<ExpenseRecord> {
  const { ledger, self } = await ensurePersonalLedger(deps);
  return addExpense(deps, ledger.id, withSelf(input, self));
}

/** 只能修改個人帳本的消費；分帳消費回傳 EXPENSE_NOT_FOUND */
export async function updatePersonalExpense(
  deps: LedgerCommandDeps,
  expenseId: string,
  input: PersonalExpenseInput,
): CommandResult<ExpenseRecord> {
  const owner = await findPersonalOwner(deps, expenseId);
  if (!owner) return err({ code: "EXPENSE_NOT_FOUND", expenseId });
  return updateExpense(deps, expenseId, withSelf(input, owner.self));
}

/** 只能刪除個人帳本的消費；分帳消費回傳 EXPENSE_NOT_FOUND */
export async function deletePersonalExpense(
  deps: LedgerCommandDeps,
  expenseId: string,
): CommandResult<void> {
  const owner = await findPersonalOwner(deps, expenseId);
  if (!owner) return err({ code: "EXPENSE_NOT_FOUND", expenseId });
  return deleteExpense(deps, expenseId);
}

/** 讀取一筆個人消費（給編輯畫面用）；不是個人帳本的消費回傳 undefined */
export async function findPersonalExpense(
  db: SqlExecutor,
  expenseId: string,
): Promise<ExpenseRecord | undefined> {
  const repos = createRepositories(db);
  const [personal, expense] = await Promise.all([
    repos.ledgers.findPersonal(),
    repos.expenses.findById(expenseId),
  ]);
  return expense &&
    personal &&
    expense.ledgerId === personal.id &&
    expense.deletedAt === null
    ? expense
    : undefined;
}

export interface PersonalSpendingData {
  /** 所有月份的個人花費 */
  readonly entries: readonly PersonalEntry[];
  /** 還沒指定「我是誰」的分帳帳本，這些帳本的消費不會算進個人花費 */
  readonly ledgersWithoutSelf: readonly LedgerRecord[];
}

/** 讀出個人帳本與所有分帳帳本，算出「我」的每一筆花費 */
export async function loadPersonalSpending(
  db: SqlExecutor,
): Promise<Result<PersonalSpendingData, LedgerError>> {
  const repos = createRepositories(db);
  const snapshots: LedgerSnapshot[] = [];
  const ledgersWithoutSelf: LedgerRecord[] = [];

  for (const ledger of await repos.ledgers.list()) {
    const members = await repos.members.listByLedger(ledger.id);
    if (!members.some((m) => m.isSelf)) {
      if (ledger.kind === "shared") ledgersWithoutSelf.push(ledger);
      continue;
    }
    const expenses = await repos.expenses.listByLedger(ledger.id);
    snapshots.push({ ledger, members, expenses });
  }

  const entries = collectPersonalEntries(snapshots);
  if (!entries.ok) return entries;
  return ok({ entries: entries.value, ledgersWithoutSelf });
}

function withSelf(
  input: PersonalExpenseInput,
  self: MemberRecord,
): ExpenseInput {
  return {
    ...input,
    payerId: self.id,
    split: { kind: "equal", participantIds: [self.id] },
  };
}

async function findPersonalOwner(
  deps: LedgerCommandDeps,
  expenseId: string,
): Promise<{ self: MemberRecord } | undefined> {
  const expense = await findPersonalExpense(deps.db, expenseId);
  if (!expense) return undefined;
  const members = await createRepositories(deps.db).members.listByLedger(
    expense.ledgerId,
  );
  const self = members.find((m) => m.isSelf);
  return self && { self };
}

/** 編輯畫面需要的資料：個人消費與個人帳本的「我」；不是個人消費時回傳 undefined */
export async function loadPersonalExpenseForEdit(
  db: SqlExecutor,
  expenseId: string,
): Promise<{ expense: ExpenseRecord; self: MemberRecord } | undefined> {
  const expense = await findPersonalExpense(db, expenseId);
  if (!expense) return undefined;
  const members = await createRepositories(db).members.listByLedger(
    expense.ledgerId,
  );
  const self = members.find((m) => m.isSelf);
  return self && { expense, self };
}
