import { createTestDatabase } from "../../../data/db/testDatabase";
import { createRepositories } from "../../../data/repositories";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";
import { createLedger } from "../../ledger/services/ledgerCommands";
import {
  createJournal,
  deleteJournal,
  loadJournal,
  loadJournalShelf,
  loadLedgerChoices,
  updateJournal,
  type JournalCommandDeps,
} from "./journalCommands";

const COVER = { tape: "sakura", photo: null } as const;

async function setup() {
  const db = await createTestDatabase();
  let seq = 0;
  let clock = Date.UTC(2026, 10, 3);
  const deps: JournalCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => new Date((clock += 60_000)),
  };
  const kyoto = unwrap(
    await createLedger(deps, { name: "京都賞楓之旅", memberNames: ["我"] }),
  ).ledger;
  const seoul = unwrap(
    await createLedger(deps, { name: "首爾美食團", memberNames: ["我"] }),
  ).ledger;
  return { db, deps, kyoto, seoul };
}

describe("journal commands", () => {
  it("creates a journal with a trimmed name and a bound ledger", async () => {
    const { deps, kyoto } = await setup();
    const journal = unwrap(
      await createJournal(deps, {
        name: "  京都賞楓之旅 ",
        ledgerId: kyoto.id,
        cover: COVER,
      }),
    );
    expect(journal).toMatchObject({ name: "京都賞楓之旅", ledgerId: kyoto.id });
    expect(
      await createRepositories(deps.db).journals.findById(journal.id),
    ).toEqual(journal);
  });

  it("requires a name within the limit", async () => {
    const { deps } = await setup();
    const input = { ledgerId: null, cover: COVER };
    expect(
      unwrapErr(await createJournal(deps, { ...input, name: " " })),
    ).toEqual({ code: "EMPTY_NAME" });
    expect(
      unwrapErr(await createJournal(deps, { ...input, name: "x".repeat(21) })),
    ).toEqual({ code: "TEXT_TOO_LONG", field: "journalName", max: 20 });
  });

  it("binds a ledger to only one journal", async () => {
    const { deps, kyoto } = await setup();
    unwrap(
      await createJournal(deps, {
        name: "京都",
        ledgerId: kyoto.id,
        cover: COVER,
      }),
    );
    expect(
      unwrapErr(
        await createJournal(deps, {
          name: "又一本",
          ledgerId: kyoto.id,
          cover: COVER,
        }),
      ),
    ).toEqual({
      code: "LEDGER_HAS_JOURNAL",
      ledgerId: kyoto.id,
      journalName: "京都",
    });
  });

  it("does not bind the personal ledger or a missing one", async () => {
    const { db, deps } = await setup();
    await createRepositories(db).ledgers.insert({
      id: "personal",
      kind: "personal",
      name: "個人",
      baseCurrency: "TWD",
      cover: null,
      tripMonth: null,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:00:00.000Z",
    });
    for (const ledgerId of ["personal", "missing"]) {
      expect(
        unwrapErr(
          await createJournal(deps, { name: "手帳", ledgerId, cover: COVER }),
        ),
      ).toEqual({ code: "LEDGER_NOT_FOUND", ledgerId });
    }
  });

  it("updates the name, binding and cover, keeping its own binding allowed", async () => {
    const { deps, kyoto, seoul } = await setup();
    const journal = unwrap(
      await createJournal(deps, {
        name: "京都",
        ledgerId: kyoto.id,
        cover: COVER,
      }),
    );
    const same = unwrap(
      await updateJournal(deps, journal.id, {
        name: "京都",
        ledgerId: kyoto.id,
        cover: COVER,
      }),
    );
    expect(same.ledgerId).toBe(kyoto.id);

    const moved = unwrap(
      await updateJournal(deps, journal.id, {
        name: "首爾",
        ledgerId: seoul.id,
        cover: { tape: "ai", photo: "cover.jpg" },
      }),
    );
    expect(moved).toMatchObject({
      name: "首爾",
      ledgerId: seoul.id,
      cover: { tape: "ai", photo: "cover.jpg" },
    });
    expect(moved.updatedAt > journal.updatedAt).toBe(true);
    expect(
      unwrapErr(
        await updateJournal(deps, "missing", {
          name: "x",
          ledgerId: null,
          cover: COVER,
        }),
      ),
    ).toEqual({ code: "JOURNAL_NOT_FOUND", journalId: "missing" });
  });

  it("deletes a journal", async () => {
    const { deps } = await setup();
    const journal = unwrap(
      await createJournal(deps, { name: "台南", ledgerId: null, cover: COVER }),
    );
    unwrap(await deleteJournal(deps, journal.id));
    expect(unwrapErr(await deleteJournal(deps, journal.id)).code).toBe(
      "JOURNAL_NOT_FOUND",
    );
  });
});

describe("journal queries", () => {
  it("summarizes each journal for the shelf, newest first", async () => {
    const { db, deps, kyoto } = await setup();
    const first = unwrap(
      await createJournal(deps, {
        name: "京都",
        ledgerId: kyoto.id,
        cover: COVER,
      }),
    );
    const second = unwrap(
      await createJournal(deps, { name: "台南", ledgerId: null, cover: COVER }),
    );
    const repos = createRepositories(db);
    for (const [id, date] of [
      ["n1", "2025-11-23"],
      ["n2", "2025-11-21"],
    ] as const) {
      await repos.journalEntries.insert({
        id,
        journalId: first.id,
        date,
        title: id,
        body: "",
        weather: null,
        mood: null,
        photos: [],
        stickers: [],
        places: [],
        createdAt: "2026-11-03T00:00:00.000Z",
        updatedAt: "2026-11-03T00:00:00.000Z",
        deletedAt: null,
      });
    }

    const shelf = await loadJournalShelf(db);
    expect(shelf.map((o) => o.journal.id)).toEqual([second.id, first.id]);
    expect(shelf[1]).toMatchObject({
      ledger: { id: kyoto.id },
      entryCount: 2,
      firstDate: "2025-11-21",
      lastDate: "2025-11-23",
      latestEntry: { id: "n1" },
    });
    expect(shelf[0]).toMatchObject({
      ledger: null,
      entryCount: 0,
      firstDate: null,
      latestEntry: null,
    });

    const detail = unwrap(await loadJournal(db, first.id));
    expect(detail.entries.map((e) => e.id)).toEqual(["n2", "n1"]);
    expect(unwrapErr(await loadJournal(db, "missing")).code).toBe(
      "JOURNAL_NOT_FOUND",
    );
  });

  it("marks ledgers that another journal already uses", async () => {
    const { db, deps, kyoto, seoul } = await setup();
    const journal = unwrap(
      await createJournal(deps, {
        name: "京都",
        ledgerId: kyoto.id,
        cover: COVER,
      }),
    );
    const takenBy = async (selfId: string | null) =>
      Object.fromEntries(
        (await loadLedgerChoices(db, selfId)).map((c) => [
          c.ledger.id,
          c.takenBy,
        ]),
      );
    expect(await takenBy(null)).toEqual({
      [kyoto.id]: "京都",
      [seoul.id]: null,
    });
    // The journal being edited can keep its own ledger
    expect(await takenBy(journal.id)).toEqual({
      [kyoto.id]: null,
      [seoul.id]: null,
    });
  });
});
