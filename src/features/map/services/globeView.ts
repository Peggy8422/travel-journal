import { groupByLocation } from "../../../domain/map";
import type { MapData, MapExpense, MapLedger } from "./mapData";

/*
 * 地球分頁的整理（純函式）：右側索引籤的年份分組、下方消費卡片的內容、畫面上標記的合併。
 */

/** 分帳帳本依旅行月份的年份分組，年份由新到舊；帳本保持傳入的順序 */
export function groupLedgersByYear(
  ledgers: readonly MapLedger[],
): { year: string; ledgers: MapLedger[] }[] {
  const years = new Map<string, MapLedger[]>();
  for (const ledger of ledgers) {
    if (ledger.kind !== "shared") continue;
    const year = ledger.tripMonth.slice(0, 4);
    const list = years.get(year);
    if (list) list.push(ledger);
    else years.set(year, [ledger]);
  }
  return [...years]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, list]) => ({ year, ledgers: list }));
}

export interface GlobeSheetContent {
  /** 有消費要列出的帳本，依索引籤的順序；每本的消費依時間由舊到新 */
  readonly sections: readonly {
    readonly ledger: MapLedger;
    readonly expenses: readonly MapExpense[];
  }[];
  /** 選取帳本裡所有有地點的消費（不受 placeIds 影響），給標題與地球用 */
  readonly expenses: readonly MapExpense[];
  /** 不同座標的數量（同一家店的多筆消費算一個） */
  readonly placeCount: number;
  /** 換算成新台幣的合計；匯率資料有誤的消費不算進去 */
  readonly totalBaseMinor: number;
}

/**
 * 消費卡片的內容。placeIds 是在地球上點的那一群消費：有的話清單只列這幾筆，
 * 標題的筆數與合計仍然是整本（幾本）帳本的。
 */
export function globeSheet(
  data: MapData,
  pickedIds: readonly string[],
  placeIds: readonly string[] | null,
): GlobeSheetContent {
  const picked = data.ledgers.filter((l) => pickedIds.includes(l.id));
  const expenses = data.pins.filter((p) => pickedIds.includes(p.ledgerId));
  const shown = placeIds
    ? expenses.filter((e) => placeIds.includes(e.id))
    : expenses;
  return {
    sections: picked
      .map((ledger) => ({
        ledger,
        expenses: shown.filter((e) => e.ledgerId === ledger.id),
      }))
      .filter((s) => s.expenses.length > 0),
    expenses,
    placeCount: groupByLocation(expenses).length,
    totalBaseMinor: expenses.reduce((sum, e) => sum + (e.baseMinor ?? 0), 0),
  };
}

/** 在畫面上合在一起的標記 */
export interface ScreenCluster<T> {
  /** 第一個點的位置 */
  readonly x: number;
  readonly y: number;
  readonly items: readonly T[];
}

/**
 * 畫面上距離小於 distance（px）的點合成一個標記，避免疊在一起點不到。
 * 依傳入順序，每個點併進第一個夠近的標記。
 */
export function clusterOnScreen<T>(
  points: readonly { item: T; x: number; y: number }[],
  distance: number,
): ScreenCluster<T>[] {
  const clusters: { x: number; y: number; items: T[] }[] = [];
  for (const { item, x, y } of points) {
    const hit = clusters.find((c) => Math.hypot(c.x - x, c.y - y) < distance);
    if (hit) hit.items.push(item);
    else clusters.push({ x, y, items: [item] });
  }
  return clusters;
}

/** 標記旁的小標籤：地名（沒填地名用消費名稱），不只一個地方時寫「… 等」 */
export function clusterLabel(items: readonly MapExpense[]): string {
  const names = [...new Set(items.map((e) => e.placeName ?? e.title))];
  return names.length === 1 ? names[0] : `${names[0]} 等`;
}

/** 讀給螢幕閱讀器的標記說明 */
export function clusterDescription(items: readonly MapExpense[]): string {
  const names = [...new Set(items.map((e) => e.placeName ?? e.title))];
  return `${names.join("、")}，${items.length} 筆消費`;
}
