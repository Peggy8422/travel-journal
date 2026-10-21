import { createTestDatabase } from "../../../data/db/testDatabase";
import { summarizePersonalMonth } from "../../../domain/ledger";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";
import { collectBackup, restoreBackup } from "./backupCommands";
import {
  addExpense,
  createLedger,
  type LedgerCommandDeps,
} from "./ledgerCommands";
import { loadLedgerOverviews } from "./ledgerOverview";
import { setSelfMember } from "./memberCommands";
import {
  addPersonalExpense,
  deletePersonalExpense,
  ensurePersonalLedger,
  findPersonalExpense,
  loadPersonalSpending,
  updatePersonalExpense,
  type PersonalExpenseInput,
} from "./personalCommands";

/** prefix 讓不同的測試資料庫（模擬不同手機）產生不同的 id，實際 App 用 UUID */
async function setup(prefix = "id") {
  const db = await createTestDatabase();
  let seq = 0;
  let clock = Date.UTC(2026, 9, 12);
  const deps: LedgerCommandDeps = {
    db,
    newId: () => `${prefix}-${++seq}`,
    now: () => new Date((clock += 60_000)),
  };
  return { db, deps };
}

const coffee: PersonalExpenseInput = {
  amountMinor: 150,
  currency: "TWD",
  fx: null,
  title: "咖啡",
  note: null,
  category: "food",
  placeName: null,
  location: null,
  occurredAt: "2026-10-12T09:00:00+08:00",
};

/** 一本分帳帳本，Alice 是「我」，有一筆三人平分的晚餐 */
async function sharedTrip(deps: LedgerCommandDeps) {
  const { ledger, members } = unwrap(
    await createLedger(deps, {
      name: "東京",
      memberNames: ["Alice", "Bob", "Carol"],
      selfIndex: 0,
    }),
  );
  const [a, b, c] = members.map((m) => m.id) as [string, string, string];
  const dinner = unwrap(
    await addExpense(deps, ledger.id, {
      ...coffee,
      payerId: b,
      amountMinor: 900,
      split: { kind: "equal", participantIds: [a, b, c] },
      title: "晚餐",
      occurredAt: "2026-10-12T19:00:00+08:00",
    }),
  );
  return { ledger, members, dinner };
}

describe("personal ledger", () => {
  it("is created once and stays out of the ledger list", async () => {
    const { db, deps } = await setup();
    const first = await ensurePersonalLedger(deps);
    const second = await ensurePersonalLedger(deps);
    expect(second.ledger.id).toBe(first.ledger.id);
    expect(first.self).toMatchObject({ name: "我", isSelf: true });
    expect(await loadLedgerOverviews(db)).toEqual([]);
  });

  it("adds, edits and deletes personal expenses", async () => {
    const { db, deps } = await setup();
    const added = unwrap(await addPersonalExpense(deps, coffee));
    expect(await findPersonalExpense(db, added.id)).toMatchObject({
      title: "咖啡",
    });

    unwrap(
      await updatePersonalExpense(deps, added.id, { ...coffee, title: "拿鐵" }),
    );
    expect((await findPersonalExpense(db, added.id))?.title).toBe("拿鐵");

    unwrap(await deletePersonalExpense(deps, added.id));
    expect(await findPersonalExpense(db, added.id)).toBeUndefined();
  });

  it("refuses to edit or delete shared expenses from the personal page", async () => {
    const { db, deps } = await setup();
    const { dinner } = await sharedTrip(deps);
    expect(await findPersonalExpense(db, dinner.id)).toBeUndefined();
    expect(
      unwrapErr(await updatePersonalExpense(deps, dinner.id, coffee)).code,
    ).toBe("EXPENSE_NOT_FOUND");
    expect(unwrapErr(await deletePersonalExpense(deps, dinner.id)).code).toBe(
      "EXPENSE_NOT_FOUND",
    );
  });
});

describe("loadPersonalSpending", () => {
  it("combines personal expenses with my share of shared ones", async () => {
    const { db, deps } = await setup();
    await sharedTrip(deps);
    unwrap(await addPersonalExpense(deps, coffee));

    const data = unwrap(await loadPersonalSpending(db));
    const october = summarizePersonalMonth(data.entries, "2026-10");
    expect(
      october.entries.map((e) => [e.expense.title, e.source, e.myShareMinor]),
    ).toEqual([
      ["晚餐", "shared", 300],
      ["咖啡", "personal", 150],
    ]);
    expect([
      october.totalMinor,
      october.personalMinor,
      october.sharedMinor,
    ]).toEqual([450, 150, 300]);
    expect(data.ledgersWithoutSelf).toEqual([]);
  });

  it("lists shared ledgers where nobody is marked as me", async () => {
    const { db, deps } = await setup();
    const { ledger } = await sharedTrip(deps);
    unwrap(await setSelfMember(deps, ledger.id, null));

    const data = unwrap(await loadPersonalSpending(db));
    expect(data.entries).toEqual([]);
    expect(data.ledgersWithoutSelf.map((l) => l.name)).toEqual(["東京"]);
  });
});

describe("setSelfMember", () => {
  it("moves the self mark within a ledger", async () => {
    const { db, deps } = await setup();
    const { ledger, members } = await sharedTrip(deps);
    unwrap(await setSelfMember(deps, ledger.id, members[2]!.id));

    const data = unwrap(await loadPersonalSpending(db));
    // Carol 也是平分 300，但現在算的是 Carol 的份額
    expect(data.entries.map((e) => e.myShareMinor)).toEqual([300]);
  });

  it("rejects a member from another ledger and a missing ledger", async () => {
    const { deps } = await setup();
    const { ledger } = await sharedTrip(deps);
    const { self } = await ensurePersonalLedger(deps);
    expect(unwrapErr(await setSelfMember(deps, ledger.id, self.id)).code).toBe(
      "MEMBER_NOT_FOUND",
    );
    expect(unwrapErr(await setSelfMember(deps, "missing", null)).code).toBe(
      "LEDGER_NOT_FOUND",
    );
  });
});

describe("backup with personal data", () => {
  it("restores the personal ledger and self marks into an empty phone", async () => {
    const source = await setup();
    await sharedTrip(source.deps);
    unwrap(await addPersonalExpense(source.deps, coffee));
    const backup = await collectBackup(source.db);

    const target = await setup();
    const report = await restoreBackup(target.db, backup);
    expect(report.failed).toEqual([]);
    expect(await collectBackup(target.db)).toEqual(backup);
  });

  it("merges personal expenses into the phone's own personal ledger", async () => {
    const source = await setup();
    unwrap(await addPersonalExpense(source.deps, coffee));
    const backup = await collectBackup(source.db);

    const target = await setup("other-phone");
    unwrap(await addPersonalExpense(target.deps, { ...coffee, title: "早餐" }));
    const report = await restoreBackup(target.db, backup);
    expect(report.personalExpensesAdded).toBe(1);

    // 再還原一次不會重複
    expect((await restoreBackup(target.db, backup)).personalExpensesAdded).toBe(
      0,
    );
    const data = unwrap(await loadPersonalSpending(target.db));
    expect(data.entries.map((e) => e.expense.title).sort()).toEqual([
      "咖啡",
      "早餐",
    ]);
  });
});
