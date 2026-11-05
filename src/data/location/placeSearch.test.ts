import { createPlaceSearch, toFoundPlaces } from "./placeSearch";

const KIYOMIZU = { latitude: 34.9948, longitude: 135.785 };

describe("toFoundPlaces", () => {
  it("puts the address on one line and drops the postal code", () => {
    expect(
      toFoundPlaces([
        {
          name: " 一蘭京都河原町店 ",
          address:
            "〒604-8041\n京都府京都市中京区\n蛸薬師通新京極東入裏寺町598",
          ...KIYOMIZU,
        },
      ]),
    ).toEqual([
      {
        name: "一蘭京都河原町店",
        address: "京都府京都市中京区 蛸薬師通新京極東入裏寺町598",
        location: KIYOMIZU,
      },
    ]);
  });

  it("uses the address when there is no name, and skips empty or duplicate places", () => {
    expect(
      toFoundPlaces([
        { name: null, address: "東山区, 京都市 清水1丁目294", ...KIYOMIZU },
        { name: "清水寺", address: null, ...KIYOMIZU },
        { name: "清水寺", address: "東山区", ...KIYOMIZU },
        { name: " ", address: null, ...KIYOMIZU },
        { name: "壞掉的", address: null, latitude: NaN, longitude: 0 },
      ]),
    ).toEqual([
      {
        name: "東山区, 京都市 清水1丁目294",
        address: null,
        location: KIYOMIZU,
      },
      { name: "清水寺", address: null, location: KIYOMIZU },
    ]);
  });
});

describe("createPlaceSearch", () => {
  it("is not available without the native module", () => {
    expect(createPlaceSearch()).toBeNull();
  });
});
