import type { FoundPlace, PlaceSearch } from "../../../domain/location";
import { PLACE_SEARCH_LIMIT, searchPlaces } from "./searchPlaces";

const KYOTO = {
  latitude: 35,
  longitude: 135.77,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

function place(i: number): FoundPlace {
  return {
    name: `一蘭 ${i} 號店`,
    address: null,
    location: { latitude: 35 + i / 1000, longitude: 135.77 },
  };
}

describe("searchPlaces", () => {
  it("searches the trimmed keyword near the map and keeps the first results", async () => {
    const search = jest.fn<
      ReturnType<PlaceSearch["search"]>,
      Parameters<PlaceSearch["search"]>
    >(async () => Array.from({ length: 20 }, (_, i) => place(i)));
    const result = await searchPlaces({ search }, " 一蘭 ", KYOTO);

    expect(search).toHaveBeenCalledWith("一蘭", KYOTO);
    expect(result.ok && result.value).toHaveLength(PLACE_SEARCH_LIMIT);
    expect(result.ok && result.value[0]).toEqual(place(0));
  });

  it("does not search a blank keyword", async () => {
    const search = jest.fn();
    expect(await searchPlaces({ search }, "  ", null)).toEqual({
      ok: true,
      value: [],
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("turns a failed search into an error", async () => {
    const search = async () => {
      throw new Error("offline");
    };
    expect(await searchPlaces({ search }, "清水寺", null)).toEqual({
      ok: false,
      error: { code: "PLACE_SEARCH_FAILED" },
    });
  });
});
