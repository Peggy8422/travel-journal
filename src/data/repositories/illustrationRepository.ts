import {
  parseStrokes,
  type IllustrationRecord,
  type IllustrationRepository,
} from "../../domain/journal";
import type { SqlExecutor } from "../db/sqlDatabase";
import { StoredDataError } from "./shared";

interface IllustrationRow {
  id: string;
  strokes: string;
  created_at: string;
  updated_at: string;
}

/** 筆畫整份存成一個 JSON 欄位（點是 [x, y] 整數），一次讀寫整張插圖 */
export function createIllustrationRepository(
  db: SqlExecutor,
): IllustrationRepository {
  return {
    async insert(illustration) {
      await db.runAsync(
        `INSERT INTO illustrations (id, strokes, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
        [
          illustration.id,
          JSON.stringify(illustration.strokes),
          illustration.createdAt,
          illustration.updatedAt,
        ],
      );
    },

    async update(illustration) {
      await db.runAsync(
        "UPDATE illustrations SET strokes = ?, updated_at = ? WHERE id = ?",
        [
          JSON.stringify(illustration.strokes),
          illustration.updatedAt,
          illustration.id,
        ],
      );
    },

    async findById(id) {
      const row = await db.getFirstAsync<IllustrationRow>(
        "SELECT * FROM illustrations WHERE id = ?",
        [id],
      );
      return row && toRecord(row);
    },

    async list() {
      const rows = await db.getAllAsync<IllustrationRow>(
        "SELECT * FROM illustrations ORDER BY created_at DESC, id",
      );
      return rows.map(toRecord);
    },

    async delete(id) {
      await db.runAsync("DELETE FROM illustrations WHERE id = ?", [id]);
    },
  };
}

function toRecord(row: IllustrationRow): IllustrationRecord {
  let value: unknown;
  try {
    value = JSON.parse(row.strokes);
  } catch {
    throw new StoredDataError("illustrations", row.id, "strokes is not JSON");
  }
  const strokes = parseStrokes(value);
  if (!strokes.ok) {
    throw new StoredDataError("illustrations", row.id, strokes.error);
  }
  return {
    id: row.id,
    strokes: strokes.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
