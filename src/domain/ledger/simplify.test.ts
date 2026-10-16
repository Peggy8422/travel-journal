import { simplifyDebts } from "./simplify";
import { seededRandom, unwrap, unwrapErr } from "./testFixtures";
import type { Balances, Ledger, Transfer } from "./types";

const ledger4: Ledger = {
  id: "l",
  baseCurrency: "TWD",
  members: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
};

const toBalances = (record: Record<string, number>): Balances =>
  new Map(Object.entries(record));

function applyTransfers(
  balances: Balances,
  transfers: readonly Transfer[],
): Map<string, number> {
  const result = new Map(balances);
  for (const t of transfers) {
    result.set(t.fromId, (result.get(t.fromId) ?? 0) + t.amountMinor);
    result.set(t.toId, (result.get(t.toId) ?? 0) - t.amountMinor);
  }
  return result;
}

describe("simplifyDebts", () => {
  it("returns no transfers when everyone is settled", () => {
    expect(unwrap(simplifyDebts(toBalances({ a: 0, b: 0 }), ledger4))).toEqual(
      [],
    );
  });

  it("breaks ties by member join order", () => {
    expect(
      unwrap(simplifyDebts(toBalances({ a: 200, b: -100, c: -100 }), ledger4)),
    ).toEqual([
      { fromId: "b", toId: "a", amountMinor: 100 },
      { fromId: "c", toId: "a", amountMinor: 100 },
    ]);
  });

  it("matches the largest debtor with the largest creditor each step", () => {
    expect(
      unwrap(
        simplifyDebts(toBalances({ a: 50, b: 30, c: -60, d: -20 }), ledger4),
      ),
    ).toEqual([
      { fromId: "c", toId: "a", amountMinor: 50 },
      { fromId: "d", toId: "b", amountMinor: 20 },
      { fromId: "c", toId: "b", amountMinor: 10 },
    ]);
  });

  it("rejects balances that do not sum to zero", () => {
    expect(
      unwrapErr(simplifyDebts(toBalances({ a: 10, b: -5 }), ledger4)),
    ).toEqual({
      code: "BALANCES_NOT_ZERO_SUM",
      sumMinor: 5,
    });
  });

  it("always clears every balance with at most n - 1 positive transfers", () => {
    const random = seededRandom(7);
    const ids = ["a", "b", "c", "d"];
    for (let run = 0; run < 300; run++) {
      const values = ids
        .slice(0, -1)
        .map(() => Math.floor(random() * 2001) - 1000);
      values.push(-values.reduce((s, v) => s + v, 0));
      const balances = new Map(ids.map((id, i) => [id, values[i] ?? 0]));

      const transfers = unwrap(simplifyDebts(balances, ledger4));

      expect(transfers.length).toBeLessThanOrEqual(ids.length - 1);
      transfers.forEach((t) => expect(t.amountMinor).toBeGreaterThan(0));
      [...applyTransfers(balances, transfers).values()].forEach((v) =>
        expect(v).toBe(0),
      );
    }
  });
});
