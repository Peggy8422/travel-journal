import type {
  RatingCriterionRecord,
  RatingCriterionRepository,
} from "../../domain/places";
import type { SqlExecutor } from "../db/sqlDatabase";

interface CriterionRow {
  id: string;
  label: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

function toRecord(row: CriterionRow): RatingCriterionRecord {
  return {
    id: row.id,
    label: row.label,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** 評分項目沒有刪除，只有封存（archivedAt） */
export function createRatingCriterionRepository(
  db: SqlExecutor,
): RatingCriterionRepository {
  return {
    async insert(criterion) {
      await db.runAsync(
        `INSERT INTO rating_criteria (id, label, sort_order, archived_at,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          criterion.id,
          criterion.label,
          criterion.sortOrder,
          criterion.archivedAt,
          criterion.createdAt,
          criterion.updatedAt,
        ],
      );
    },

    async update(criterion) {
      await db.runAsync(
        `UPDATE rating_criteria SET label = ?, sort_order = ?, archived_at = ?,
           updated_at = ?
         WHERE id = ?`,
        [
          criterion.label,
          criterion.sortOrder,
          criterion.archivedAt,
          criterion.updatedAt,
          criterion.id,
        ],
      );
    },

    async findById(id) {
      const row = await db.getFirstAsync<CriterionRow>(
        "SELECT * FROM rating_criteria WHERE id = ?",
        [id],
      );
      return row ? toRecord(row) : undefined;
    },

    async list() {
      const rows = await db.getAllAsync<CriterionRow>(
        "SELECT * FROM rating_criteria ORDER BY sort_order, created_at, id",
      );
      return rows.map(toRecord);
    },
  };
}
