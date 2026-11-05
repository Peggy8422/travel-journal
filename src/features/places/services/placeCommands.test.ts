import { createTestDatabase } from "../../../data/db/testDatabase";
import { unwrap, unwrapErr } from "../../../domain/ledger/testFixtures";
import type { DeviceLocator } from "../../../domain/location";
import {
  addCriterion,
  addPlace,
  archiveCriterion,
  cityOf,
  deletePlace,
  groupByCity,
  loadCriteria,
  loadPlace,
  loadPlaceForm,
  loadPlaceList,
  moveCriterion,
  renameCriterion,
  restoreCriterion,
  restorePlace,
  updatePlace,
  type PlaceCommandDeps,
  type PlaceInput,
} from "./placeCommands";

const RAMEN: PlaceInput = {
  name: " 本家 第一旭 ",
  location: { latitude: 34.9851, longitude: 135.7614 },
  city: " 京都市 ",
  kind: "restaurant",
  status: "visited",
  note: " 湯頭很濃 ",
  ratings: [
    { criterionId: "taste", score: 4 },
    { criterionId: "value", score: 3.6 },
    { criterionId: "taste", score: 5 },
  ],
  revisit: true,
  photos: ["a.jpg"],
};

async function setup() {
  const db = await createTestDatabase();
  let seq = 0;
  let clock = Date.UTC(2026, 10, 5);
  const deps: PlaceCommandDeps = {
    db,
    newId: () => `id-${++seq}`,
    now: () => new Date((clock += 60_000)),
  };
  return { db, deps };
}

describe("place commands", () => {
  it("saves a place with trimmed text and one score per criterion", async () => {
    const { db, deps } = await setup();
    const place = unwrap(await addPlace(deps, RAMEN));
    expect(place).toMatchObject({
      name: "本家 第一旭",
      city: "京都市",
      note: "湯頭很濃",
      ratings: [
        { criterionId: "taste", score: 5 },
        { criterionId: "value", score: 4 },
      ],
      deletedAt: null,
    });
    expect(unwrap(await loadPlace(db, place.id)).place).toEqual(place);
  });

  it("refuses a blank name, long text, a missing criterion and too many photos", async () => {
    const { deps } = await setup();
    expect(unwrapErr(await addPlace(deps, { ...RAMEN, name: " " }))).toEqual({
      code: "EMPTY_PLACE_NAME",
    });
    expect(
      unwrapErr(await addPlace(deps, { ...RAMEN, city: "京".repeat(21) })),
    ).toMatchObject({ code: "TEXT_TOO_LONG", field: "city" });
    expect(
      unwrapErr(
        await addPlace(deps, {
          ...RAMEN,
          ratings: [{ criterionId: "gone", score: 3 }],
        }),
      ),
    ).toEqual({ code: "RATING_CRITERION_NOT_FOUND", criterionId: "gone" });
    expect(
      unwrapErr(await addPlace(deps, { ...RAMEN, photos: Array(7).fill("p") })),
    ).toEqual({ code: "TOO_MANY_PHOTOS", max: 6 });
  });

  it("edits a place, keeps its creation time and refuses a deleted one", async () => {
    const { deps } = await setup();
    const place = unwrap(await addPlace(deps, RAMEN));
    const edited = unwrap(
      await updatePlace(deps, place.id, {
        ...RAMEN,
        status: "want",
        ratings: [],
      }),
    );
    expect(edited).toMatchObject({
      status: "want",
      ratings: [],
      createdAt: place.createdAt,
    });
    expect(edited.updatedAt > place.updatedAt).toBe(true);
    unwrap(await deletePlace(deps, place.id));
    expect(unwrapErr(await updatePlace(deps, place.id, RAMEN)).code).toBe(
      "PLACE_NOT_FOUND",
    );
  });

  it("moves deleted places to the fold and brings them back", async () => {
    const { db, deps } = await setup();
    const first = unwrap(await addPlace(deps, RAMEN));
    const second = unwrap(await addPlace(deps, { ...RAMEN, name: "鍵善良房" }));
    unwrap(await deletePlace(deps, first.id));
    let list = await loadPlaceList(db);
    expect(list.places.map((p) => p.id)).toEqual([second.id]);
    expect(list.deleted.map((p) => p.id)).toEqual([first.id]);
    expect(list.criteria).toHaveLength(3);
    expect(unwrapErr(await loadPlace(db, first.id)).code).toBe(
      "PLACE_NOT_FOUND",
    );
    unwrap(await restorePlace(deps, first.id));
    unwrap(await restorePlace(deps, first.id));
    list = await loadPlaceList(db);
    expect(list.places.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(list.deleted).toEqual([]);
  });

  it("offers the cities already used, most used first", async () => {
    const { db, deps } = await setup();
    unwrap(await addPlace(deps, { ...RAMEN, city: "大阪市" }));
    unwrap(await addPlace(deps, RAMEN));
    unwrap(await addPlace(deps, RAMEN));
    unwrap(await addPlace(deps, { ...RAMEN, city: "" }));
    const form = unwrap(await loadPlaceForm(db, null));
    expect(form.place).toBeNull();
    expect(form.cities).toEqual(["京都市", "大阪市"]);
    expect(unwrapErr(await loadPlaceForm(db, "nope")).code).toBe(
      "PLACE_NOT_FOUND",
    );
  });
});

describe("groupByCity", () => {
  it("puts the most recent city first and places without a city last", async () => {
    const { db, deps } = await setup();
    unwrap(await addPlace(deps, { ...RAMEN, name: "A", city: "大阪市" }));
    unwrap(await addPlace(deps, { ...RAMEN, name: "B", city: "" }));
    unwrap(await addPlace(deps, { ...RAMEN, name: "C", city: "京都市" }));
    unwrap(await addPlace(deps, { ...RAMEN, name: "D", city: "大阪市" }));
    const groups = groupByCity((await loadPlaceList(db)).places);
    expect(groups.map((g) => [g.city, g.places.map((p) => p.name)])).toEqual([
      ["大阪市", ["D", "A"]],
      ["京都市", ["C"]],
      ["", ["B"]],
    ]);
  });
});

describe("rating criteria", () => {
  it("adds, renames and reorders criteria", async () => {
    const { db, deps } = await setup();
    const service = unwrap(await addCriterion(deps, " 服務 "));
    expect(service).toMatchObject({ label: "服務", sortOrder: 3 });
    unwrap(await renameCriterion(deps, "taste", "味道"));
    unwrap(await moveCriterion(deps, service.id, -1));
    unwrap(await moveCriterion(deps, "taste", -1));
    expect((await loadCriteria(db)).map((c) => c.label)).toEqual([
      "味道",
      "氣氛",
      "服務",
      "CP值",
    ]);
  });

  it("refuses blank, duplicate and too many active criteria", async () => {
    const { deps } = await setup();
    expect(unwrapErr(await addCriterion(deps, " ")).code).toBe(
      "EMPTY_CRITERION_LABEL",
    );
    expect(unwrapErr(await addCriterion(deps, "cp值"))).toEqual({
      code: "DUPLICATE_CRITERION_LABEL",
      label: "cp值",
    });
    expect(unwrapErr(await renameCriterion(deps, "vibe", "好吃")).code).toBe(
      "DUPLICATE_CRITERION_LABEL",
    );
    expect(unwrapErr(await addCriterion(deps, "1234567")).code).toBe(
      "TEXT_TOO_LONG",
    );
    unwrap(await addCriterion(deps, "服務"));
    unwrap(await addCriterion(deps, "排隊"));
    expect(unwrapErr(await addCriterion(deps, "交通"))).toEqual({
      code: "TOO_MANY_CRITERIA",
      max: 5,
    });
  });

  it("archives a criterion but keeps its scores, and brings it back", async () => {
    const { db, deps } = await setup();
    const place = unwrap(await addPlace(deps, RAMEN));
    unwrap(await archiveCriterion(deps, "taste"));
    // A name freed by archiving can be used again
    const fresh = unwrap(await addCriterion(deps, "好吃"));
    expect(unwrap(await loadPlace(db, place.id)).place.ratings).toEqual(
      place.ratings,
    );
    expect(unwrapErr(await restoreCriterion(deps, "taste")).code).toBe(
      "DUPLICATE_CRITERION_LABEL",
    );
    unwrap(await archiveCriterion(deps, fresh.id));
    unwrap(await restoreCriterion(deps, "taste"));
    const criteria = await loadCriteria(db);
    expect(
      criteria.filter((c) => c.archivedAt === null).map((c) => c.id),
    ).toEqual(["vibe", "value", "taste"]);
  });
});

describe("cityOf", () => {
  function locator(cityAt: DeviceLocator["cityAt"]): DeviceLocator {
    return {
      requestPermission: jest.fn(),
      hasPermission: jest.fn(),
      currentPosition: jest.fn(),
      lastKnownPosition: jest.fn(),
      placeNameAt: jest.fn(),
      cityAt,
    };
  }
  const point = { latitude: 35, longitude: 135.7 };

  it("returns the city, or null when it cannot be looked up", async () => {
    expect(
      await cityOf(
        locator(async () => " 京都市 "),
        point,
      ),
    ).toBe("京都市");
    expect(
      await cityOf(
        locator(async () => null),
        point,
      ),
    ).toBeNull();
    expect(
      await cityOf(
        locator(async () => {
          throw new Error("offline");
        }),
        point,
      ),
    ).toBeNull();
  });
});
