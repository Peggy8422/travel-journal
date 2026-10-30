import {
  makeExpenseRecord,
  makeSettlementRecord,
  setupLedger,
} from "../../../data/repositories/testRecords";
import { loadExpenseDetail } from "./expenseDetail";

describe("loadExpenseDetail", () => {
  it("returns the expense with its payer, base amount and shares", async () => {
    const { db, repos } = await setupLedger();
    // 3000 JPY × 0.2134 = 640.2 → TWD 640, split three ways
    await repos.expenses.insert(makeExpenseRecord());

    const result = await loadExpenseDetail(db, "e1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { expense, ledger, payer, baseMinor, shares, status } = result.value;
    expect(expense.id).toBe("e1");
    expect(ledger.id).toBe("ledger-1");
    expect(payer?.name).toBe("Alice");
    expect(baseMinor).toBe(640);
    expect(shares.map((s) => [s.member.name, s.amountMinor])).toEqual([
      ["Alice", 214],
      ["Bob", 213],
      ["Carol", 213],
    ]);
    expect(status).toBeUndefined();
  });

  it("lists only the members who share the expense", async () => {
    const { db, repos } = await setupLedger();
    await repos.expenses.insert(
      makeExpenseRecord({
        split: { kind: "equal", participantIds: ["c", "a"] },
      }),
    );

    const result = await loadExpenseDetail(db, "e1");

    // Member order, not the order in the split rule
    expect(result.ok && result.value.shares.map((s) => s.member.id)).toEqual([
      "a",
      "c",
    ]);
  });

  it("reports the expense status once it is settled", async () => {
    const { db, repos } = await setupLedger();
    await repos.expenses.insert(
      makeExpenseRecord({
        amountMinor: 900,
        currency: "TWD",
        fx: null,
        split: { kind: "equal", participantIds: ["a", "b"] },
      }),
    );
    await repos.settlements.insert(
      makeSettlementRecord({ fromId: "b", toId: "a", amountMinor: 450 }),
    );

    const result = await loadExpenseDetail(db, "e1");

    expect(result.ok && result.value.status).toBe("settled");
  });

  it("treats missing and deleted expenses as not found", async () => {
    const { db, repos } = await setupLedger();
    await repos.expenses.insert(
      makeExpenseRecord({ deletedAt: "2026-10-13T00:00:00.000Z" }),
    );

    expect(await loadExpenseDetail(db, "e1")).toEqual({
      ok: false,
      error: { code: "EXPENSE_NOT_FOUND", expenseId: "e1" },
    });
    expect(await loadExpenseDetail(db, "nope")).toEqual({
      ok: false,
      error: { code: "EXPENSE_NOT_FOUND", expenseId: "nope" },
    });
  });
});
