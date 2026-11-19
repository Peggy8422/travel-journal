import type {
  JournalEntryRecord,
  JournalRecord,
} from "../../../domain/journal";
import { entryHeading } from "./journalDates";

/*
 * 把一篇日記做成 IG 輪播貼文的頁面：封面一頁，每張照片各一頁。
 * 只決定有哪些頁、貼文文字怎麼寫；卡片長相在 ShareCards。
 */

export type SharePage =
  | { readonly kind: "cover"; readonly key: string }
  | {
      readonly kind: "photo";
      readonly key: string;
      /** 照片檔名 */
      readonly photo: string;
      /** 第幾張照片（從 0 開始） */
      readonly index: number;
    };

/** 依貼文順序排好的頁面 */
export function entrySharePages(
  entry: Pick<JournalEntryRecord, "photos">,
): readonly SharePage[] {
  return [
    { kind: "cover", key: "cover" },
    ...entry.photos.map((photo, index): SharePage => ({
      kind: "photo",
      // The same photo can be added twice, so the index keeps keys unique
      key: `photo:${index}`,
      photo,
      index,
    })),
  ];
}

/** 頁面下面勾選鈕上的名稱 */
export function sharePageLabel(page: SharePage): string {
  return page.kind === "cover" ? "封面" : `照片 ${page.index + 1}`;
}

/** 這一頁要等哪張照片載入完才能存成圖片；不用照片時為 null */
export function sharePagePhoto(
  page: SharePage,
  entry: Pick<JournalEntryRecord, "photos">,
): string | null {
  return page.kind === "photo" ? page.photo : (entry.photos[0] ?? null);
}

/** 「2025.11.22」 */
export function dottedDate(date: string): string {
  return date.replace(/-/g, ".");
}

/** 照片頁下緣的手寫字，例如「Day 2 · 11.22」 */
export function photoCaption(dayNumber: number, date: string): string {
  return `Day ${dayNumber} · ${date.slice(5).replace("-", ".")}`;
}

/**
 * 貼在 IG 說明欄的文字：手帳名稱與 Day N、標題、日期與去過的地方。
 * IG 不會帶入分享時的文字，所以讓使用者複製後自己貼上。
 */
export function shareCaption({
  journal,
  entry,
  dayNumber,
}: {
  readonly journal: Pick<JournalRecord, "name">;
  readonly entry: Pick<JournalEntryRecord, "title" | "date" | "places">;
  readonly dayNumber: number;
}): string {
  const places = entry.places.map((place) => place.name).join("、");
  return [
    `${journal.name} Day ${dayNumber}`,
    entryHeading(entry),
    places ? `${dottedDate(entry.date)}・${places}` : dottedDate(entry.date),
  ].join("\n");
}
