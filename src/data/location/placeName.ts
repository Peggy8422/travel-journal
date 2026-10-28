/** 只描述用得到的欄位，對應 expo-location 的 LocationGeocodedAddress */
export interface GeocodedAddress {
  readonly name: string | null;
  readonly streetNumber: string | null;
  readonly street: string | null;
  readonly district: string | null;
  readonly city: string | null;
  readonly subregion: string | null;
  readonly region: string | null;
  readonly country: string | null;
}

// Android sometimes returns only the house number as the name
const HOUSE_NUMBER_ONLY = /^[\d\s-]+$/;

/**
 * 反查地址轉成預設地名，使用者之後可以再修改。
 * 優先用地點名稱（店名、地標），沒有時改用「城市 區 街道」，都沒有就用國家。
 */
export function formatPlaceName(
  addresses: readonly GeocodedAddress[],
): string | null {
  const address = addresses[0];
  if (!address) return null;

  const name = clean(address.name);
  if (
    name &&
    !HOUSE_NUMBER_ONLY.test(name) &&
    name !== clean(address.streetNumber)
  ) {
    return name;
  }

  const parts = [
    clean(address.city) ?? clean(address.subregion) ?? clean(address.region),
    clean(address.district),
    clean(address.street),
  ].filter((part): part is string => part !== null);
  const unique = [...new Set(parts)];
  if (unique.length > 0) return unique.join(" ");

  return clean(address.country);
}

function clean(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
