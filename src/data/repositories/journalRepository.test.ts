import type { JournalEntryRecord, JournalRecord } from "../../domain/journal";
import { setupLedger, T0 } from "./testRecords";

function makeJournal(overrides: Partial<JournalRecord> = {}): JournalRecord {
  return {
    id: "j1",
    name: "京都賞楓之旅",
    ledgerId: "ledger-1",
    cover: { tape: "sakura", photo: null },
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

function makeEntry(
  overrides: Partial<JournalEntryRecord> = {},
): JournalEntryRecord {
  return {
    id: "n1",
    journalId: "j1",
    date: "2025-11-22",
    title: "千本鳥居",
    body: "爬到一半就放棄",
    weather: "sunny",
    mood: "happy",
    photos: ["p1.jpg", "p2.jpg"],
    places: [
      {
        name: "伏見稻荷大社",
        location: { latitude: 34.9671, longitude: 135.7727 },
      },
    ],
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

describe("JournalRepository", () => {
  it("inserts, finds, lists and updates a journal", async () => {
    const { repos } = await setupLedger();
    await repos.journals.insert(makeJournal());
    await repos.journals.insert(
      makeJournal({
        id: "j2",
        name: "台南",
        ledgerId: null,
        createdAt: "2026-10-02T00:00:00.000Z",
      }),
    );
    expect(await repos.journals.findById("j1")).toEqual(makeJournal());
    expect((await repos.journals.findByLedger("ledger-1"))?.id).toBe("j1");
    expect((await repos.journals.list()).map((j) => j.id)).toEqual([
      "j2",
      "j1",
    ]);

    const updated = makeJournal({
      name: "京都",
      ledgerId: null,
      cover: { tape: "ai", photo: "cover.jpg" },
      updatedAt: "2026-10-03T00:00:00.000Z",
    });
    await repos.journals.update(updated);
    expect(await repos.journals.findById("j1")).toEqual(updated);
    expect(await repos.journals.findByLedger("ledger-1")).toBeUndefined();
  });

  it("binds a ledger to at most one journal", async () => {
    const { repos } = await setupLedger();
    await repos.journals.insert(makeJournal());
    await expect(
      repos.journals.insert(makeJournal({ id: "j2" })),
    ).rejects.toThrow();
    // Several unbound journals are fine
    await repos.journals.insert(makeJournal({ id: "j3", ledgerId: null }));
    await repos.journals.insert(makeJournal({ id: "j4", ledgerId: null }));
  });

  it("keeps the journal when its ledger is deleted", async () => {
    const { repos } = await setupLedger();
    await repos.journals.insert(makeJournal());
    await repos.ledgers.delete("ledger-1");
    expect((await repos.journals.findById("j1"))?.ledgerId).toBeNull();
  });

  it("reads an unknown tape as the first one", async () => {
    const { db, repos } = await setupLedger();
    await repos.journals.insert(makeJournal());
    await db.runAsync("UPDATE journals SET cover_tape = 'neon'");
    expect((await repos.journals.findById("j1"))?.cover.tape).toBe("sakura");
  });
});

describe("JournalEntryRepository", () => {
  async function setup() {
    const context = await setupLedger();
    await context.repos.journals.insert(makeJournal());
    return context;
  }

  it("stores an entry with its photos and places in order", async () => {
    const { repos } = await setup();
    await repos.journalEntries.insert(makeEntry());
    expect(await repos.journalEntries.findById("n1")).toEqual(makeEntry());
    expect(await repos.journalEntries.findById("missing")).toBeUndefined();
  });

  it("replaces photos and places on update", async () => {
    const { repos } = await setup();
    await repos.journalEntries.insert(makeEntry());
    const updated = makeEntry({
      title: "",
      weather: null,
      photos: ["p2.jpg"],
      places: [],
      updatedAt: "2026-10-02T00:00:00.000Z",
    });
    await repos.journalEntries.update(updated);
    expect(await repos.journalEntries.findById("n1")).toEqual(updated);
  });

  it("lists by date, then by creation, and hides deleted entries", async () => {
    const { repos } = await setup();
    await repos.journalEntries.insert(
      makeEntry({ id: "late", date: "2025-11-23" }),
    );
    await repos.journalEntries.insert(
      makeEntry({ id: "second", createdAt: "2026-10-02T00:00:00.000Z" }),
    );
    await repos.journalEntries.insert(makeEntry({ id: "first" }));
    await repos.journalEntries.insert(
      makeEntry({ id: "gone", date: "2025-11-21" }),
    );
    await repos.journalEntries.softDelete("gone", "2026-10-03T00:00:00.000Z");

    const ids = async (includeDeleted = false) =>
      (await repos.journalEntries.listByJournal("j1", { includeDeleted })).map(
        (e) => e.id,
      );
    expect(await ids()).toEqual(["first", "second", "late"]);
    expect(await ids(true)).toEqual(["gone", "first", "second", "late"]);

    await repos.journalEntries.restore("gone", "2026-10-04T00:00:00.000Z");
    expect(await ids()).toEqual(["gone", "first", "second", "late"]);
  });

  it("drops unknown stamp codes when reading", async () => {
    const { db, repos } = await setup();
    await repos.journalEntries.insert(makeEntry());
    await db.runAsync("UPDATE journal_entries SET weather = 'thunder'");
    expect((await repos.journalEntries.findById("n1"))?.weather).toBeNull();
  });

  it("lists every photo in use, deleted entries included", async () => {
    const { repos } = await setup();
    await repos.journalEntries.insert(makeEntry());
    await repos.journalEntries.insert(
      makeEntry({ id: "n2", photos: ["p2.jpg", "p3.jpg"] }),
    );
    await repos.journalEntries.softDelete("n2", T0);
    expect((await repos.journalEntries.listPhotoNames()).sort()).toEqual([
      "p1.jpg",
      "p2.jpg",
      "p3.jpg",
    ]);
  });

  it("removes entries with their journal", async () => {
    const { db, repos } = await setup();
    await repos.journalEntries.insert(makeEntry());
    await repos.journals.delete("j1");
    expect(await repos.journalEntries.findById("n1")).toBeUndefined();
    const left = await db.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM journal_entry_photos",
    );
    expect(left?.count).toBe(0);
  });

  it("rejects a malformed date", async () => {
    const { repos } = await setup();
    await expect(
      repos.journalEntries.insert(makeEntry({ date: "2025/11/22" })),
    ).rejects.toThrow();
  });
});
