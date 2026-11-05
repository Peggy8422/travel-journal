import type { SavedPlaceRecord } from "../../domain/places";
import { createTestDatabase } from "../db/testDatabase";
import { createRepositories } from "./index";
import { T0 } from "./testRecords";

function makePlace(
  overrides: Partial<SavedPlaceRecord> = {},
): SavedPlaceRecord {
  return {
    id: "p1",
    name: "本家 第一旭",
    location: { latitude: 34.9851, longitude: 135.7614 },
    city: "京都",
    kind: "restaurant",
    status: "visited",
    note: "湯頭很濃",
    ratings: [
      { criterionId: "value", score: 4 },
      { criterionId: "taste", score: 5 },
    ],
    revisit: true,
    photos: ["a.jpg", "b.jpg"],
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...overrides,
  };
}

async function setup() {
  const db = await createTestDatabase();
  return { db, repos: createRepositories(db) };
}

describe("savedPlaceRepository", () => {
  it("stores a place with its photos and scores in the criteria's order", async () => {
    const { repos } = await setup();
    await repos.savedPlaces.insert(makePlace());
    expect(await repos.savedPlaces.findById("p1")).toEqual(
      makePlace({
        ratings: [
          { criterionId: "taste", score: 5 },
          { criterionId: "value", score: 4 },
        ],
      }),
    );
  });

  it("rewrites photos and scores on update and keeps createdAt", async () => {
    const { repos } = await setup();
    await repos.savedPlaces.insert(makePlace());
    const later = "2026-10-02T00:00:00.000Z";
    await repos.savedPlaces.update(
      makePlace({
        name: "第一旭",
        status: "want",
        revisit: false,
        ratings: [{ criterionId: "vibe", score: 2 }],
        photos: ["c.jpg"],
        createdAt: later,
        updatedAt: later,
      }),
    );
    expect(await repos.savedPlaces.findById("p1")).toMatchObject({
      name: "第一旭",
      status: "want",
      revisit: false,
      ratings: [{ criterionId: "vibe", score: 2 }],
      photos: ["c.jpg"],
      createdAt: T0,
      updatedAt: later,
    });
    expect(await repos.savedPlaces.listPhotoNames()).toEqual(["c.jpg"]);
  });

  it("lists newest first, hides deleted places and brings them back", async () => {
    const { repos } = await setup();
    await repos.savedPlaces.insert(makePlace());
    await repos.savedPlaces.insert(
      makePlace({ id: "p2", createdAt: "2026-10-03T00:00:00.000Z" }),
    );
    expect((await repos.savedPlaces.list()).map((p) => p.id)).toEqual([
      "p2",
      "p1",
    ]);
    await repos.savedPlaces.softDelete("p2", "2026-10-04T00:00:00.000Z");
    expect((await repos.savedPlaces.list()).map((p) => p.id)).toEqual(["p1"]);
    expect(
      (await repos.savedPlaces.list({ includeDeleted: true })).map((p) => p.id),
    ).toEqual(["p2", "p1"]);
    expect(await repos.savedPlaces.listPhotoNames()).toEqual(
      expect.arrayContaining(["a.jpg", "b.jpg"]),
    );
    await repos.savedPlaces.restore("p2", "2026-10-05T00:00:00.000Z");
    expect(await repos.savedPlaces.findById("p2")).toMatchObject({
      deletedAt: null,
      updatedAt: "2026-10-05T00:00:00.000Z",
    });
  });

  it("reads unknown codes back as defaults", async () => {
    const { db, repos } = await setup();
    await repos.savedPlaces.insert(makePlace());
    await db.runAsync(
      "UPDATE saved_places SET kind = 'onsen', status = 'maybe' WHERE id = 'p1'",
    );
    expect(await repos.savedPlaces.findById("p1")).toMatchObject({
      kind: "other",
      status: "want",
    });
  });

  it("refuses scores for a criterion that does not exist", async () => {
    const { repos } = await setup();
    await expect(
      repos.savedPlaces.insert(
        makePlace({ ratings: [{ criterionId: "nope", score: 3 }] }),
      ),
    ).rejects.toThrow();
  });
});

describe("ratingCriterionRepository", () => {
  it("starts with the three default criteria", async () => {
    const { repos } = await setup();
    expect(
      (await repos.ratingCriteria.list()).map((c) => [c.id, c.label]),
    ).toEqual([
      ["taste", "好吃"],
      ["vibe", "氣氛"],
      ["value", "CP值"],
    ]);
  });

  it("adds, renames, reorders and archives criteria", async () => {
    const { repos } = await setup();
    await repos.ratingCriteria.insert({
      id: "c1",
      label: "服務",
      sortOrder: 3,
      archivedAt: null,
      createdAt: T0,
      updatedAt: T0,
    });
    const taste = (await repos.ratingCriteria.findById("taste"))!;
    await repos.ratingCriteria.update({
      ...taste,
      label: "味道",
      sortOrder: 4,
      archivedAt: T0,
      updatedAt: T0,
    });
    expect(
      (await repos.ratingCriteria.list()).map((c) => [
        c.id,
        c.label,
        c.archivedAt,
      ]),
    ).toEqual([
      ["vibe", "氣氛", null],
      ["value", "CP值", null],
      ["c1", "服務", null],
      ["taste", "味道", T0],
    ]);
  });
});
