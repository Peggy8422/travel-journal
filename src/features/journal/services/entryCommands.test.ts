import { createTestDatabase } from "../../../data/db/testDatabase";
import { createRepositories } from "../../../data/repositories";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";
import { addExpense, createLedger } from "../../ledger/services/ledgerCommands";
import {
  deleteEntry,
  loadDeletedEntries,
  loadEntry,
  loadEntryForm,
  restoreEntry,
  updateEntry,
  writeEntry,
  type EntryInput,
} from "./entryCommands";
import { createJournal, type JournalCommandDeps } from "./journalCommands";

const COVER = { tape: "sakura", photo: null } as const;
const PAGE: EntryInput = {
  date: "2025-11-22",
  title: " 伏見稻荷 ",
  body: "\n一路爬到山頂。\n",
  weather: "sunny",
  mood: null,
  photos: [],
  places: [],
};

const KIYOMIZU = { latitude: 34.9949, longitude: 135.785 };

async function setup() {
  const db = await createTestDatabase();
  let seq = 0;
  let clock = Date.UTC(2026, 10, 3);
  const deps: JournalCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => new Date((clock += 60_000)),
  };
  const journal = unwrap(
    await createJournal(deps, { name: "京都", ledgerId: null, cover: COVER }),
  );
  return { db, deps, journal };
}

describe("entry commands", () => {
  it("writes an entry with trimmed text, its photos and places", async () => {
    const { db, deps, journal } = await setup();
    const entry = unwrap(
      await writeEntry(deps, journal.id, {
        ...PAGE,
        photos: ["b.jpg", "a.jpg"],
        places: [{ name: " 清水寺 ", location: KIYOMIZU }],
      }),
    );
    expect(entry).toMatchObject({
      journalId: journal.id,
      date: "2025-11-22",
      title: "伏見稻荷",
      body: "一路爬到山頂。",
      weather: "sunny",
      mood: null,
      photos: ["b.jpg", "a.jpg"],
      places: [{ name: "清水寺", location: KIYOMIZU }],
      deletedAt: null,
    });
    expect(
      await createRepositories(db).journalEntries.findById(entry.id),
    ).toEqual(entry);
  });

  it("rejects an empty page, a bad date, long text and a missing journal", async () => {
    const { deps, journal } = await setup();
    const blank = { ...PAGE, title: " ", body: "", weather: null };
    expect(unwrapErr(await writeEntry(deps, journal.id, blank))).toEqual({
      code: "EMPTY_ENTRY",
    });
    // A stamp or a photo alone is enough
    unwrap(await writeEntry(deps, journal.id, { ...blank, mood: "tired" }));
    unwrap(await writeEntry(deps, journal.id, { ...blank, photos: ["a.jpg"] }));
    // So is a place
    unwrap(
      await writeEntry(deps, journal.id, {
        ...blank,
        places: [{ name: "清水寺", location: KIYOMIZU }],
      }),
    );
    expect(
      unwrapErr(
        await writeEntry(deps, journal.id, {
          ...PAGE,
          places: [{ name: "  ", location: KIYOMIZU }],
        }),
      ),
    ).toEqual({ code: "EMPTY_PLACE_NAME" });
    expect(
      unwrapErr(
        await writeEntry(deps, journal.id, {
          ...PAGE,
          places: [{ name: "字".repeat(41), location: KIYOMIZU }],
        }),
      ),
    ).toEqual({ code: "TEXT_TOO_LONG", field: "placeName", max: 40 });
    const tenPhotos = Array.from({ length: 10 }, (_, i) => `p${i}.jpg`);
    expect(
      unwrapErr(
        await writeEntry(deps, journal.id, { ...PAGE, photos: tenPhotos }),
      ),
    ).toEqual({ code: "TOO_MANY_PHOTOS", max: 9 });
    expect(
      unwrapErr(
        await writeEntry(deps, journal.id, { ...PAGE, date: "2025-02-30" }),
      ),
    ).toEqual({ code: "INVALID_ENTRY_DATE", date: "2025-02-30" });
    expect(
      unwrapErr(
        await writeEntry(deps, journal.id, { ...PAGE, title: "字".repeat(31) }),
      ),
    ).toEqual({ code: "TEXT_TOO_LONG", field: "entryTitle", max: 30 });
    expect(
      unwrapErr(
        await writeEntry(deps, journal.id, {
          ...PAGE,
          body: "字".repeat(2001),
        }),
      ),
    ).toEqual({ code: "TEXT_TOO_LONG", field: "entryBody", max: 2000 });
    expect(unwrapErr(await writeEntry(deps, "missing", PAGE)).code).toBe(
      "JOURNAL_NOT_FOUND",
    );
  });

  it("updates the text, stamps, photos and places", async () => {
    const { deps, journal } = await setup();
    const place = { name: "清水寺", location: KIYOMIZU };
    const entry = unwrap(
      await writeEntry(deps, journal.id, {
        ...PAGE,
        photos: ["a.jpg"],
        places: [place],
      }),
    );
    const arashiyama = {
      name: "嵐山",
      location: { latitude: 35.0094, longitude: 135.6668 },
    };

    const updated = unwrap(
      await updateEntry(deps, entry.id, {
        ...PAGE,
        date: "2025-11-23",
        title: "嵐山",
        weather: null,
        mood: "moved",
        photos: ["c.jpg", "a.jpg"],
        places: [arashiyama, place],
      }),
    );
    expect(updated).toMatchObject({
      date: "2025-11-23",
      title: "嵐山",
      weather: null,
      mood: "moved",
      photos: ["c.jpg", "a.jpg"],
      places: [arashiyama, place],
      createdAt: entry.createdAt,
    });
    expect(updated.updatedAt > entry.updatedAt).toBe(true);
    expect(unwrapErr(await updateEntry(deps, "missing", PAGE)).code).toBe(
      "ENTRY_NOT_FOUND",
    );
  });

  it("soft deletes an entry and puts it back", async () => {
    const { db, deps, journal } = await setup();
    const kept = unwrap(await writeEntry(deps, journal.id, PAGE));
    const entry = unwrap(
      await writeEntry(deps, journal.id, { ...PAGE, date: "2025-11-21" }),
    );
    unwrap(await deleteEntry(deps, entry.id));

    expect(unwrapErr(await loadEntry(db, entry.id)).code).toBe(
      "ENTRY_NOT_FOUND",
    );
    expect(unwrapErr(await updateEntry(deps, entry.id, PAGE)).code).toBe(
      "ENTRY_NOT_FOUND",
    );
    expect(unwrapErr(await deleteEntry(deps, entry.id)).code).toBe(
      "ENTRY_NOT_FOUND",
    );
    expect((await loadDeletedEntries(db, journal.id)).map((e) => e.id)).toEqual(
      [entry.id],
    );
    // The page left behind is Day 1 now
    expect(unwrap(await loadEntry(db, kept.id)).dayNumber).toBe(1);

    unwrap(await restoreEntry(deps, entry.id));
    unwrap(await restoreEntry(deps, entry.id));
    expect(await loadDeletedEntries(db, journal.id)).toEqual([]);
    expect(unwrap(await loadEntry(db, kept.id)).dayNumber).toBe(2);
    expect(unwrapErr(await restoreEntry(deps, "missing")).code).toBe(
      "ENTRY_NOT_FOUND",
    );
  });
});

describe("entry form", () => {
  it("suggests the day after the last page and lists the other dates", async () => {
    const { db, deps, journal } = await setup();
    const first = unwrap(await writeEntry(deps, journal.id, PAGE));
    unwrap(await writeEntry(deps, journal.id, { ...PAGE, date: "2025-11-24" }));

    const fresh = unwrap(
      await loadEntryForm(db, journal.id, null, "2026-11-03"),
    );
    expect(fresh).toMatchObject({
      entry: null,
      ledger: null,
      date: "2025-11-25",
      otherDates: ["2025-11-22", "2025-11-24"],
    });

    const editing = unwrap(
      await loadEntryForm(db, journal.id, first.id, "2026-11-03"),
    );
    expect(editing).toMatchObject({
      entry: { id: first.id },
      date: "2025-11-22",
      otherDates: ["2025-11-24"],
    });
    expect(
      unwrapErr(await loadEntryForm(db, journal.id, "missing", "2026-11-03"))
        .code,
    ).toBe("ENTRY_NOT_FOUND");
  });

  it("starts a bound journal on the day of the first expense", async () => {
    const { db, deps } = await setup();
    const { ledger, members } = unwrap(
      await createLedger(deps, { name: "首爾", memberNames: ["我"] }),
    );
    const me = members[0]!.id;
    unwrap(
      await addExpense(deps, ledger.id, {
        payerId: me,
        amountMinor: 100,
        currency: "TWD",
        fx: null,
        split: { kind: "equal", participantIds: [me] },
        title: "早餐",
        note: null,
        category: null,
        placeName: null,
        location: null,
        occurredAt: "2026-03-06T08:00:00+09:00",
      }),
    );
    const journal = unwrap(
      await createJournal(deps, {
        name: "首爾",
        ledgerId: ledger.id,
        cover: COVER,
      }),
    );
    const form = unwrap(
      await loadEntryForm(db, journal.id, null, "2026-11-03"),
    );
    expect(form).toMatchObject({
      ledger: { id: ledger.id },
      date: "2026-03-06",
    });
  });
});
