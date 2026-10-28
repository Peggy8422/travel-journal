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
  return ok(await describePosition(locator, position.value));
}

/**
 * 替座標反查預設地名，給在地圖上選的地點用（也是 locateCurrentPlace 的後半段）。
 * 查不到或查詢失敗時地名為 null，座標仍可使用。不會 throw。
 */
export async function describePosition(
  locator: DeviceLocator,
  position: LocatedPosition,
): Promise<LocatedPlace> {
  try {
    const placeName = await locator.placeNameAt(position.location);
    return { ...position, placeName, placeNameLookupFailed: false };
  } catch {
    return { ...position, placeName: null, placeNameLookupFailed: true };
  }
}

/**
 * 在地圖上選地點時一開始要看哪裡：已經有定位權限就用最近一次已知位置，
 * 沒有權限時不詢問、直接回傳 null（由畫面改用預設範圍）。不會 throw。
 */
export async function lastKnownPositionIfAllowed(
  locator: DeviceLocator,
): Promise<GeoPoint | null> {
  try {
    if (!(await locator.hasPermission())) return null;
    return await locator.lastKnownPosition();
  } catch {
    return null;
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
