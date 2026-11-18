import type { ExpenseCategory, GeoPoint } from "../ledger";
import type { PlaceKind, SavedPlaceRecord } from "./records";

/**
 * Two points this close count as the same place. Phone GPS indoors is often
 * off by a few dozen metres, and an expense is usually recorded at the table
 * while the saved place sits on the shop's map pin.
 */
export const NEARBY_METERS = 60;

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance in metres (haversine) */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isNearby(a: GeoPoint, b: GeoPoint): boolean {
  return distanceMeters(a, b) <= NEARBY_METERS;
}

/** The closest saved place within NEARBY_METERS of the point, or null */
export function savedPlaceNear<T extends Pick<SavedPlaceRecord, "location">>(
  point: GeoPoint,
  places: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDistance = NEARBY_METERS;
  for (const place of places) {
    const distance = distanceMeters(point, place.location);
    if (distance <= bestDistance) {
      best = place;
      bestDistance = distance;
    }
  }
  return best;
}

const KIND_BY_CATEGORY: Partial<Record<ExpenseCategory, PlaceKind>> = {
  food: "restaurant",
  lodging: "stay",
  shopping: "shopping",
  entertainment: "sight",
};

/** A starting place kind for saving an expense's location; the user can change it */
export function placeKindOf(category: string | null): PlaceKind {
  return KIND_BY_CATEGORY[category as ExpenseCategory] ?? "other";
}
