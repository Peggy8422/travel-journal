import {
  isPlaceKind,
  isPlaceStatus,
  parseRating,
  type PlaceRating,
  type SavedPlaceRecord,
  type SavedPlaceRepository,
} from "../../domain/places";
import type { SqlExecutor } from "../db/sqlDatabase";

interface PlaceRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  city: string;
  kind: string;
  status: string;
  note: string;
  revisit: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface PhotoRow {
  place_id: string;
  photo: string;
}

interface RatingRow {
  place_id: string;
  criterion_id: string;
  score: number;
}

/**
 * 地點本身一張表，照片、分數各一張子表。
 * 寫入時照片、分數整批重寫，所以 insert／update 要在 transaction 裡呼叫才不會留下一半。
 */
export function createSavedPlaceRepository(
  db: SqlExecutor,
): SavedPlaceRepository {
  async function writeChildren(place: SavedPlaceRecord): Promise<void> {
    await db.runAsync("DELETE FROM saved_place_photos WHERE place_id = ?", [
      place.id,
    ]);
    await db.runAsync("DELETE FROM saved_place_ratings WHERE place_id = ?", [
      place.id,
    ]);
    for (const [index, photo] of place.photos.entries()) {
      await db.runAsync(
        "INSERT INTO saved_place_photos (place_id, sort_order, photo) VALUES (?, ?, ?)",
        [place.id, index, photo],
      );
    }
    for (const rating of place.ratings) {
      await db.runAsync(
        "INSERT INTO saved_place_ratings (place_id, criterion_id, score) VALUES (?, ?, ?)",
        [place.id, rating.criterionId, rating.score],
      );
    }
  }

  /** 一次讀出這些地點的照片與分數，避免每個各查一次 */
  async function withChildren(rows: PlaceRow[]): Promise<SavedPlaceRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const marks = ids.map(() => "?").join(", ");
    const [photoRows, ratingRows] = await Promise.all([
      db.getAllAsync<PhotoRow>(
        `SELECT place_id, photo FROM saved_place_photos
         WHERE place_id IN (${marks}) ORDER BY place_id, sort_order`,
        ids,
      ),
      // In the criteria's own order, so the form and the detail agree
      db.getAllAsync<RatingRow>(
        `SELECT r.place_id, r.criterion_id, r.score
         FROM saved_place_ratings r JOIN rating_criteria c ON c.id = r.criterion_id
         WHERE r.place_id IN (${marks}) ORDER BY r.place_id, c.sort_order, c.id`,
        ids,
      ),
    ]);
    const photos = new Map<string, string[]>();
    for (const row of photoRows) {
      photos.set(row.place_id, [
        ...(photos.get(row.place_id) ?? []),
        row.photo,
      ]);
    }
    const ratings = new Map<string, PlaceRating[]>();
    for (const row of ratingRows) {
      const rating = parseRating({
        criterionId: row.criterion_id,
        score: row.score,
      });
      if (!rating.ok) continue;
      ratings.set(row.place_id, [
        ...(ratings.get(row.place_id) ?? []),
        rating.value,
      ]);
    }
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      location: { latitude: row.latitude, longitude: row.longitude },
      city: row.city,
      kind: isPlaceKind(row.kind) ? row.kind : "other",
      status: isPlaceStatus(row.status) ? row.status : "want",
      note: row.note,
      ratings: ratings.get(row.id) ?? [],
      revisit: row.revisit === 1,
      photos: photos.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));
  }

  return {
    async insert(place) {
      await db.runAsync(
        `INSERT INTO saved_places (id, name, latitude, longitude, city, kind,
           status, note, revisit, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          place.id,
          place.name,
          place.location.latitude,
          place.location.longitude,
          place.city,
          place.kind,
          place.status,
          place.note,
          place.revisit ? 1 : 0,
          place.createdAt,
          place.updatedAt,
          place.deletedAt,
        ],
      );
      await writeChildren(place);
    },

    async update(place) {
      await db.runAsync(
        `UPDATE saved_places SET name = ?, latitude = ?, longitude = ?, city = ?,
           kind = ?, status = ?, note = ?, revisit = ?, updated_at = ?
         WHERE id = ?`,
        [
          place.name,
          place.location.latitude,
          place.location.longitude,
          place.city,
          place.kind,
          place.status,
          place.note,
          place.revisit ? 1 : 0,
          place.updatedAt,
          place.id,
        ],
      );
      await writeChildren(place);
    },

    async softDelete(id, deletedAt) {
      await db.runAsync(
        "UPDATE saved_places SET deleted_at = ?, updated_at = ? WHERE id = ?",
        [deletedAt, deletedAt, id],
      );
    },

    async restore(id, updatedAt) {
      await db.runAsync(
        "UPDATE saved_places SET deleted_at = NULL, updated_at = ? WHERE id = ?",
        [updatedAt, id],
      );
    },

    async findById(id) {
      const rows = await db.getAllAsync<PlaceRow>(
        "SELECT * FROM saved_places WHERE id = ?",
        [id],
      );
      return (await withChildren(rows))[0];
    },

    async list(options = {}) {
      const rows = await db.getAllAsync<PlaceRow>(
        `SELECT * FROM saved_places
         ${options.includeDeleted ? "" : "WHERE deleted_at IS NULL"}
         ORDER BY created_at DESC, id`,
      );
      return withChildren(rows);
    },

    async listPhotoNames() {
      const rows = await db.getAllAsync<{ photo: string }>(
        "SELECT DISTINCT photo FROM saved_place_photos",
      );
      return rows.map((r) => r.photo);
    },
  };
}
