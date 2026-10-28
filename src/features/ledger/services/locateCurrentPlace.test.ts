import type { DeviceLocator } from "../../../domain/location";
import {
  describePosition,
  lastKnownPositionIfAllowed,
  locateCurrentPlace,
  locateCurrentPosition,
} from "./locateCurrentPlace";

const shibuya = { latitude: 35.6595, longitude: 139.7005 };
const lastKnown = { latitude: 35.66, longitude: 139.7 };

function fakeLocator(overrides: Partial<DeviceLocator> = {}): DeviceLocator {
  return {
    requestPermission: jest.fn().mockResolvedValue(true),
    hasPermission: jest.fn().mockResolvedValue(true),
    currentPosition: jest.fn().mockResolvedValue(shibuya),
    lastKnownPosition: jest.fn().mockResolvedValue(lastKnown),
    placeNameAt: jest.fn().mockResolvedValue("渋谷駅"),
    ...overrides,
  };
}

describe("locateCurrentPlace", () => {
  it("returns the current position and its place name", async () => {
    const locator = fakeLocator();

    expect(await locateCurrentPlace(locator)).toEqual({
      ok: true,
      value: {
        location: shibuya,
        placeName: "渋谷駅",
        approximate: false,
        placeNameLookupFailed: false,
      },
    });
    expect(locator.placeNameAt).toHaveBeenCalledWith(shibuya);
    expect(locator.lastKnownPosition).not.toHaveBeenCalled();
  });

  it("reports permission denied without touching the location", async () => {
    const locator = fakeLocator({
      requestPermission: jest.fn().mockResolvedValue(false),
    });

    expect(await locateCurrentPlace(locator)).toEqual({
      ok: false,
      error: { code: "LOCATION_PERMISSION_DENIED" },
    });
    expect(locator.currentPosition).not.toHaveBeenCalled();
  });

  it("treats a failing permission request as unavailable", async () => {
    const locator = fakeLocator({
      requestPermission: jest.fn().mockRejectedValue(new Error("boom")),
    });

    expect(await locateCurrentPlace(locator)).toEqual({
      ok: false,
      error: { code: "LOCATION_UNAVAILABLE" },
    });
  });

  it("falls back to the last known position when locating fails", async () => {
    const locator = fakeLocator({
      currentPosition: jest.fn().mockRejectedValue(new Error("timeout")),
    });

    const result = await locateCurrentPlace(locator);

    expect(result).toEqual({
      ok: true,
      value: {
        location: lastKnown,
        placeName: "渋谷駅",
        approximate: true,
        placeNameLookupFailed: false,
      },
    });
  });

  it.each([
    ["is missing", jest.fn().mockResolvedValue(null)],
    ["also fails", jest.fn().mockRejectedValue(new Error("off"))],
  ])(
    "is unavailable when the last known position %s",
    async (_, lastKnownPosition) => {
      const locator = fakeLocator({
        currentPosition: jest.fn().mockRejectedValue(new Error("timeout")),
        lastKnownPosition,
      });

      expect(await locateCurrentPlace(locator)).toEqual({
        ok: false,
        error: { code: "LOCATION_UNAVAILABLE" },
      });
    },
  );

  it("keeps the coordinates when the place name lookup fails", async () => {
    const locator = fakeLocator({
      placeNameAt: jest.fn().mockRejectedValue(new Error("offline")),
    });

    expect(await locateCurrentPlace(locator)).toEqual({
      ok: true,
      value: {
        location: shibuya,
        placeName: null,
        approximate: false,
        placeNameLookupFailed: true,
      },
    });
  });

  it("passes through a place name that was not found", async () => {
    const locator = fakeLocator({
      placeNameAt: jest.fn().mockResolvedValue(null),
    });

    const result = await locateCurrentPlace(locator);

    expect(result.ok && result.value.placeName).toBeNull();
    expect(result.ok && result.value.placeNameLookupFailed).toBe(false);
  });
});

describe("locateCurrentPosition", () => {
  it("returns the current position without looking up its place name", async () => {
    const locator = fakeLocator();

    expect(await locateCurrentPosition(locator)).toEqual({
      ok: true,
      value: { location: shibuya, approximate: false },
    });
    expect(locator.placeNameAt).not.toHaveBeenCalled();
  });

  it("falls back to the last known position when locating fails", async () => {
    const locator = fakeLocator({
      currentPosition: jest.fn().mockRejectedValue(new Error("timeout")),
    });

    expect(await locateCurrentPosition(locator)).toEqual({
      ok: true,
      value: { location: lastKnown, approximate: true },
    });
  });

  it("reports permission denied", async () => {
    const locator = fakeLocator({
      requestPermission: jest.fn().mockResolvedValue(false),
    });

    expect(await locateCurrentPosition(locator)).toEqual({
      ok: false,
      error: { code: "LOCATION_PERMISSION_DENIED" },
    });
  });
});

describe("describePosition", () => {
  it("looks up the place name of a point picked on the map", async () => {
    const locator = fakeLocator();

    expect(
      await describePosition(locator, {
        location: lastKnown,
        approximate: false,
      }),
    ).toEqual({
      location: lastKnown,
      placeName: "渋谷駅",
      approximate: false,
      placeNameLookupFailed: false,
    });
    expect(locator.placeNameAt).toHaveBeenCalledWith(lastKnown);
    expect(locator.requestPermission).not.toHaveBeenCalled();
  });

  it("keeps the point when the lookup fails", async () => {
    const locator = fakeLocator({
      placeNameAt: jest.fn().mockRejectedValue(new Error("offline")),
    });

    expect(
      await describePosition(locator, {
        location: lastKnown,
        approximate: false,
      }),
    ).toEqual({
      location: lastKnown,
      placeName: null,
      approximate: false,
      placeNameLookupFailed: true,
    });
  });
});

describe("lastKnownPositionIfAllowed", () => {
  it("returns the last known position when already allowed", async () => {
    const locator = fakeLocator();

    expect(await lastKnownPositionIfAllowed(locator)).toEqual(lastKnown);
    expect(locator.requestPermission).not.toHaveBeenCalled();
  });

  it("never asks for permission", async () => {
    const locator = fakeLocator({
      hasPermission: jest.fn().mockResolvedValue(false),
    });

    expect(await lastKnownPositionIfAllowed(locator)).toBeNull();
    expect(locator.requestPermission).not.toHaveBeenCalled();
    expect(locator.lastKnownPosition).not.toHaveBeenCalled();
  });

  it("returns null when the check fails", async () => {
    const locator = fakeLocator({
      hasPermission: jest.fn().mockRejectedValue(new Error("boom")),
    });

    expect(await lastKnownPositionIfAllowed(locator)).toBeNull();
  });
});
