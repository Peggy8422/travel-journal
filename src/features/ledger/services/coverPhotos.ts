import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import type { JournalBackup } from "../../../domain/journal";
import type {
  CoverPhotoStore,
  LedgerBackup,
  LedgerCover,
} from "../../../domain/ledger";

/*
 * 照片的流程：照片檔存在 CoverPhotoStore，帳本、手帳、日記只記檔名。
 * 換封面、刪帳本、刪手帳時不立刻刪檔，而是之後用 pruneCoverPhotos 清掉沒有人在用的照片，
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

/**
 * 所有還有人用的照片：帳本封面、手帳封面、日記的照片。
 * 已刪除的日記也算，否則按「復原」之後照片就不見了。
 */
async function usedPhotoNames(db: SqlExecutor): Promise<Set<string>> {
  const repos = createRepositories(db);
  const [ledgers, journals, entryPhotos] = await Promise.all([
    repos.ledgers.list(),
    repos.journals.list(),
    repos.journalEntries.listPhotoNames(),
  ]);
  return new Set([
    ...ledgers.flatMap((l) => (l.cover?.photo ? [l.cover.photo] : [])),
    ...journals.flatMap((j) => (j.cover.photo ? [j.cover.photo] : [])),
    ...entryPhotos,
  ]);
}

/** 刪掉沒有任何帳本、手帳、日記在用的照片，回傳刪掉的張數 */
export async function pruneCoverPhotos(
  db: SqlExecutor,
  store: CoverPhotoStore,
): Promise<number> {
  const used = await usedPhotoNames(db);
  let removed = 0;
  for (const name of await store.list()) {
    if (used.has(name)) continue;
    await store.delete(name);
    removed += 1;
  }
  return removed;
}

/** 備份要帶的照片檔名：帳本封面、手帳封面、日記的照片 */
export function backupPhotoNames(
  ledgers: readonly LedgerBackup[],
  journals: readonly JournalBackup[],
): string[] {
  return [
    ...ledgers.flatMap(({ ledger }) =>
      ledger.cover?.photo ? [ledger.cover.photo] : [],
    ),
    ...journals.flatMap(({ journal, entries }) => [
      ...(journal.cover.photo ? [journal.cover.photo] : []),
      ...entries.flatMap((e) => e.photos),
    ]),
  ];
}

/** 備份要帶的照片：檔名 → base64；檔案不見的照片就不帶 */
export async function collectCoverPhotos(
  store: CoverPhotoStore,
  names: readonly string[],
): Promise<Record<string, string>> {
  const photos: Record<string, string> = {};
  for (const name of names) {
    if (name in photos) continue;
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

/**
 * 還原前整理手帳的照片：備份裡有的先寫回手機；封面照片缺檔就不貼照片，
 * 日記缺檔的照片直接拿掉，免得指到不存在的檔案。
 */
export async function prepareJournalPhotos(
  store: CoverPhotoStore,
  backups: readonly JournalBackup[],
  photos: Readonly<Record<string, string>>,
): Promise<JournalBackup[]> {
  const written = new Set<string>();
  const available = async (name: string): Promise<boolean> => {
    const data = photos[name];
    if (data === undefined) return false;
    if (!written.has(name)) {
      await store.writeBase64(name, data);
      written.add(name);
    }
    return true;
  };
  const prepared: JournalBackup[] = [];
  for (const { journal, entries } of backups) {
    const photo =
      journal.cover.photo && (await available(journal.cover.photo))
        ? journal.cover.photo
        : null;
    const kept = [];
    for (const entry of entries) {
      const entryPhotos = [];
      for (const name of entry.photos) {
        if (await available(name)) entryPhotos.push(name);
      }
      kept.push({ ...entry, photos: entryPhotos });
    }
    prepared.push({
      journal: { ...journal, cover: { ...journal.cover, photo } },
      entries: kept,
    });
  }
  return prepared;
}
