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
  changeLedgerCover,
  createLedger,
  deleteExpense,
  type LedgerCommandDeps,
} from "./ledgerCommands";
import { loadLedgerSummary } from "./ledgerSummary";
import { createMemoryCoverPhotoStore } from "./memoryCoverPhotoStore";
import { pruneCoverPhotos } from "./coverPhotos";
import { createJournal } from "../../journal/services/journalCommands";
import { collectJournalBackups } from "../../journal/services/journalBackup";
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
        serializeBackup({
          exportedAt: NOW.toISOString(),
          ledgers: backup,
          journals: [],
          illustrations: [],
          photos: {},
        }),
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

  it("restores text longer than today's input limits as it is", async () => {
    const source = await seededDatabase();
    const [backup] = await collectBackup(source.db);
    const longName = "很長的帳本名稱".repeat(5);
    const longTitle = "很長的消費名稱".repeat(6);
    const old = {
      ...backup!,
      ledger: { ...backup!.ledger, name: longName },
      expenses: backup!.expenses.map((e) => ({ ...e, title: longTitle })),
    };

    const target = await createTestDatabase();
    const report = await restoreBackup(target, [old]);

    expect(report.restored.map((l) => l.name)).toEqual([longName]);
    const summary = unwrap(await loadLedgerSummary(target, source.ledgerId));
    expect(summary.ledger.name).toBe(longName);
    expect(summary.expenses.map((e) => e.title)).toEqual([longTitle]);
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
    const file = await buildBackupFile(
      db,
      createMemoryCoverPhotoStore(),
      new Date("2026-10-21T17:00:00Z"),
    );
    expect(file.fileName).toBe("旅遊記帳備份-2026-10-22.json");

    const target = await createTestDatabase();
    const report = unwrap(
      await restoreFromBackupText(
        target,
        createMemoryCoverPhotoStore(),
        file.content,
      ),
    );
    expect(report.restored.map((l) => l.name)).toEqual(["東京"]);
  });

  it("writes nothing when the file is not a backup", async () => {
    const target = await createTestDatabase();
    expect(
      unwrapErr(
        await restoreFromBackupText(
          target,
          createMemoryCoverPhotoStore(),
          "{}",
        ),
      ).code,
    ).toBe("INVALID_BACKUP");
    expect(await collectBackup(target)).toEqual([]);
  });
});

describe("cover photos in backups", () => {
  it("carries a photo cover to a new phone and drops photos nobody uses", async () => {
    const { db, ledgerId } = await seededDatabase();
    const deps = depsFor(db);
    unwrap(
      await changeLedgerCover(deps, ledgerId, {
        style: "photo",
        palette: "ai",
        pattern: "dots",
        photo: "cover-1.jpg",
      }),
    );
    const source = createMemoryCoverPhotoStore({ "cover-1.jpg": "JPEGDATA" });
    const file = await buildBackupFile(db, source, NOW);

    const target = await createTestDatabase();
    const phone = createMemoryCoverPhotoStore({ "left-over.jpg": "OLD" });
    unwrap(await restoreFromBackupText(target, phone, file.content));

    const restored = (await createRepositories(target).ledgers.list())[0];
    expect(restored?.cover).toMatchObject({
      style: "photo",
      photo: "cover-1.jpg",
    });
    expect([...phone.files]).toEqual([["cover-1.jpg", "JPEGDATA"]]);
  });

  it("falls back to a band cover when the backup has no photo data", async () => {
    const { db, ledgerId } = await seededDatabase();
    const deps = depsFor(db);
    unwrap(
      await changeLedgerCover(deps, ledgerId, {
        style: "photo",
        palette: "matcha",
        pattern: "waves",
        photo: "gone.jpg",
      }),
    );
    // The photo file disappeared before the export
    const file = await buildBackupFile(db, createMemoryCoverPhotoStore(), NOW);

    const target = await createTestDatabase();
    unwrap(
      await restoreFromBackupText(
        target,
        createMemoryCoverPhotoStore(),
        file.content,
      ),
    );
    expect((await createRepositories(target).ledgers.list())[0]?.cover).toEqual(
      {
        style: "band",
        palette: "matcha",
        pattern: "waves",
      },
    );
  });
});

describe("journals in backups", () => {
  async function withJournal() {
    const source = await seededDatabase();
    const deps = depsFor(source.db);
    const journal = unwrap(
      await createJournal(deps, {
        name: "東京手帳",
        ledgerId: source.ledgerId,
        cover: { tape: "matcha", photo: "journal.jpg" },
      }),
    );
    await createRepositories(source.db).journalEntries.insert({
      id: "entry-1",
      journalId: journal.id,
      date: "2026-10-12",
      title: "淺草",
      body: "人好多",
      weather: "sunny",
      mood: "happy",
      photos: ["day1.jpg", "missing.jpg"],
      stickers: [],
      places: [
        {
          name: "淺草寺",
          location: { latitude: 35.7148, longitude: 139.7967 },
        },
      ],
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      deletedAt: null,
    });
    const photos = createMemoryCoverPhotoStore({
      "journal.jpg": "COVER",
      "day1.jpg": "DAY1",
    });
    return { ...source, journal, photos };
  }

  it("restores journals with their entries, photos and ledger binding", async () => {
    const source = await withJournal();
    const file = await buildBackupFile(source.db, source.photos, NOW);

    const target = await createTestDatabase();
    const phone = createMemoryCoverPhotoStore();
    const report = unwrap(
      await restoreFromBackupText(target, phone, file.content),
    );
    expect(report.journals.restored.map((j) => j.name)).toEqual(["東京手帳"]);

    const repos = createRepositories(target);
    expect(await repos.journals.findById(source.journal.id)).toEqual(
      source.journal,
    );
    // The photo that was already gone at export time is dropped from the entry
    expect((await repos.journalEntries.findById("entry-1"))?.photos).toEqual([
      "day1.jpg",
    ]);
    expect(Object.fromEntries(phone.files)).toEqual({
      "journal.jpg": "COVER",
      "day1.jpg": "DAY1",
    });

    // Restoring the same file again skips the journal
    const again = unwrap(
      await restoreFromBackupText(target, phone, file.content),
    );
    expect(again.journals.skipped.map((j) => j.id)).toEqual([
      source.journal.id,
    ]);
  });

  it("unbinds a journal whose ledger is not on the phone", async () => {
    const source = await withJournal();
    const ledgers = await collectBackup(source.db);
    const journals = await collectJournalBackups(source.db);
    const target = await createTestDatabase();
    const text = serializeBackup({
      exportedAt: NOW.toISOString(),
      ledgers: [],
      journals,
      illustrations: [],
      photos: {},
    });
    expect(ledgers).toHaveLength(1);
    unwrap(
      await restoreFromBackupText(target, createMemoryCoverPhotoStore(), text),
    );
    expect(
      (await createRepositories(target).journals.findById(source.journal.id))
        ?.ledgerId,
    ).toBeNull();
  });

  it("keeps journal photos when tidying up", async () => {
    const source = await withJournal();
    source.photos.files.set("stray.jpg", "X");
    await pruneCoverPhotos(source.db, source.photos);
    expect([...source.photos.files.keys()].sort()).toEqual([
      "day1.jpg",
      "journal.jpg",
    ]);
  });
});

describe("illustrations in backups", () => {
  const STROKES = [
    {
      tool: "pen",
      ink: "shu",
      width: 10,
      points: [
        [10, 10],
        [90, 40],
      ],
    },
  ] as const;

  async function withStickers() {
    const db = await createTestDatabase();
    const deps = depsFor(db);
    const journal = unwrap(
      await createJournal(deps, {
        name: "奈良",
        ledgerId: null,
        cover: { tape: "matcha", photo: null },
      }),
    );
    const repos = createRepositories(db);
    for (const id of ["deer", "torii"]) {
      await repos.illustrations.insert({
        id,
        strokes: STROKES.map((s) => ({ ...s, points: [...s.points] })),
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      });
    }
    await repos.journalEntries.insert({
      id: "entry-1",
      journalId: journal.id,
      date: "2026-10-12",
      title: "鹿",
      body: "",
      weather: null,
      mood: null,
      photos: [],
      places: [],
      stickers: [
        { illustrationId: "deer", x: 0.7, y: 0.5, size: 0.3, rotation: 10 },
        { illustrationId: "torii", x: 0.2, y: 1, size: 0.2, rotation: 0 },
      ],
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      deletedAt: null,
    });
    return { db, journal };
  }

  it("restores illustrations before the pages they are stuck on", async () => {
    const source = await withStickers();
    const file = await buildBackupFile(
      source.db,
      createMemoryCoverPhotoStore(),
      NOW,
    );

    const target = await createTestDatabase();
    const phone = createMemoryCoverPhotoStore();
    const report = unwrap(
      await restoreFromBackupText(target, phone, file.content),
    );
    expect(report.illustrations).toEqual({ restored: 2, skipped: 0 });
    const repos = createRepositories(target);
    expect((await repos.illustrations.list()).map((i) => i.id).sort()).toEqual([
      "deer",
      "torii",
    ]);
    expect(
      (await repos.journalEntries.findById("entry-1"))?.stickers,
    ).toHaveLength(2);

    const again = unwrap(
      await restoreFromBackupText(target, phone, file.content),
    );
    expect(again.illustrations).toEqual({ restored: 0, skipped: 2 });
  });

  it("leaves off stickers whose illustration is not in the backup", async () => {
    const source = await withStickers();
    const raw = JSON.parse(
      (await buildBackupFile(source.db, createMemoryCoverPhotoStore(), NOW))
        .content,
    );
    raw.illustrations = raw.illustrations.filter(
      (i: { id: string }) => i.id === "deer",
    );

    const target = await createTestDatabase();
    const report = unwrap(
      await restoreFromBackupText(
        target,
        createMemoryCoverPhotoStore(),
        JSON.stringify(raw),
      ),
    );
    expect(report.journals.restored).toHaveLength(1);
    expect(
      (
        await createRepositories(target).journalEntries.findById("entry-1")
      )?.stickers.map((s) => s.illustrationId),
    ).toEqual(["deer"]);
  });
});
