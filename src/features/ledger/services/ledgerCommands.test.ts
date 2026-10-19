import { createTestDatabase } from "../../../data/db/testDatabase";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";
import {
  addExpense,
  addMember,
  addSettlement,
  createLedger,
  deleteExpense,
  deleteSettlement,
  updateExpense,
  type ExpenseInput,
  type LedgerCommandDeps,
} from "./ledgerCommands";
import { loadLedgerSummary } from "./ledgerSummary";

const NOW = new Date("2026-10-12T03:00:00.000Z");

async function setup() {
  const db = await createTestDatabase();
  let seq = 0;
  const deps: LedgerCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => NOW,
  };
  const { ledger, members } = unwrap(
    await createLedger(deps, {
      name: "東京五日遊",
      memberNames: ["Alice", "Bob", "Carol"],
    }),
  );
  const [a, b, c] = members.map((m) => m.id) as [string, string, string];
  return { db, deps, ledgerId: ledger.id, a, b, c };
}

function ramen(payerId: string, participantIds: string[]): ExpenseInput {
  return {
    payerId,
    amountMinor: 3000,
    currency: "JPY",
    fx: {
      rateToBase: "0.2",
      source: "bot-live",
      quoteDate: "2026-10-12",
      basis: "spot",
    },
    split: { kind: "equal", participantIds },
    title: "拉麵",
    note: null,
    category: "food",
    placeName: null,
    location: null,
    occurredAt: "2026-10-12T12:00:00+09:00",
  };
}

describe("createLedger", () => {
  it("creates the ledger and its members in join order", async () => {
    const { db, ledgerId } = await setup();
    const summary = unwrap(await loadLedgerSummary(db, ledgerId));
    expect(summary.ledger).toMatchObject({
      name: "東京五日遊",
      baseCurrency: "TWD",
      createdAt: NOW.toISOString(),
    });
    expect(summary.members.map((m) => [m.name, m.sortOrder])).toEqual([
      ["Alice", 0],
      ["Bob", 1],
      ["Carol", 2],
    ]);
  });

  it.each([
    ["an empty ledger name", { name: "  ", memberNames: ["A"] }, "EMPTY_NAME"],
    ["no members", { name: "旅行", memberNames: [] }, "NO_MEMBERS"],
    [
      "an empty member name",
      { name: "旅行", memberNames: ["A", " "] },
      "EMPTY_NAME",
    ],
  ])("rejects %s", async (_, input, code) => {
    const { deps } = await setup();
    expect(unwrapErr(await createLedger(deps, input)).code).toBe(code);
  });

  it("writes nothing when a member insert fails", async () => {
    const { db, deps } = await setup();
    // Both members get the same id, so the second member insert fails
    const failing: LedgerCommandDeps = { ...deps, newId: () => "duplicate" };
    await expect(
      createLedger(failing, { name: "失敗", memberNames: ["A", "B"] }),
    ).rejects.toThrow();
    const row = await db.getFirstAsync<{ n: number }>(
      "SELECT count(*) AS n FROM ledgers WHERE name = '失敗'",
    );
    expect(row?.n).toBe(0);
  });
});

describe("addMember", () => {
  it("appends a member to an existing ledger", async () => {
    const { deps, ledgerId } = await setup();
    const dave = unwrap(await addMember(deps, ledgerId, " Dave "));
    expect(dave).toMatchObject({ name: "Dave", sortOrder: 3 });
  });

  it("reports a missing ledger", async () => {
    const { deps } = await setup();
    expect(unwrapErr(await addMember(deps, "missing", "Dave")).code).toBe(
      "LEDGER_NOT_FOUND",
    );
  });
});

describe("expenses", () => {
  it("adds an expense and reflects it in the summary", async () => {
    const { db, deps, ledgerId, a, b, c } = await setup();
    unwrap(await addExpense(deps, ledgerId, ramen(a, [a, b, c])));

    const summary = unwrap(await loadLedgerSummary(db, ledgerId));
    // 3000 JPY × 0.2 = 600 TWD，三人各 200
    expect(Object.fromEntries(summary.balances)).toEqual({
      [a]: 400,
      [b]: -200,
      [c]: -200,
    });
    expect(summary.transfers).toEqual([
      { fromId: b, toId: a, amountMinor: 200 },
      { fromId: c, toId: a, amountMinor: 200 },
    ]);
  });

  it("validates with domain rules before writing", async () => {
    const { db, deps, ledgerId, a } = await setup();
    const noFx = { ...ramen(a, [a]), fx: null };
    expect(unwrapErr(await addExpense(deps, ledgerId, noFx)).code).toBe(
      "FX_RATE_REQUIRED",
    );
    const stranger = ramen(a, ["stranger"]);
    expect(unwrapErr(await addExpense(deps, ledgerId, stranger)).code).toBe(
      "UNKNOWN_MEMBER",
    );
    const noZone = { ...ramen(a, [a]), occurredAt: "2026-10-12T12:00:00" };
    expect(unwrapErr(await addExpense(deps, ledgerId, noZone)).code).toBe(
      "INVALID_TIMESTAMP",
    );
    expect(unwrap(await loadLedgerSummary(db, ledgerId)).expenses).toEqual([]);
  });

  it("rejects archived members in a new expense", async () => {
    const { db, deps, ledgerId, a, c } = await setup();
    await db.runAsync("UPDATE members SET archived_at = 'x' WHERE id = ?", [c]);
    expect(
      unwrapErr(await addExpense(deps, ledgerId, ramen(a, [a, c]))),
    ).toEqual({ code: "ARCHIVED_MEMBER", memberId: c });
  });

  it("lets an edit keep archived members that were already included", async () => {
    const { db, deps, ledgerId, a, b, c } = await setup();
    const original = unwrap(await addExpense(deps, ledgerId, ramen(a, [a, c])));
    await db.runAsync("UPDATE members SET archived_at = 'x' WHERE id = ?", [c]);

    const edited = unwrap(
      await updateExpense(deps, original.id, {
        ...ramen(a, [a, c]),
        title: "沾麵",
      }),
    );
    expect(edited).toMatchObject({
      title: "沾麵",
      createdAt: original.createdAt,
    });
    // 原本不在消費裡的封存成員仍然不能加入
    await db.runAsync("UPDATE members SET archived_at = 'x' WHERE id = ?", [b]);
    expect(
      unwrapErr(await updateExpense(deps, original.id, ramen(a, [a, b, c]))),
    ).toEqual({ code: "ARCHIVED_MEMBER", memberId: b });
  });

  it("soft-deletes an expense and drops it from the summary", async () => {
    const { db, deps, ledgerId, a, b } = await setup();
    const expense = unwrap(await addExpense(deps, ledgerId, ramen(a, [a, b])));
    unwrap(await deleteExpense(deps, expense.id));

    const summary = unwrap(await loadLedgerSummary(db, ledgerId));
    expect(summary.expenses).toEqual([]);
    expect(summary.transfers).toEqual([]);
    expect(unwrapErr(await deleteExpense(deps, expense.id)).code).toBe(
      "EXPENSE_NOT_FOUND",
    );
    expect(
      unwrapErr(await updateExpense(deps, expense.id, ramen(a, [a]))).code,
    ).toBe("EXPENSE_NOT_FOUND");
  });
});

describe("settlements", () => {
  it("settles a debt and clears the transfer suggestion", async () => {
    const { db, deps, ledgerId, a, b } = await setup();
    unwrap(await addExpense(deps, ledgerId, ramen(a, [a, b])));
    unwrap(
      await addSettlement(deps, ledgerId, {
        fromId: b,
        toId: a,
        amountMinor: 300,
        settledAt: "2026-10-15T20:00:00+08:00",
      }),
    );
    const summary = unwrap(await loadLedgerSummary(db, ledgerId));
    expect(summary.transfers).toEqual([]);
    expect(summary.settlements).toHaveLength(1);
  });

  it("marks expenses settled up to the settlement, not ones added later", async () => {
    const { db, deps, ledgerId, a, b } = await setup();
    let clock = NOW.getTime();
    // 每次寫入往後一分鐘，讓記錄時間有先後
    const ticking = { ...deps, now: () => new Date((clock += 60_000)) };
    const before = unwrap(
      await addExpense(ticking, ledgerId, ramen(a, [a, b])),
    );
    unwrap(
      await addSettlement(ticking, ledgerId, {
        fromId: b,
        toId: a,
        amountMinor: 300,
        settledAt: "2026-10-12T20:00:00+09:00",
      }),
    );
    const after = unwrap(await addExpense(ticking, ledgerId, ramen(a, [a, b])));

    const summary = unwrap(await loadLedgerSummary(db, ledgerId));
    expect(summary.expenseStatuses.get(before.id)).toBe("settled");
    expect(summary.expenseStatuses.has(after.id)).toBe(false);
  });

  it("allows archived members to settle", async () => {
    const { db, deps, ledgerId, a, b } = await setup();
    await db.runAsync("UPDATE members SET archived_at = 'x' WHERE id = ?", [b]);
    const result = await addSettlement(deps, ledgerId, {
      fromId: b,
      toId: a,
      amountMinor: 100,
      settledAt: "2026-10-15T20:00:00+08:00",
    });
    expect(result.ok).toBe(true);
  });

  it("validates before writing", async () => {
    const { deps, ledgerId, a } = await setup();
    const base = { amountMinor: 100, settledAt: "2026-10-15T20:00:00+08:00" };
    expect(
      unwrapErr(
        await addSettlement(deps, ledgerId, { ...base, fromId: a, toId: a }),
      ).code,
    ).toBe("SELF_SETTLEMENT");
    expect(
      unwrapErr(
        await addSettlement(deps, "missing", { ...base, fromId: a, toId: "x" }),
      ).code,
    ).toBe("LEDGER_NOT_FOUND");
  });

  it("soft-deletes a settlement once", async () => {
    const { deps, ledgerId, a, b } = await setup();
    const s = unwrap(
      await addSettlement(deps, ledgerId, {
        fromId: b,
        toId: a,
        amountMinor: 100,
        settledAt: "2026-10-15T20:00:00+08:00",
      }),
    );
    expect((await deleteSettlement(deps, s.id)).ok).toBe(true);
    expect(unwrapErr(await deleteSettlement(deps, s.id)).code).toBe(
      "SETTLEMENT_NOT_FOUND",
    );
  });
});

describe("loadLedgerSummary", () => {
  it("reports a missing ledger", async () => {
    const { db } = await setup();
    expect(unwrapErr(await loadLedgerSummary(db, "missing")).code).toBe(
      "LEDGER_NOT_FOUND",
    );
  });
});
