import {
  distanceMeters,
  isNearby,
  placeKindOf,
  savedPlaceNear,
} from "./nearby";

const kiyomizu = { latitude: 34.9949, longitude: 135.785 };

/** A point the given metres north of kiyomizu */
function north(meters: number) {
  return {
    latitude: kiyomizu.latitude + meters / 111_195,
    longitude: kiyomizu.longitude,
  };
}

describe("distanceMeters", () => {
  it("measures short distances in metres", () => {
    expect(distanceMeters(kiyomizu, kiyomizu)).toBe(0);
    expect(distanceMeters(kiyomizu, north(100))).toBeCloseTo(100, 0);
  });

  it("measures long distances", () => {
    const taipei = { latitude: 25.033, longitude: 121.5654 };
    expect(distanceMeters(kiyomizu, taipei) / 1000).toBeCloseTo(1760, -1);
  });
});

describe("savedPlaceNear", () => {
  it("picks the closest place within reach", () => {
    const far = { id: "far", location: north(50) };
    const close = { id: "close", location: north(20) };
    expect(savedPlaceNear(kiyomizu, [far, close])?.id).toBe("close");
    expect(isNearby(kiyomizu, north(50))).toBe(true);
  });

  it("ignores places too far away", () => {
    expect(savedPlaceNear(kiyomizu, [{ location: north(80) }])).toBeNull();
    expect(savedPlaceNear(kiyomizu, [])).toBeNull();
  });
});

describe("placeKindOf", () => {
  it("starts from the expense category", () => {
    expect(placeKindOf("food")).toBe("restaurant");
    expect(placeKindOf("lodging")).toBe("stay");
    expect(placeKindOf("transport")).toBe("other");
    expect(placeKindOf("舊分類")).toBe("other");
    expect(placeKindOf(null)).toBe("other");
  });
});
