import { isCoverPhotoName } from "../ledger";

/**
 * 手帳封面：牛皮紙筆記本固定不變，使用者挑紙膠帶顏色，可以再貼一張照片。
 * 紙膠帶代碼只能新增，不要改名或刪除；實際顏色在畫面層對照。
 */
export const JOURNAL_TAPES = [
  "sakura",
  "yamabuki",
  "matcha",
  "ai",
  "fuji",
] as const;

export type JournalTape = (typeof JOURNAL_TAPES)[number];

export interface JournalCover {
  readonly tape: JournalTape;
  /** 貼在封面上的照片檔名（和帳本照片封面放在同一個資料夾），null 代表沒有照片 */
  readonly photo: string | null;
}

export function isJournalTape(value: unknown): value is JournalTape {
  return (JOURNAL_TAPES as readonly unknown[]).includes(value);
}

/**
 * 從資料庫或備份讀回封面。認不得的紙膠帶（較新版本的 App 才有的）改用第一個顏色，
 * 檔名格式不對的照片當作沒有：封面只影響外觀，不值得因此讀不出整本手帳
 */
export function parseJournalCover(tape: unknown, photo: unknown): JournalCover {
  return {
    tape: isJournalTape(tape) ? tape : JOURNAL_TAPES[0],
    photo: isCoverPhotoName(photo) ? photo : null,
  };
}
