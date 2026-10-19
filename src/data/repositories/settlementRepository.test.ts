import { makeSettlementRecord, setupLedger } from "./testRecords";

describe("SettlementRepository", () => {
  it("round-trips a settlement and orders by settled time", async () => {
    const { repos } = await setupLedger();
    const later = makeSettlementRecord({
      id: "later",
      settledAt: "2026-10-15T20:00:00+08:00",
    });
    const earlier = makeSettlementRecord({
      id: "earlier",
      settledAt: "2026-10-15T20:00:00+09:00",
    });
    await repos.settlements.insert(later);
    await repos.settlements.insert(earlier);
    expect(await repos.settlements.listByLedger("ledger-1")).toEqual([
      earlier,
      later,
    ]);
  });

  it("hides soft-deleted settlements unless asked", async () => {
    const { repos } = await setupLedger();
    await repos.settlements.insert(makeSettlementRecord());
    await repos.settlements.softDelete("s1", "2026-10-16T00:00:00.000Z");
    expect(await repos.settlements.listByLedger("ledger-1")).toEqual([]);
    expect(
      await repos.settlements.listByLedger("ledger-1", {
        includeDeleted: true,
      }),
    ).toHaveLength(1);
  });

  it("rejects paying yourself and members of another ledger", async () => {
    const { repos } = await setupLedger();
    await expect(
      repos.settlements.insert(
        makeSettlementRecord({ fromId: "a", toId: "a" }),
      ),
    ).rejects.toThrow(/CHECK/);
    await expect(
      repos.settlements.insert(makeSettlementRecord({ toId: "stranger" })),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe("SettlementRepository.findById", () => {
  it("finds a settlement, including deleted ones", async () => {
    const { repos } = await setupLedger();
    await repos.settlements.insert(makeSettlementRecord());
    await repos.settlements.softDelete("s1", "2026-10-16T00:00:00.000Z");
    expect(await repos.settlements.findById("s1")).toMatchObject({
      id: "s1",
      deletedAt: "2026-10-16T00:00:00.000Z",
    });
    expect(await repos.settlements.findById("missing")).toBeUndefined();
  });
});
