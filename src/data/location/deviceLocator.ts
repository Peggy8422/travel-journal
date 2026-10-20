import * as Location from "expo-location";

import type { GeoPoint } from "../../domain/ledger";
import type { DeviceLocator } from "../../domain/location";
import { formatPlaceName } from "./placeName";

/** 室內或訊號差時定位可能很久，逾時後改用最近一次已知位置 */
export const CURRENT_POSITION_TIMEOUT_MS = 10_000;

/** 最近一次已知位置最多可以是幾分鐘前的 */
export const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

/** 以 expo-location 實作 DeviceLocator */
export function createDeviceLocator(): DeviceLocator {
  return {
    async requestPermission() {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      return granted;
    },
    async currentPosition() {
      const location = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        CURRENT_POSITION_TIMEOUT_MS,
      );
      return toGeoPoint(location.coords);
    },
    async lastKnownPosition() {
      const location = await Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_MAX_AGE_MS,
      });
      return location ? toGeoPoint(location.coords) : null;
    },
    async placeNameAt(point) {
      return formatPlaceName(await Location.reverseGeocodeAsync(point));
    },
  };
}

function toGeoPoint(coords: { latitude: number; longitude: number }): GeoPoint {
  return { latitude: coords.latitude, longitude: coords.longitude };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
