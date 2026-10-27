import { err, ok, type Result } from "../../../domain/common/result";
import type { GeoPoint } from "../../../domain/ledger";
import type { DeviceLocator } from "../../../domain/location";

export type LocateError =
  | { readonly code: "LOCATION_PERMISSION_DENIED" }
  | { readonly code: "LOCATION_UNAVAILABLE" };

export interface LocatedPosition {
  readonly location: GeoPoint;
  /** 定位失敗，改用最近一次已知位置 */
  readonly approximate: boolean;
}

export interface LocatedPlace extends LocatedPosition {
  /** 反查到的預設地名；查不到或查詢失敗時為 null */
  readonly placeName: string | null;
  /** 反查地名失敗（通常是離線），座標仍可使用 */
  readonly placeNameLookupFailed: boolean;
}

/**
 * 取得目前位置與預設地名，給新增、編輯消費時記錄地點用。
 * 只有拿不到任何座標時回傳錯誤；地名查不到不影響座標，讓使用者自己輸入。
 * 不會 throw。
 */
export async function locateCurrentPlace(
  locator: DeviceLocator,
): Promise<Result<LocatedPlace, LocateError>> {
  const position = await locateCurrentPosition(locator);
  if (!position.ok) return position;
  const { location } = position.value;

  try {
    const placeName = await locator.placeNameAt(location);
    return ok({ ...position.value, placeName, placeNameLookupFailed: false });
  } catch {
    return ok({
      ...position.value,
      placeName: null,
      placeNameLookupFailed: true,
    });
  }
}

/**
 * 要求權限並取得目前位置，定位失敗時改用最近一次已知位置；不反查地名。
 * 不會 throw。
 */
export async function locateCurrentPosition(
  locator: DeviceLocator,
): Promise<Result<LocatedPosition, LocateError>> {
  let granted: boolean;
  try {
    granted = await locator.requestPermission();
  } catch {
    return err({ code: "LOCATION_UNAVAILABLE" });
  }
  if (!granted) return err({ code: "LOCATION_PERMISSION_DENIED" });

  let location: GeoPoint | null;
  let approximate = false;
  try {
    location = await locator.currentPosition();
  } catch {
    approximate = true;
    location = await locator.lastKnownPosition().catch(() => null);
  }
  if (!location) return err({ code: "LOCATION_UNAVAILABLE" });
  return ok({ location, approximate });
}
