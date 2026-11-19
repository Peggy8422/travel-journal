import type {
  JournalEntryRecord,
  JournalRecord,
} from "../../../domain/journal";
import type { GeoPoint } from "../../../domain/ledger";
import { entryHeading } from "./journalDates";

/*
 * 把一篇日記做成 IG 的圖片：輪播貼文是封面、每張照片各一頁、內文、去過的地方；
 * 限時動態是一張拼貼。只決定有哪些頁、貼文文字怎麼寫；卡片長相在 ShareCards。
 */

/** 貼文 4:5（輪播）或限時動態 9:16 */
export type ShareFormat = "post" | "story";

export type SharePage =
  | { readonly kind: "cover"; readonly key: string }
  | {
      readonly kind: "photo";
      readonly key: string;
      /** 照片檔名 */
      readonly photo: string;
      /** 第幾張照片（從 0 開始） */
      readonly index: number;
    }
  | { readonly kind: "text"; readonly key: string }
  | { readonly kind: "places"; readonly key: string }
  | { readonly kind: "story"; readonly key: string };

/** 限動拼貼最多放幾張照片 */
export const STORY_PHOTO_LIMIT = 3;

/**
 * 依順序排好的頁面。貼文：封面、照片、內文（有寫才有）、去過的地方（有地點才有）；
 * 限動只有一張拼貼。
 */
export function entrySharePages(
  entry: Pick<JournalEntryRecord, "photos" | "body" | "places">,
  format: ShareFormat = "post",
): readonly SharePage[] {
  if (format === "story") return [{ kind: "story", key: "story" }];
  return [
    { kind: "cover", key: "cover" },
    ...entry.photos.map((photo, index): SharePage => ({
      kind: "photo",
      // The same photo can be added twice, so the index keeps keys unique
      key: `photo:${index}`,
      photo,
      index,
    })),
    ...(entry.body.trim() !== ""
      ? [{ kind: "text", key: "text" } as const]
      : []),
    ...(entry.places.length > 0
      ? [{ kind: "places", key: "places" } as const]
      : []),
  ];
}

const PAGE_LABELS = {
  cover: "封面",
  text: "文字",
  places: "地點",
  story: "限動",
} as const;

/** 頁面下面勾選鈕上的名稱 */
export function sharePageLabel(page: SharePage): string {
  return page.kind === "photo"
    ? `照片 ${page.index + 1}`
    : PAGE_LABELS[page.kind];
}

/** 這一頁上有哪些照片，要等它們都載入完才能存成圖片 */
export function sharePagePhotos(
  page: SharePage,
  entry: Pick<JournalEntryRecord, "photos">,
): readonly string[] {
  switch (page.kind) {
    case "cover":
      return entry.photos.slice(0, 1);
    case "photo":
      return [page.photo];
    case "story":
      return entry.photos.slice(0, STORY_PHOTO_LIMIT);
    default:
      return [];
  }
}

/** 文字頁角落放幾張插圖 */
export const TEXT_PAGE_STICKERS = 2;

/**
 * 文字頁角落放的插圖：日記上貼的插圖裡最上面（最後貼）的幾張，同一張插圖只放一次，
 * 已經刪掉的插圖跳過。位置不照日記頁，因為文字頁的版面不一樣。
 */
export function shareStickerIds(
  stickers: readonly { readonly illustrationId: string }[],
  available: Readonly<Record<string, unknown>>,
): readonly string[] {
  const ids: string[] = [];
  for (let i = stickers.length - 1; i >= 0; i--) {
    const id = stickers[i]!.illustrationId;
    if (id in available && !ids.includes(id)) ids.push(id);
    if (ids.length === TEXT_PAGE_STICKERS) break;
  }
  return ids;
}

/** 「2025.11.22」 */
export function dottedDate(date: string): string {
  return date.replace(/-/g, ".");
}

/** 照片頁下緣的手寫字，例如「Day 2 · 11.22」 */
export function photoCaption(dayNumber: number, date: string): string {
  return `Day ${dayNumber} · ${date.slice(5).replace("-", ".")}`;
}

/** 一緯度約多少公尺 */
const METERS_PER_DEGREE = 111_320;

export interface RouteSketch {
  readonly points: readonly { readonly x: number; readonly y: number }[];
  /** 草圖上一單位是幾公尺；地點都在同一處（沒有縮放）時為 null */
  readonly metersPerUnit: number | null;
}

/**
 * 把地點的經緯度畫進一個框裡（地點頁的路線草圖）：東西向依緯度縮短，
 * 保持比例放大到框內、置中。只有一個地點或地點都在同一處時放在正中間。
 */
export function sketchPoints(
  points: readonly GeoPoint[],
  box: {
    readonly width: number;
    readonly height: number;
    readonly padding: number;
  },
): RouteSketch {
  if (points.length === 0) return { points: [], metersPerUnit: null };
  const meanLat =
    points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
  const shrink = Math.cos((meanLat * Math.PI) / 180);
  const flat = points.map((p) => ({ x: p.longitude * shrink, y: -p.latitude }));
  const xs = flat.map((p) => p.x);
  const ys = flat.map((p) => p.y);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  const fit = Math.min(
    spanScale(box.width - box.padding * 2, maxX - minX),
    spanScale(box.height - box.padding * 2, maxY - minY),
  );
  const scale = Number.isFinite(fit) ? fit : 0;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  return {
    points: flat.map((p) => ({
      x: round1(box.width / 2 + (p.x - midX) * scale),
      y: round1(box.height / 2 + (p.y - midY) * scale),
    })),
    metersPerUnit: scale > 0 ? METERS_PER_DEGREE / scale : null,
  };
}

/** 比例尺可以用的距離（公尺），取整數好讀的 */
const SCALE_STEPS = [
  10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000,
  100_000, 200_000, 500_000, 1_000_000,
] as const;

/**
 * 草圖的比例尺：不超過 maxLength 單位長的最長整數距離，例如「500 m」「2 km」。
 * 沒有縮放或連最短的距離都放不下時為 null。
 */
export function scaleBar(
  metersPerUnit: number | null,
  maxLength: number,
): { readonly length: number; readonly label: string } | null {
  if (metersPerUnit === null || metersPerUnit <= 0) return null;
  let best: number | null = null;
  for (const meters of SCALE_STEPS) {
    if (meters / metersPerUnit <= maxLength) best = meters;
  }
  if (best === null) return null;
  return {
    length: round1(best / metersPerUnit),
    label: best >= 1_000 ? `${best / 1_000} km` : `${best} m`,
  };
}

/** 一個方向上的縮放；這個方向沒有距離時不限制 */
function spanScale(room: number, span: number): number {
  return span > 0 ? room / span : Infinity;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
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
