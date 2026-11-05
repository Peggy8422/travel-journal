import {
  placeSearchModule,
  type NativePlace,
} from "../../../modules/place-search";
import type { FoundPlace, PlaceSearch } from "../../domain/location";

/**
 * 以 Apple 地圖（MKLocalSearch，本機模組 modules/place-search）實作 PlaceSearch。
 * 只有 iOS 有，Android、web 和測試裡回傳 null，畫面就不顯示搜尋框。
 */
export function createPlaceSearch(): PlaceSearch | null {
  const native = placeSearchModule;
  if (!native) return null;
  return {
    async search(query, near) {
      return toFoundPlaces(await native.searchAsync(query, near));
    },
  };
}

// Japanese postal code that older iOS puts in front of the address
const POSTAL_CODE = /^〒?\s*\d{3}-\d{4}\s*,?\s*/;

/** 整理 Apple 地圖的結果：地址改成一行，沒有名稱用地址，重複的只留一個 */
export function toFoundPlaces(places: readonly NativePlace[]): FoundPlace[] {
  const found: FoundPlace[] = [];
  const seen = new Set<string>();
  for (const place of places) {
    if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude))
      continue;
    const address = oneLine(place.address)?.replace(POSTAL_CODE, "") || null;
    const name = oneLine(place.name) ?? address;
    if (!name) continue;
    const key = `${name}@${place.latitude},${place.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({
      name,
      address: address === name ? null : address,
      location: { latitude: place.latitude, longitude: place.longitude },
    });
  }
  return found;
}

function oneLine(text: string | null): string | null {
  const line = text?.replace(/\s+/g, " ").trim();
  return line ? line : null;
}
