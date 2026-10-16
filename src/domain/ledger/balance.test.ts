import { computeBalances } from "./balance";
import { ledgerTWD, makeExpense, unwrap, unwrapErr } from "./testFixtures";
import type { Balances } from "./types";

const sumOf = (balances: Balances) =>
  [...balances.values()].reduce((s, v) => s + v, 0);

describe("computeBalances", () => {
  it("credits the payer and debits each participant", () => {
    const balances = unwrap(
      computeBalances(ledgerTWD, [makeExpense({ amountMinor: 300 })], []),
    );
    expect(Object.fromEntries(balances)).toEqual({ a: 200, b: -100, c: -100 });
  });

  it("includes members with no activity as zero", () => {
    const expense = makeExpense({
      amountMinor: 100,
      split: { kind: "equal", participantIds: ["a", "b"] },
    });
    expect(unwrap(computeBalances(ledgerTWD, [expense], [])).get("c")).toBe(0);
  });

  it("applies settlements in the right direction", () => {
    const balances = unwrap(
      computeBalances(
        ledgerTWD,
        [makeExpense()],
        [{ id: "s1", fromId: "b", toId: "a", amountMinor: 100 }],
      ),
    );
    expect(Object.fromEntries(balances)).toEqual({ a: 100, b: 0, c: -100 });
  });

  it("ignores soft-deleted expenses and settlements", () => {
    const balances = unwrap(
      computeBalances(
        ledgerTWD,
        [
          makeExpense(),
          makeExpense({
            id: "e2",
            amountMinor: 999,
            deletedAt: "2026-10-01T00:00:00Z",
          }),
        ],
        [
          {
            id: "s1",
            fromId: "b",
            toId: "a",
            amountMinor: 100,
            deletedAt: "2026-10-01T00:00:00Z",
          },
        ],
      ),
    );
    expect(Object.fromEntries(balances)).toEqual({ a: 200, b: -100, c: -100 });
  });

  it("always sums to zero, including foreign currency and rounding", () => {
    const balances = unwrap(
      computeBalances(
        ledgerTWD,
        [
          makeExpense({ id: "e1", amountMinor: 100 }),
          makeExpense({
            id: "e2",
            payerId: "b",
            amountMinor: 1001,
            currency: "JPY",
            fxRateToBase: "0.2134",
          }),
          makeExpense({
            id: "e3",
            payerId: "c",
            amountMinor: 3000,
            currency: "USD",
            fxRateToBase: "32.53",
            split: {
              kind: "exact",
              shares: [
                { memberId: "a", amountMinor: 1000 },
                { memberId: "b", amountMinor: 2000 },
              ],
            },
          }),
        ],
        [{ id: "s1", fromId: "a", toId: "c", amountMinor: 50 }],
      ),
    );
    expect(sumOf(balances)).toBe(0);
  });

  it("reopens a debt when an expense is edited after settling (expected behaviour)", () => {
    const settled = [{ id: "s1", fromId: "b", toId: "a", amountMinor: 100 }];
    const original = makeExpense({
      amountMinor: 200,
      split: { kind: "equal", participantIds: ["a", "b"] },
    });
    const edited = { ...original, amountMinor: 300 };

    expect(
      unwrap(computeBalances(ledgerTWD, [original], settled)).get("b"),
    ).toBe(0);
    expect(unwrap(computeBalances(ledgerTWD, [edited], settled)).get("b")).toBe(
      -50,
    );
  });

  it("reports which stored expense is invalid", () => {
    const bad = makeExpense({ id: "broken", payerId: "ghost" });
    expect(
      unwrapErr(computeBalances(ledgerTWD, [makeExpense(), bad], [])),
    ).toEqual({
      code: "INVALID_EXPENSE",
      expenseId: "broken",
      cause: { code: "UNKNOWN_MEMBER", memberId: "ghost" },
    });
  });

  it("reports which stored settlement is invalid", () => {
    expect(
      unwrapErr(
        computeBalances(
          ledgerTWD,
          [],
          [{ id: "bad-s", fromId: "a", toId: "a", amountMinor: 10 }],
        ),
      ),
    ).toEqual({
      code: "INVALID_SETTLEMENT",
      settlementId: "bad-s",
      cause: { code: "SELF_SETTLEMENT", memberId: "a" },
    });
  });
});
