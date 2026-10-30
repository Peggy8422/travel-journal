import { createTestDatabase } from "../../../data/db/testDatabase";
import { createRepositories } from "../../../data/repositories";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";
import {
  addExpense,
  addSettlement,
  createLedger,
  deleteExpense,
  type LedgerCommandDeps,
} from "./ledgerCommands";
import {
  archiveMember,
  removeMember,
  renameMember,
  unarchiveMember,
} from "./memberCommands";

const NOW = new Date("2026-10-12T03:00:00.000Z");

async function setup(memberNames = ["Alice", "Bob", "Carol"]) {
  const db = await createTestDatabase();
  let seq = 0;
  const deps: LedgerCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => NOW,
  };
  const { ledger, members } = unwrap(
    await createLedger(deps, { name: "東京", memberNames }),
  );
  const ids = members.map((m) => m.id);
  const list = () => createRepositories(db).members.listByLedger(ledger.id);
  return { deps, ledgerId: ledger.id, ids, list };
}

function lunch(payerId: string, participantIds: string[]) {
  return {
    payerId,
    amountMinor: 300,
    currency: "TWD",
    fx: null,
    split: { kind: "equal" as const, participantIds },
    title: "午餐",
    note: null,
    category: null,
    placeName: null,
    location: null,
    occurredAt: "2026-10-12T12:00:00+08:00",
  };
}

describe("renameMember", () => {
  it("renames with trimmed text", async () => {
    const { deps, ids, list } = await setup();
    const renamed = unwrap(await renameMember(deps, ids[1]!, " Bobby "));
    expect(renamed.name).toBe("Bobby");
    expect((await list())[1]?.name).toBe("Bobby");
  });

  it("rejects a name over the member name limit", async () => {
    const { deps, ids } = await setup();
    expect(
      unwrapErr(await renameMember(deps, ids[0]!, "一二三四五六七八九十一")),
    ).toEqual({ code: "TEXT_TOO_LONG", field: "memberName", max: 10 });
  });

  it("rejects another member's name but allows changing the case", async () => {
    const { deps, ids, list } = await setup();
    expect(unwrapErr(await renameMember(deps, ids[0]!, "BOB"))).toEqual({
      code: "DUPLICATE_MEMBER_NAME",
      name: "BOB",
    });
    unwrap(await renameMember(deps, ids[1]!, "BOB"));
    expect((await list())[1]?.name).toBe("BOB");
  });

  it("rejects an empty name and a missing member", async () => {
    const { deps, ids } = await setup();
    expect(unwrapErr(await renameMember(deps, ids[0]!, " ")).code).toBe(
      "EMPTY_NAME",
    );
    expect(unwrapErr(await renameMember(deps, "missing", "X")).code).toBe(
      "MEMBER_NOT_FOUND",
    );
  });
});

describe("archiveMember / unarchiveMember", () => {
  it("archives and restores a member", async () => {
    const { deps, ids, list } = await setup();
    const archived = unwrap(await archiveMember(deps, ids[2]!));
    expect(archived.archivedAt).toBe(NOW.toISOString());
    expect((await list())[2]?.archivedAt).toBe(NOW.toISOString());

    unwrap(await unarchiveMember(deps, ids[2]!));
    expect((await list())[2]?.archivedAt).toBeNull();
  });

  it("keeps the original archive time when archiving twice", async () => {
    const { deps, ids } = await setup();
    unwrap(await archiveMember(deps, ids[2]!));
    const later = { ...deps, now: () => new Date("2026-10-20T00:00:00Z") };
    const again = unwrap(await archiveMember(later, ids[2]!));
    expect(again.archivedAt).toBe(NOW.toISOString());
  });

  it("refuses to archive the last active member", async () => {
    const { deps, ids } = await setup(["Alice", "Bob"]);
    unwrap(await archiveMember(deps, ids[0]!));
    expect(unwrapErr(await archiveMember(deps, ids[1]!))).toEqual({
      code: "LAST_ACTIVE_MEMBER",
      memberId: ids[1],
    });
  });

  it("reports a missing member", async () => {
    const { deps } = await setup();
    expect(unwrapErr(await archiveMember(deps, "missing")).code).toBe(
      "MEMBER_NOT_FOUND",
    );
    expect(unwrapErr(await unarchiveMember(deps, "missing")).code).toBe(
      "MEMBER_NOT_FOUND",
    );
  });
});

describe("removeMember", () => {
  it("deletes a member that was never used", async () => {
    const { deps, ids, list } = await setup();
    unwrap(await removeMember(deps, ids[2]!));
    expect((await list()).map((m) => m.id)).toEqual([ids[0], ids[1]]);
  });

  it.each([
    ["is a participant", (a: string, c: string) => lunch(a, [a, c])],
    ["is the payer", (a: string, c: string) => lunch(c, [a])],
  ])(
    "refuses to delete a member who %s, even after the expense is deleted",
    async (_, makeExpense) => {
      const { deps, ledgerId, ids } = await setup();
      const [a, , c] = ids as [string, string, string];
      const expense = unwrap(
        await addExpense(deps, ledgerId, makeExpense(a, c)),
      );
      unwrap(await deleteExpense(deps, expense.id));
      expect(unwrapErr(await removeMember(deps, c))).toEqual({
        code: "MEMBER_REFERENCED",
        memberId: c,
      });
    },
  );

  it("refuses to delete a member who has a settlement", async () => {
    const { deps, ledgerId, ids } = await setup();
    const [a, , c] = ids as [string, string, string];
    unwrap(
      await addSettlement(deps, ledgerId, {
        fromId: c,
        toId: a,
        amountMinor: 100,
        settledAt: "2026-10-12T20:00:00+08:00",
      }),
    );
    expect(unwrapErr(await removeMember(deps, c)).code).toBe(
      "MEMBER_REFERENCED",
    );
  });

  it("refuses to delete the last active member", async () => {
    const { deps, ids } = await setup(["Alice", "Bob"]);
    unwrap(await archiveMember(deps, ids[1]!));
    expect(unwrapErr(await removeMember(deps, ids[0]!)).code).toBe(
      "LAST_ACTIVE_MEMBER",
    );
    // 已封存、沒被引用的成員可以刪除
    unwrap(await removeMember(deps, ids[1]!));
  });

  it("reports a missing member", async () => {
    const { deps } = await setup();
    expect(unwrapErr(await removeMember(deps, "missing")).code).toBe(
      "MEMBER_NOT_FOUND",
    );
  });
});
