import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import type {
  CoverPhotoStore,
  LedgerBackup,
  LedgerCover,
} from "../../../domain/ledger";

/*
 * 照片封面的流程：照片檔存在 CoverPhotoStore，帳本只記檔名。
 * 換封面、刪帳本時不立刻刪檔，而是之後用 pruneCoverPhotos 清掉沒有帳本在用的照片，
 * 這樣建立帳本途中取消、還原失敗等情況留下的檔案也會一起清掉。
 */

/** 把挑好的照片（壓縮後的暫存檔）存起來，回傳要記在封面上的檔名 */
export async function saveCoverPhoto(
  store: CoverPhotoStore,
  newId: () => string,
  sourceUri: string,
): Promise<string> {
  const name = `${newId()}.jpg`;
  await store.saveFrom(name, sourceUri);
  return name;
}

/** 刪掉沒有任何帳本在用的封面照片，回傳刪掉的張數 */
export async function pruneCoverPhotos(
  db: SqlExecutor,
  store: CoverPhotoStore,
): Promise<number> {
  const used = new Set(
    (await createRepositories(db).ledgers.list())
      .map((ledger) => ledger.cover?.photo)
      .filter((photo): photo is string => photo !== undefined),
  );
  let removed = 0;
  for (const name of await store.list()) {
    if (used.has(name)) continue;
    await store.delete(name);
    removed += 1;
  }
  return removed;
}

/** 備份要帶的照片：檔名 → base64；檔案不見的照片就不帶 */
export async function collectCoverPhotos(
  store: CoverPhotoStore,
  backups: readonly LedgerBackup[],
): Promise<Record<string, string>> {
  const photos: Record<string, string> = {};
  for (const { ledger } of backups) {
    const name = ledger.cover?.photo;
    if (name === undefined || name in photos) continue;
    const data = await store.readBase64(name);
    if (data !== null) photos[name] = data;
  }
  return photos;
}

/**
 * 還原前整理照片封面：備份裡有照片的先寫回手機，沒有的（舊版備份、匯出時檔案已不見）
 * 改成同配色的書衣封面，免得帳本指到不存在的照片。
 */
export async function prepareCoverPhotos(
  store: CoverPhotoStore,
  backups: readonly LedgerBackup[],
  photos: Readonly<Record<string, string>>,
): Promise<LedgerBackup[]> {
  const prepared: LedgerBackup[] = [];
  for (const backup of backups) {
    const cover = backup.ledger.cover;
    if (cover?.photo === undefined) {
      prepared.push(backup);
      continue;
    }
    const data = photos[cover.photo];
    if (data !== undefined) {
      await store.writeBase64(cover.photo, data);
      prepared.push(backup);
      continue;
    }
    const fallback: LedgerCover = {
      style: "band",
      palette: cover.palette,
      pattern: cover.pattern,
    };
    prepared.push({ ...backup, ledger: { ...backup.ledger, cover: fallback } });
  }
  return prepared;
}
