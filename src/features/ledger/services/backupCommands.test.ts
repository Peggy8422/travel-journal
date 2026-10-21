import { parseBackup, serializeBackup } from "../../../data/backup/backupFile";
import { createTestDatabase } from "../../../data/db/testDatabase";
import { createRepositories } from "../../../data/repositories";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";
import {
  buildBackupFile,
  collectBackup,
  restoreBackup,
  restoreFromBackupText,
} from "./backupCommands";
import {
  addExpense,
  addSettlement,
  createLedger,
  deleteExpense,
  type LedgerCommandDeps,
} from "./ledgerCommands";
import { loadLedgerSummary } from "./ledgerSummary";
import { archiveMember } from "./memberCommands";

const NOW = new Date("2026-10-12T03:00:00.000Z");

function depsFor(db: Awaited<ReturnType<typeof createTestDatabase>>) {
  let seq = 0;
  let clock = NOW.getTime();
  const deps: LedgerCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => new Date((clock += 60_000)),
  };
  return deps;
}

function lunch(payerId: string, participantIds: string[]) {
  return {
    payerId,
    amountMinor: 300,
    currency: "TWD",
    fx: null,
    split: { kind: "equal" as const, participantIds },
    title: "午餐",
    note: "好吃",
    category: "food",
    placeName: null,
    location: null,
    occurredAt: "2026-10-12T12:00:00+08:00",
  };
}

/** 建一本有消費、已刪除消費、還款、封存成員的帳本 */
async function seededDatabase() {
  const db = await createTestDatabase();
  const deps = depsFor(db);
  const { ledger, members } = unwrap(
    await createLedger(deps, {
      name: "東京",
      memberNames: ["Alice", "Bob", "Carol"],
    }),
  );
  const [a, b, c] = members.map((m) => m.id) as [string, string, string];
  unwrap(await addExpense(deps, ledger.id, lunch(a, [a, b, c])));
  const removed = unwrap(await addExpense(deps, ledger.id, lunch(b, [b, c])));
  unwrap(await deleteExpense(deps, removed.id));
  unwrap(
    await addSettlement(deps, ledger.id, {
      fromId: b,
      toId: a,
      amountMinor: 100,
      settledAt: "2026-10-12T20:00:00+08:00",
    }),
  );
  unwrap(await archiveMember(deps, c));
  return { db, ledgerId: ledger.id };
}

describe("backup and restore", () => {
  it("restores an identical copy into an empty database", async () => {
    const source = await seededDatabase();
    const backup = await collectBackup(source.db);

    const target = await createTestDatabase();
    // 經過實際的檔案格式，確認序列化不會遺失資料
    const parsed = unwrap(
      parseBackup(
        serializeBackup({ exportedAt: NOW.toISOString(), ledgers: backup }),
      ),
    );
    const report = await restoreBackup(target, parsed.ledgers);

    expect(report.restored.map((l) => l.name)).toEqual(["東京"]);
    expect(report.skipped).toEqual([]);
    expect(report.failed).toEqual([]);
    expect(await collectBackup(target)).toEqual(backup);

    const summary = unwrap(await loadLedgerSummary(target, source.ledgerId));
    const original = unwrap(
      await loadLedgerSummary(source.db, source.ledgerId),
    );
    expect(summary.balances).toEqual(original.balances);
    expect(summary.members.map((m) => [m.name, m.archivedAt !== null])).toEqual(
      [
        ["Alice", false],
        ["Bob", false],
        ["Carol", true],
      ],
    );
  });

  it("includes deleted expenses in the backup", async () => {
    const { db } = await seededDatabase();
    const [backup] = await collectBackup(db);
    expect(backup?.expenses.filter((e) => e.deletedAt !== null)).toHaveLength(
      1,
    );
  });

  it("skips ledgers that already exist without touching them", async () => {
    const { db, ledgerId } = await seededDatabase();
    const backup = await collectBackup(db);
    const before = unwrap(await loadLedgerSummary(db, ledgerId));

    const report = await restoreBackup(db, backup);

    expect(report.restored).toEqual([]);
    expect(report.skipped.map((l) => l.id)).toEqual([ledgerId]);
    expect(unwrap(await loadLedgerSummary(db, ledgerId))).toEqual(before);
  });

  it("rolls back a ledger whose data is inconsistent and keeps going", async () => {
    const { db } = await seededDatabase();
    const [good] = await collectBackup(db);
    const target = await createTestDatabase();
    const broken = {
      ...good!,
      ledger: { ...good!.ledger, id: "broken", name: "壞掉的" },
      // 付款人不在成員裡，資料庫的外鍵會擋下
      expenses: good!.expenses.map((e) => ({ ...e, payerId: "stranger" })),
    };

    const report = await restoreBackup(target, [broken, good!]);

    expect(report.failed.map((f) => f.ledger.name)).toEqual(["壞掉的"]);
    expect(report.restored.map((l) => l.name)).toEqual(["東京"]);
    // 失敗的那本完全沒有寫入
    expect(
      await createRepositories(target).ledgers.findById("broken"),
    ).toBeUndefined();
    expect(
      await createRepositories(target).members.listByLedger("broken"),
    ).toEqual([]);
  });
});

describe("backup file round trip", () => {
  it("names the file by the Taiwan date and restores from its text", async () => {
    const { db } = await seededDatabase();
    // 臺灣時間已經是 10/22
    const file = await buildBackupFile(db, new Date("2026-10-21T17:00:00Z"));
    expect(file.fileName).toBe("旅遊記帳備份-2026-10-22.json");

    const target = await createTestDatabase();
    const report = unwrap(await restoreFromBackupText(target, file.content));
    expect(report.restored.map((l) => l.name)).toEqual(["東京"]);
  });

  it("writes nothing when the file is not a backup", async () => {
    const target = await createTestDatabase();
    expect(unwrapErr(await restoreFromBackupText(target, "{}")).code).toBe(
      "INVALID_BACKUP",
    );
    expect(await collectBackup(target)).toEqual([]);
  });
});
