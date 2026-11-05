import { createTestDatabase } from "../../../data/db/testDatabase";
import { createRepositories } from "../../../data/repositories";
import {
  ILLUSTRATION_STROKE_LIMIT,
  type IllustrationStroke,
} from "../../../domain/journal";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";
import {
  deleteIllustration,
  loadIllustration,
  loadIllustrationLibrary,
  saveIllustration,
} from "./illustrationCommands";
import { createJournal, type JournalCommandDeps } from "./journalCommands";
import { writeEntry } from "./entryCommands";

const LINE: IllustrationStroke = {
  tool: "pen",
  ink: "shu",
  width: 12,
  points: [
    [100.4, 100.6],
    [1020, 300],
  ],
};

async function setup() {
  const db = await createTestDatabase();
  let seq = 0;
  let clock = Date.UTC(2026, 10, 5);
  const deps: JournalCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => new Date((clock += 60_000)),
  };
  return { db, deps };
}

describe("illustration commands", () => {
  it("saves a new drawing with tidied points and redraws it", async () => {
    const { db, deps } = await setup();
    const saved = unwrap(await saveIllustration(deps, null, [LINE]));
    expect(saved.strokes).toEqual([
      {
        ...LINE,
        points: [
          [100, 101],
          [1000, 300],
        ],
      },
    ]);

    const wash: IllustrationStroke = {
      tool: "wash",
      ink: "sakura",
      width: 80,
      points: [[500, 500]],
    };
    const redrawn = unwrap(
      await saveIllustration(deps, saved.id, [...saved.strokes, wash]),
    );
    expect(redrawn).toMatchObject({
      id: saved.id,
      createdAt: saved.createdAt,
    });
    expect(redrawn.updatedAt > saved.updatedAt).toBe(true);
    expect(unwrap(await loadIllustration(db, saved.id))).toEqual({
      illustration: redrawn,
      useCount: 0,
    });
  });

  it("refuses an empty canvas, too many strokes and a missing drawing", async () => {
    const { deps } = await setup();
    expect(unwrapErr(await saveIllustration(deps, null, [])).code).toBe(
      "EMPTY_ILLUSTRATION",
    );
    expect(
      unwrapErr(
        await saveIllustration(deps, null, [{ ...LINE, tool: "eraser" }]),
      ).code,
    ).toBe("EMPTY_ILLUSTRATION");
    expect(
      unwrapErr(
        await saveIllustration(
          deps,
          null,
          Array(ILLUSTRATION_STROKE_LIMIT + 1).fill(LINE),
        ),
      ),
    ).toEqual({
      code: "ILLUSTRATION_TOO_BIG",
      maxStrokes: ILLUSTRATION_STROKE_LIMIT,
    });
    expect(
      unwrapErr(await saveIllustration(deps, "missing", [LINE])).code,
    ).toBe("ILLUSTRATION_NOT_FOUND");
    expect(unwrapErr(await deleteIllustration(deps, "missing")).code).toBe(
      "ILLUSTRATION_NOT_FOUND",
    );
  });

  it("lists drawings newest first with how many pages use them", async () => {
    const { db, deps } = await setup();
    const deer = unwrap(await saveIllustration(deps, null, [LINE]));
    const torii = unwrap(await saveIllustration(deps, null, [LINE]));
    const journal = unwrap(
      await createJournal(deps, {
        name: "奈良",
        ledgerId: null,
        cover: { tape: "matcha", photo: null },
      }),
    );
    const entry = unwrap(
      await writeEntry(deps, journal.id, {
        date: "2025-11-22",
        title: "鹿",
        body: "",
        weather: null,
        mood: null,
        photos: [],
        places: [],
      }),
    );
    await createRepositories(db).journalEntries.update({
      ...entry,
      stickers: [
        { illustrationId: deer.id, x: 0.5, y: 0.5, size: 0.3, rotation: 0 },
      ],
    });

    expect(
      (await loadIllustrationLibrary(db)).map((o) => [
        o.illustration.id,
        o.useCount,
      ]),
    ).toEqual([
      [torii.id, 0],
      [deer.id, 1],
    ]);

    unwrap(await deleteIllustration(deps, deer.id));
    expect(
      (await loadIllustrationLibrary(db)).map((o) => o.illustration.id),
    ).toEqual([torii.id]);
    expect(
      (await createRepositories(db).journalEntries.findById(entry.id))
        ?.stickers,
    ).toEqual([]);
  });
});
