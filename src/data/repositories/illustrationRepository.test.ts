import type {
  IllustrationRecord,
  JournalEntryRecord,
} from "../../domain/journal";
import { StoredDataError } from "./shared";
import { setupLedger, T0 } from "./testRecords";

function makeIllustration(
  overrides: Partial<IllustrationRecord> = {},
): IllustrationRecord {
  return {
    id: "i1",
    strokes: [
      {
        tool: "pen",
        ink: "shu",
        width: 12,
        points: [
          [100, 100],
          [200, 180],
        ],
      },
      { tool: "wash", ink: "sakura", width: 80, points: [[150, 150]] },
    ],
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

const ENTRY: JournalEntryRecord = {
  id: "n1",
  journalId: "j1",
  date: "2025-11-22",
  title: "鹿",
  body: "",
  weather: null,
  mood: null,
  photos: [],
  places: [],
  stickers: [
    { illustrationId: "i1", x: 0.8, y: 0.3, size: 0.25, rotation: -12 },
    { illustrationId: "i2", x: 0.2, y: 1.5, size: 0.4, rotation: 0 },
    { illustrationId: "i1", x: 0.5, y: 2, size: 0.1, rotation: 30 },
  ],
  createdAt: T0,
  updatedAt: T0,
  deletedAt: null,
};

async function setup() {
  const context = await setupLedger();
  await context.repos.journals.insert({
    id: "j1",
    name: "奈良",
    ledgerId: null,
    cover: { tape: "matcha", photo: null },
    createdAt: T0,
    updatedAt: T0,
  });
  return context;
}

describe("IllustrationRepository", () => {
  it("inserts, finds, lists and updates illustrations", async () => {
    const { repos } = await setup();
    await repos.illustrations.insert(makeIllustration());
    await repos.illustrations.insert(
      makeIllustration({ id: "i2", createdAt: "2026-10-02T00:00:00.000Z" }),
    );
    expect(await repos.illustrations.findById("i1")).toEqual(
      makeIllustration(),
    );
    expect(await repos.illustrations.findById("missing")).toBeUndefined();
    expect((await repos.illustrations.list()).map((i) => i.id)).toEqual([
      "i2",
      "i1",
    ]);

    const redrawn = makeIllustration({
      strokes: [{ tool: "pen", ink: "ai", width: 6, points: [[1, 2]] }],
      updatedAt: "2026-10-03T00:00:00.000Z",
    });
    await repos.illustrations.update(redrawn);
    expect(await repos.illustrations.findById("i1")).toEqual(redrawn);
  });

  it("takes a deleted illustration off every page, deleted ones too", async () => {
    const { repos } = await setup();
    await repos.illustrations.insert(makeIllustration());
    await repos.illustrations.insert(makeIllustration({ id: "i2" }));
    await repos.journalEntries.insert(ENTRY);
    await repos.journalEntries.insert({ ...ENTRY, id: "n2" });
    await repos.journalEntries.softDelete("n2", T0);

    await repos.illustrations.delete("i1");
    expect(await repos.illustrations.findById("i1")).toBeUndefined();
    for (const id of ["n1", "n2"]) {
      expect((await repos.journalEntries.findById(id))?.stickers).toEqual([
        ENTRY.stickers[1],
      ]);
    }
  });

  it("counts the pages each illustration is on, leaving out deleted ones", async () => {
    const { repos } = await setup();
    await repos.illustrations.insert(makeIllustration());
    await repos.illustrations.insert(makeIllustration({ id: "i2" }));
    await repos.illustrations.insert(makeIllustration({ id: "i3" }));
    await repos.journalEntries.insert(ENTRY);
    await repos.journalEntries.insert({ ...ENTRY, id: "n2" });
    await repos.journalEntries.insert({
      ...ENTRY,
      id: "n3",
      stickers: [ENTRY.stickers[1]!],
    });
    await repos.journalEntries.softDelete("n2", T0);
    // i1 is on n1 twice but counts as one page
    expect(await repos.illustrations.useCounts()).toEqual({ i1: 1, i2: 2 });
  });

  it("refuses a sticker for an illustration that does not exist", async () => {
    const { repos } = await setup();
    await expect(repos.journalEntries.insert(ENTRY)).rejects.toThrow();
  });

  it("reports damaged strokes", async () => {
    const { db, repos } = await setup();
    await db.runAsync(
      "INSERT INTO illustrations (id, strokes, created_at, updated_at) VALUES (?, ?, ?, ?)",
      ["bad", "{oops", T0, T0],
    );
    await expect(repos.illustrations.findById("bad")).rejects.toThrow(
      StoredDataError,
    );
  });
});

describe("entry stickers", () => {
  it("stores stickers in order and replaces them on update", async () => {
    const { repos } = await setup();
    await repos.illustrations.insert(makeIllustration());
    await repos.illustrations.insert(makeIllustration({ id: "i2" }));
    await repos.journalEntries.insert(ENTRY);
    expect(await repos.journalEntries.findById("n1")).toEqual(ENTRY);

    const updated = { ...ENTRY, stickers: [ENTRY.stickers[2]!] };
    await repos.journalEntries.update(updated);
    expect(await repos.journalEntries.findById("n1")).toEqual(updated);
  });
});
