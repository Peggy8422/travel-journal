import {
  makeExpenseRecord,
  makeSettlementRecord,
  setupLedger,
  T0,
} from "./testRecords";

describe("MemberRepository", () => {
  it("assigns sort order by join order, per ledger", async () => {
    const { repos } = await setupLedger();
    await repos.ledgers.insert({
      id: "ledger-2",
      kind: "shared",
      name: "首爾",
      baseCurrency: "TWD",
      createdAt: T0,
      updatedAt: T0,
    });
    const first = await repos.members.insert({
      id: "x",
      ledgerId: "ledger-2",
      name: "Xavier",
      createdAt: T0,
    });
    const fourth = await repos.members.insert({
      id: "d",
      ledgerId: "ledger-1",
      name: "Dave",
      createdAt: T0,
    });

    expect(first.sortOrder).toBe(0);
    expect(fourth).toEqual({
      id: "d",
      ledgerId: "ledger-1",
      name: "Dave",
      sortOrder: 3,
      archivedAt: null,
      isSelf: false,
      createdAt: T0,
    });
    expect(
      (await repos.members.listByLedger("ledger-1")).map((m) => m.id),
    ).toEqual(["a", "b", "c", "d"]);
  });

  it("renames, archives and unarchives a member", async () => {
    const { repos } = await setupLedger();
    await repos.members.rename("b", "Bobby");
    await repos.members.setArchived("b", "2026-10-03T00:00:00.000Z");
    let b = (await repos.members.listByLedger("ledger-1"))[1];
    expect(b).toMatchObject({
      name: "Bobby",
      archivedAt: "2026-10-03T00:00:00.000Z",
      isSelf: false,
    });

    await repos.members.setArchived("b", null);
    b = (await repos.members.listByLedger("ledger-1"))[1];
    expect(b?.archivedAt).toBeNull();
  });

  it("rejects a member for a ledger that does not exist", async () => {
    const { repos } = await setupLedger();
    await expect(
      repos.members.insert({
        id: "z",
        ledgerId: "missing",
        name: "Zed",
        createdAt: T0,
      }),
    ).rejects.toThrow(/FOREIGN KEY/);
  });

  it("finds a member by id", async () => {
    const { repos } = await setupLedger();
    expect(await repos.members.findById("b")).toMatchObject({
      id: "b",
      name: "Bob",
      sortOrder: 1,
    });
    expect(await repos.members.findById("missing")).toBeUndefined();
  });

  it("deletes an unreferenced member and keeps appending after the others", async () => {
    const { repos } = await setupLedger();
    await repos.members.delete("c");
    const dave = await repos.members.insert({
      id: "d",
      ledgerId: "ledger-1",
      name: "Dave",
      createdAt: T0,
    });
    expect(dave.sortOrder).toBe(2);
    expect(
      (await repos.members.listByLedger("ledger-1")).map((m) => m.id),
    ).toEqual(["a", "b", "d"]);
  });

  it("refuses to delete a payer, guarded by the foreign key", async () => {
    const { repos } = await setupLedger();
    await repos.expenses.insert(makeExpenseRecord({ payerId: "c" }));
    await expect(repos.members.delete("c")).rejects.toThrow(/FOREIGN KEY/);
  });

  describe("isReferenced", () => {
    it("is false for a member without expenses or settlements", async () => {
      const { repos } = await setupLedger();
      expect(await repos.members.isReferenced("c")).toBe(false);
    });

    it("finds the payer", async () => {
      const { repos } = await setupLedger();
      await repos.expenses.insert(
        makeExpenseRecord({
          payerId: "c",
          split: { kind: "equal", participantIds: ["a"] },
        }),
      );
      expect(await repos.members.isReferenced("c")).toBe(true);
    });

    it("finds an equal-split participant inside the JSON", async () => {
      const { repos } = await setupLedger();
      await repos.expenses.insert(
        makeExpenseRecord({ split: { kind: "equal", participantIds: ["c"] } }),
      );
      expect(await repos.members.isReferenced("c")).toBe(true);
      expect(await repos.members.isReferenced("b")).toBe(false);
    });

    it("finds an exact-split participant inside the JSON", async () => {
      const { repos } = await setupLedger();
      await repos.expenses.insert(
        makeExpenseRecord({
          split: {
            kind: "exact",
            shares: [{ memberId: "c", amountMinor: 3000 }],
          },
        }),
      );
      expect(await repos.members.isReferenced("c")).toBe(true);
      expect(await repos.members.isReferenced("b")).toBe(false);
    });

    it("finds both sides of a settlement", async () => {
      const { repos } = await setupLedger();
      await repos.settlements.insert(
        makeSettlementRecord({ fromId: "b", toId: "c" }),
      );
      expect(await repos.members.isReferenced("b")).toBe(true);
      expect(await repos.members.isReferenced("c")).toBe(true);
    });

    it("counts deleted expenses, since restoring them needs the member", async () => {
      const { repos } = await setupLedger();
      await repos.expenses.insert(
        makeExpenseRecord({
          split: { kind: "equal", participantIds: ["c"] },
          deletedAt: "2026-10-13T00:00:00.000Z",
        }),
      );
      expect(await repos.members.isReferenced("c")).toBe(true);
    });
  });
});

describe("MemberRepository.setSelf", () => {
  const selfIds = async (
    repos: Awaited<ReturnType<typeof setupLedger>>["repos"],
  ) =>
    (await repos.members.listByLedger("ledger-1"))
      .filter((m) => m.isSelf)
      .map((m) => m.id);

  it("marks one member as self and moves the mark when changed", async () => {
    const { repos } = await setupLedger();
    await repos.members.setSelf("ledger-1", "a");
    expect(await selfIds(repos)).toEqual(["a"]);
    await repos.members.setSelf("ledger-1", "c");
    expect(await selfIds(repos)).toEqual(["c"]);
    await repos.members.setSelf("ledger-1", null);
    expect(await selfIds(repos)).toEqual([]);
  });

  it("refuses a member from another ledger", async () => {
    const { repos } = await setupLedger();
    await expect(repos.members.setSelf("ledger-1", "stranger")).rejects.toThrow(
      /not in ledger/,
    );
  });
});
