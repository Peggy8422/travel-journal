import {
  makeExpenseRecord,
  makeLedgerRecord,
  makeSettlementRecord,
  setupLedger,
} from "./testRecords";

describe("LedgerRepository", () => {
  it("inserts, finds and updates a ledger", async () => {
    const { repos } = await setupLedger();
    await repos.ledgers.update(
      makeLedgerRecord({ name: "大阪", updatedAt: "2026-10-02T00:00:00.000Z" }),
    );
    expect(await repos.ledgers.findById("ledger-1")).toEqual(
      makeLedgerRecord({ name: "大阪", updatedAt: "2026-10-02T00:00:00.000Z" }),
    );
    expect(await repos.ledgers.findById("missing")).toBeUndefined();
  });

  it("lists ledgers newest first", async () => {
    const { repos } = await setupLedger();
    await repos.ledgers.insert(
      makeLedgerRecord({ id: "ledger-2", createdAt: "2026-10-05T00:00:00Z" }),
    );
    expect((await repos.ledgers.list()).map((l) => l.id)).toEqual([
      "ledger-2",
      "ledger-1",
    ]);
  });

  it("deletes members, expenses and settlements with the ledger", async () => {
    const { db, repos } = await setupLedger();
    await repos.expenses.insert(makeExpenseRecord());
    await repos.settlements.insert(makeSettlementRecord());

    await repos.ledgers.delete("ledger-1");

    for (const table of ["members", "expenses", "settlements"]) {
      const row = await db.getFirstAsync<{ n: number }>(
        `SELECT count(*) AS n FROM ${table}`,
      );
      expect(row?.n).toBe(0);
    }
  });
});
