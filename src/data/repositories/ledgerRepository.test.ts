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

  it("stores the cover codes", async () => {
    const { repos } = await setupLedger();
    const cover = {
      style: "tape",
      palette: "matcha",
      pattern: "waves",
    } as const;
    await repos.ledgers.insert(makeLedgerRecord({ id: "ledger-2", cover }));
    expect((await repos.ledgers.findById("ledger-2"))?.cover).toEqual(cover);
    expect((await repos.ledgers.findById("ledger-1"))?.cover).toBeNull();
  });

  it("stores a manual trip month and clears it back to automatic", async () => {
    const { repos } = await setupLedger();
    await repos.ledgers.update(makeLedgerRecord({ tripMonth: "2027-02" }));
    expect((await repos.ledgers.findById("ledger-1"))?.tripMonth).toBe(
      "2027-02",
    );
    await repos.ledgers.update(makeLedgerRecord({ tripMonth: null }));
    expect((await repos.ledgers.findById("ledger-1"))?.tripMonth).toBeNull();
  });

  it("updates the cover together with the name", async () => {
    const { repos } = await setupLedger();
    const cover = {
      style: "band",
      palette: "fuji",
      pattern: "dots",
    } as const;
    await repos.ledgers.update(makeLedgerRecord({ cover }));
    expect((await repos.ledgers.findById("ledger-1"))?.cover).toEqual(cover);
  });

  it("reads unknown cover codes as no cover", async () => {
    const { db, repos } = await setupLedger();
    await db.runAsync(
      "UPDATE ledgers SET cover_style = 'band', cover_palette = 'neon', cover_pattern = 'dots'",
    );
    expect((await repos.ledgers.findById("ledger-1"))?.cover).toBeNull();
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

describe("LedgerRepository — kinds", () => {
  it("lists only the requested kind and finds the personal ledger", async () => {
    const { repos } = await setupLedger();
    await repos.ledgers.insert(
      makeLedgerRecord({ id: "personal", kind: "personal", name: "個人" }),
    );

    expect((await repos.ledgers.list()).map((l) => l.id)).toHaveLength(2);
    expect(
      (await repos.ledgers.list({ kind: "shared" })).map((l) => l.id),
    ).toEqual(["ledger-1"]);
    expect((await repos.ledgers.findPersonal())?.id).toBe("personal");
  });

  it("allows only one personal ledger", async () => {
    const { repos } = await setupLedger();
    await repos.ledgers.insert(
      makeLedgerRecord({ id: "p1", kind: "personal" }),
    );
    await expect(
      repos.ledgers.insert(makeLedgerRecord({ id: "p2", kind: "personal" })),
    ).rejects.toThrow(/UNIQUE/);
  });

  it("has no personal ledger until one is created", async () => {
    const { repos } = await setupLedger();
    expect(await repos.ledgers.findPersonal()).toBeUndefined();
  });
});
