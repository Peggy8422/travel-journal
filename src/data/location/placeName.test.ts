import { formatPlaceName, type GeocodedAddress } from "./placeName";

const empty: GeocodedAddress = {
  name: null,
  streetNumber: null,
  street: null,
  district: null,
  city: null,
  subregion: null,
  region: null,
  country: null,
};

describe("formatPlaceName", () => {
  it("returns null when there is no address", () => {
    expect(formatPlaceName([])).toBeNull();
  });

  it("prefers the place name and uses only the first address", () => {
    expect(
      formatPlaceName([
        { ...empty, name: " 一蘭 渋谷店 ", city: "渋谷区" },
        { ...empty, name: "別的地方" },
      ]),
    ).toBe("一蘭 渋谷店");
  });

  it("falls back to city, district and street when the name is a house number", () => {
    expect(
      formatPlaceName([
        {
          ...empty,
          name: "12",
          streetNumber: "12",
          street: "Orchard Road",
          district: "Orchard",
          city: "Singapore",
        },
      ]),
    ).toBe("Singapore Orchard Orchard Road");
  });

  it("skips a name that only repeats the street number", () => {
    expect(
      formatPlaceName([
        { ...empty, name: "3-2", streetNumber: "3-2", city: "京都市" },
      ]),
    ).toBe("京都市");
  });

  it("uses subregion or region when city is missing and drops duplicates", () => {
    expect(
      formatPlaceName([
        { ...empty, subregion: "Bali", district: "Bali", street: "Jalan Raya" },
      ]),
    ).toBe("Bali Jalan Raya");
    expect(formatPlaceName([{ ...empty, region: "Hokkaido" }])).toBe(
      "Hokkaido",
    );
  });

  it("falls back to country, then null", () => {
    expect(formatPlaceName([{ ...empty, country: "Japan" }])).toBe("Japan");
    expect(formatPlaceName([{ ...empty, name: "  " }])).toBeNull();
  });
});
