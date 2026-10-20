import type { ExpenseRecord } from "./records";
import { computeLedgerStats } from "./stats";
import { unwrap, unwrapErr } from "./testFixtures";
import type { Ledger } from "./types";

const ledger: Ledger = {
  id: "l1",
  baseCurrency: "TWD",
  members: [{ id: "a" }, { id: "b" }, { id: "c" }],
};

function expense(overrides: Partial<ExpenseRecord>): ExpenseRecord {
  return {
    id: "e",
    ledgerId: "l1",
    payerId: "a",
    amountMinor: 300,
    currency: "TWD",
    fx: null,
    split: { kind: "equal", participantIds: ["a", "b", "c"] },
    title: "t",
    note: null,
    category: null,
    placeName: null,
    location: null,
    occurredAt: "2026-10-12T12:00:00+08:00",
    createdAt: "2026-10-12T04:00:00.000Z",
    updatedAt: "2026-10-12T04:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

describe("computeLedgerStats", () => {
  it("sums what each member paid and owes in the base currency", () => {
    const stats = unwrap(
      computeLedgerStats(ledger, [
        expense({ id: "e1", category: "food" }),
        expense({
          id: "e2",
          payerId: "b",
          amountMinor: 1000,
          currency: "JPY",
          fx: { rateToBase: "0.2", source: "manual" },
          split: { kind: "equal", participantIds: ["a", "b"] },
          category: "transport",
        }),
      ]),
    );
    expect(stats.totalMinor).toBe(500);
    expect(stats.members).toEqual([
      { memberId: "a", paidMinor: 300, shareMinor: 200 },
      { memberId: "b", paidMinor: 200, shareMinor: 200 },
      { memberId: "c", paidMinor: 0, shareMinor: 100 },
    ]);
  });

  it("keeps paid and owed totals equal to the overall total", () => {
    const stats = unwrap(
      computeLedgerStats(ledger, [
        expense({ id: "e1", amountMinor: 100 }), // 不能整除，會分配尾數
        expense({ id: "e2", payerId: "c", amountMinor: 7 }),
      ]),
    );
    const sum = (key: "paidMinor" | "shareMinor") =>
      stats.members.reduce((acc, m) => acc + m[key], 0);
    expect(sum("paidMinor")).toBe(stats.totalMinor);
    expect(sum("shareMinor")).toBe(stats.totalMinor);
  });

  it("groups by category, largest first, with uncategorized as null", () => {
    const stats = unwrap(
      computeLedgerStats(ledger, [
        expense({ id: "e1", category: "food", amountMinor: 300 }),
        expense({ id: "e2", category: "food", amountMinor: 300 }),
        expense({ id: "e3", category: null, amountMinor: 900 }),
        expense({ id: "e4", category: "transport", amountMinor: 600 }),
      ]),
    );
    expect(stats.categories).toEqual([
      { category: null, totalMinor: 900 },
      { category: "food", totalMinor: 600 },
      { category: "transport", totalMinor: 600 },
    ]);
  });

  it("ignores deleted expenses and handles an empty ledger", () => {
    const stats = unwrap(
      computeLedgerStats(ledger, [expense({ deletedAt: "x" })]),
    );
    expect(stats).toEqual({
      totalMinor: 0,
      members: [
        { memberId: "a", paidMinor: 0, shareMinor: 0 },
        { memberId: "b", paidMinor: 0, shareMinor: 0 },
        { memberId: "c", paidMinor: 0, shareMinor: 0 },
      ],
      categories: [],
    });
  });

  it("reports invalid stored data", () => {
    const broken = expense({
      split: { kind: "equal", participantIds: ["stranger"] },
    });
    expect(unwrapErr(computeLedgerStats(ledger, [broken])).code).toBe(
      "INVALID_EXPENSE",
    );
  });
});
