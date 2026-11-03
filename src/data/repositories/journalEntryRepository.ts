import {
  isJournalMood,
  isJournalWeather,
  type JournalEntryRecord,
  type JournalEntryRepository,
  type JournalPlace,
} from "../../domain/journal";
import type { SqlExecutor } from "../db/sqlDatabase";

interface EntryRow {
  id: string;
  journal_id: string;
  entry_date: string;
  title: string;
  body: string;
  weather: string | null;
  mood: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface PhotoRow {
  entry_id: string;
  photo: string;
}

interface PlaceRow {
  entry_id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * 日記本身一張表，照片與地點各一張子表（依 sort_order 排列）。
 * 寫入時照片、地點整批重寫，所以 insert／update 要在 transaction 裡呼叫才不會留下一半。
 */
export function createJournalEntryRepository(
  db: SqlExecutor,
): JournalEntryRepository {
  async function writeChildren(entry: JournalEntryRecord): Promise<void> {
    await db.runAsync("DELETE FROM journal_entry_photos WHERE entry_id = ?", [
      entry.id,
    ]);
    await db.runAsync("DELETE FROM journal_entry_places WHERE entry_id = ?", [
      entry.id,
    ]);
    for (const [index, photo] of entry.photos.entries()) {
      await db.runAsync(
        "INSERT INTO journal_entry_photos (entry_id, sort_order, photo) VALUES (?, ?, ?)",
        [entry.id, index, photo],
      );
    }
    for (const [index, place] of entry.places.entries()) {
      await db.runAsync(
        `INSERT INTO journal_entry_places (entry_id, sort_order, name, latitude, longitude)
         VALUES (?, ?, ?, ?, ?)`,
        [
          entry.id,
          index,
          place.name,
          place.location.latitude,
          place.location.longitude,
        ],
      );
    }
  }

  /** 一次讀出這些日記的照片與地點，避免每篇各查一次 */
  async function withChildren(rows: EntryRow[]): Promise<JournalEntryRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const marks = ids.map(() => "?").join(", ");
    const [photoRows, placeRows] = await Promise.all([
      db.getAllAsync<PhotoRow>(
        `SELECT entry_id, photo FROM journal_entry_photos
         WHERE entry_id IN (${marks}) ORDER BY entry_id, sort_order`,
        ids,
      ),
      db.getAllAsync<PlaceRow>(
        `SELECT entry_id, name, latitude, longitude FROM journal_entry_places
         WHERE entry_id IN (${marks}) ORDER BY entry_id, sort_order`,
        ids,
      ),
    ]);
    const photos = new Map<string, string[]>();
    for (const row of photoRows) {
      photos.set(row.entry_id, [
        ...(photos.get(row.entry_id) ?? []),
        row.photo,
      ]);
    }
    const places = new Map<string, JournalPlace[]>();
    for (const row of placeRows) {
      places.set(row.entry_id, [
        ...(places.get(row.entry_id) ?? []),
        {
          name: row.name,
          location: { latitude: row.latitude, longitude: row.longitude },
        },
      ]);
    }
    return rows.map((row) => ({
      id: row.id,
      journalId: row.journal_id,
      date: row.entry_date,
      title: row.title,
      body: row.body,
      weather: isJournalWeather(row.weather) ? row.weather : null,
      mood: isJournalMood(row.mood) ? row.mood : null,
      photos: photos.get(row.id) ?? [],
      places: places.get(row.id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));
  }

  return {
    async insert(entry) {
      await db.runAsync(
        `INSERT INTO journal_entries (id, journal_id, entry_date, title, body,
           weather, mood, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entry.journalId,
          entry.date,
          entry.title,
          entry.body,
          entry.weather,
          entry.mood,
          entry.createdAt,
          entry.updatedAt,
          entry.deletedAt,
        ],
      );
      await writeChildren(entry);
    },

    async update(entry) {
      await db.runAsync(
        `UPDATE journal_entries SET entry_date = ?, title = ?, body = ?,
           weather = ?, mood = ?, updated_at = ?
         WHERE id = ?`,
        [
          entry.date,
          entry.title,
          entry.body,
          entry.weather,
          entry.mood,
          entry.updatedAt,
          entry.id,
        ],
      );
      await writeChildren(entry);
    },

    async softDelete(id, deletedAt) {
      await db.runAsync(
        "UPDATE journal_entries SET deleted_at = ?, updated_at = ? WHERE id = ?",
        [deletedAt, deletedAt, id],
      );
    },

    async restore(id, updatedAt) {
      await db.runAsync(
        "UPDATE journal_entries SET deleted_at = NULL, updated_at = ? WHERE id = ?",
        [updatedAt, id],
      );
    },

    async findById(id) {
      const rows = await db.getAllAsync<EntryRow>(
        "SELECT * FROM journal_entries WHERE id = ?",
        [id],
      );
      return (await withChildren(rows))[0];
    },

    async listByJournal(journalId, options = {}) {
      const rows = await db.getAllAsync<EntryRow>(
        `SELECT * FROM journal_entries
         WHERE journal_id = ? ${options.includeDeleted ? "" : "AND deleted_at IS NULL"}
         ORDER BY entry_date, created_at, id`,
        [journalId],
      );
      return withChildren(rows);
    },

    async listPhotoNames() {
      const rows = await db.getAllAsync<{ photo: string }>(
        "SELECT DISTINCT photo FROM journal_entry_photos",
      );
      return rows.map((r) => r.photo);
    },
  };
}
