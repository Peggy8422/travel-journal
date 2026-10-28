import {
  collectPersonalEntries,
  shiftMonth,
  summarizePersonalMonth,
  type LedgerSnapshot,
} from "./personalSpending";
import type { ExpenseRecord, LedgerRecord, MemberRecord } from "./records";
import { unwrap, unwrapErr } from "./testFixtures";

const T0 = "2026-10-01T00:00:00.000Z";

function ledger(id: string, kind: LedgerRecord["kind"]): LedgerRecord {
  return {
    id,
    kind,
    name: id,
    baseCurrency: "TWD",
    cover: null,
    createdAt: T0,
    updatedAt: T0,
  };
}

function member(id: string, ledgerId: string, isSelf = false): MemberRecord {
  return {
    id,
    ledgerId,
    name: id,
    sortOrder: 0,
    archivedAt: null,
    isSelf,
    createdAt: T0,
  };
}

function expense(
  id: string,
  ledgerId: string,
  overrides: Partial<ExpenseRecord> = {},
): ExpenseRecord {
  return {
    id,
    ledgerId,
    payerId: "me",
    amountMinor: 300,
    currency: "TWD",
    fx: null,
    split: { kind: "equal", participantIds: ["me"] },
    title: id,
    note: null,
    category: null,
    placeName: null,
    location: null,
    occurredAt: "2026-10-12T12:00:00+08:00",
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

const personal: LedgerSnapshot = {
  ledger: ledger("personal", "personal"),
  members: [member("me", "personal", true)],
  expenses: [
    expense("coffee", "personal", {
      amountMinor: 1000,
      currency: "JPY",
      fx: { rateToBase: "0.2", source: "manual" },
      category: "food",
    }),
  ],
};

const trip: LedgerSnapshot = {
  ledger: ledger("trip", "shared"),
  members: [member("a", "trip", true), member("b", "trip")],
  expenses: [
    // 我付錢、兩人平分：我負擔 150
    expense("dinner", "trip", {
      payerId: "a",
      split: { kind: "equal", participantIds: ["a", "b"] },
      category: "food",
      occurredAt: "2026-10-13T19:00:00+08:00",
    }),
    // 別人付錢、我分攤：我負擔 100
    expense("taxi", "trip", {
      payerId: "b",
      amountMinor: 200,
      split: { kind: "equal", participantIds: ["a", "b"] },
      category: "transport",
      occurredAt: "2026-11-02T10:00:00+08:00",
    }),
    // 我付錢但沒有分攤：不算我的花費
    expense("gift", "trip", {
      payerId: "a",
      split: { kind: "equal", participantIds: ["b"] },
    }),
    expense("deleted", "trip", {
      payerId: "a",
      split: { kind: "equal", participantIds: ["a"] },
      deletedAt: T0,
    }),
  ],
};

describe("collectPersonalEntries", () => {
  it("counts personal expenses in full and only my share of shared ones", () => {
    const entries = unwrap(collectPersonalEntries([personal, trip]));
    expect(
      entries.map((e) => [e.expense.id, e.source, e.myShareMinor]),
    ).toEqual([
      ["coffee", "personal", 200],
      ["dinner", "shared", 150],
      ["taxi", "shared", 100],
    ]);
  });

  it("skips ledgers where nobody is marked as me", () => {
    const anonymous = {
      ...trip,
      members: trip.members.map((m) => ({ ...m, isSelf: false })),
    };
    expect(unwrap(collectPersonalEntries([anonymous]))).toEqual([]);
  });

  it("reports invalid stored data", () => {
    const broken = {
      ...trip,
      expenses: [
        expense("x", "trip", {
          split: { kind: "equal", participantIds: ["stranger"] },
        }),
      ],
    };
    expect(unwrapErr(collectPersonalEntries([broken])).code).toBe(
      "INVALID_EXPENSE",
    );
  });
});

describe("summarizePersonalMonth", () => {
  const entries = unwrap(collectPersonalEntries([personal, trip]));

  it("totals one month, split into personal and shared, newest first", () => {
    const october = summarizePersonalMonth(entries, "2026-10");
    expect(october.entries.map((e) => e.expense.id)).toEqual([
      "dinner",
      "coffee",
    ]);
    expect([
      october.totalMinor,
      october.personalMinor,
      october.sharedMinor,
    ]).toEqual([350, 200, 150]);
    expect(october.categories).toEqual([{ category: "food", totalMinor: 350 }]);
  });

  it("uses the local month of each expense", () => {
    const november = summarizePersonalMonth(entries, "2026-11");
    expect(november.entries.map((e) => e.expense.id)).toEqual(["taxi"]);
    expect(november.categories).toEqual([
      { category: "transport", totalMinor: 100 },
    ]);
  });

  it("returns zeros for a month without spending", () => {
    expect(summarizePersonalMonth(entries, "2026-09")).toMatchObject({
      entries: [],
      totalMinor: 0,
      categories: [],
    });
  });
});

describe("shiftMonth", () => {
  it.each([
    ["2026-10", 1, "2026-11"],
    ["2026-12", 1, "2027-01"],
    ["2026-01", -1, "2025-12"],
    ["2026-03", -14, "2025-01"],
  ])("shifts %s by %d to %s", (month, delta, expected) => {
    expect(shiftMonth(month, delta)).toBe(expected);
  });
});
