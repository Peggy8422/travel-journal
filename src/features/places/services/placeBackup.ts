import type { SqlDatabase, SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import {
  ACTIVE_CRITERIA_LIMIT,
  type RatingCriterionRecord,
  type SavedPlaceRecord,
} from "../../../domain/places";

/** 所有收藏地點（含已刪除的，才能復原）與評分項目（含封存的） */
export async function collectPlaces(db: SqlExecutor): Promise<{
  places: SavedPlaceRecord[];
  ratingCriteria: RatingCriterionRecord[];
}> {
  const repos = createRepositories(db);
  const [places, ratingCriteria] = await Promise.all([
    repos.savedPlaces.list({ includeDeleted: true }),
    repos.ratingCriteria.list(),
  ]);
  return { places, ratingCriteria };
}

export interface PlaceRestoreReport {
  readonly restored: number;
  /** 手機上已經有同一個地點（同一個 id），沒有動它 */
  readonly skipped: number;
}

/**
 * 還原評分項目與收藏地點，已經存在的（同一個 id）略過，全部在一個 transaction 裡。
 * 預設的三個評分項目每支手機的 id 都一樣，所以不會多出重複的「好吃」；
 * 手機上沒有的項目接在最後面，使用中的超過上限時多的改成封存。
 * 分數指向的評分項目手機上沒有時，那個分數不還原。
 */
export async function restorePlaces(
  db: SqlDatabase,
  places: readonly SavedPlaceRecord[],
  ratingCriteria: readonly RatingCriterionRecord[],
): Promise<PlaceRestoreReport> {
  let restored = 0;
  let skipped = 0;
  await db.transaction(async (tx) => {
    const repos = createRepositories(tx);
    const existing = await repos.ratingCriteria.list();
    const known = new Set(existing.map((c) => c.id));
    let active = existing.filter((c) => c.archivedAt === null).length;
    let order = Math.max(-1, ...existing.map((c) => c.sortOrder)) + 1;
    const incoming = [...ratingCriteria].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (const criterion of incoming) {
      if (known.has(criterion.id)) continue;
      const archive =
        criterion.archivedAt === null && active >= ACTIVE_CRITERIA_LIMIT;
      await repos.ratingCriteria.insert({
        ...criterion,
        sortOrder: order,
        archivedAt: archive ? criterion.updatedAt : criterion.archivedAt,
      });
      if (criterion.archivedAt === null && !archive) active += 1;
      order += 1;
      known.add(criterion.id);
    }

    for (const place of places) {
      if (await repos.savedPlaces.findById(place.id)) {
        skipped += 1;
        continue;
      }
      await repos.savedPlaces.insert({
        ...place,
        ratings: place.ratings.filter((r) => known.has(r.criterionId)),
      });
      restored += 1;
    }
  });
  return { restored, skipped };
}
