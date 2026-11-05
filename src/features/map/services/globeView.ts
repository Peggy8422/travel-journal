import {
  groupByLocation,
  localDateOf,
  type JournalMapPin,
} from "../../../domain/map";
import type { MapData, MapExpense, MapItem, MapLedger } from "./mapData";

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

/** 一篇有地點的日記；記了好幾個地點也只列一次 */
export interface MapEntry {
  readonly entryId: string;
  readonly journalId: string;
  readonly title: string;
  /** 日記的日期 YYYY-MM-DD */
  readonly date: string;
  /** 依日記裡的順序；第一個是點這篇日記時地球要轉過去的地方 */
  readonly pins: readonly JournalMapPin[];
}

/** 消費卡片清單的一列 */
export type SheetRow =
  | { readonly kind: "expense"; readonly expense: MapExpense }
  | { readonly kind: "entry"; readonly entry: MapEntry };

export interface GlobeSheetContent {
  /**
   * 有東西要列出的帳本，依索引籤的順序；每本依日期由舊到新，
   * 同一天的日記排在消費前面，消費依時間由舊到新
   */
  readonly sections: readonly {
    readonly ledger: MapLedger;
    readonly rows: readonly SheetRow[];
  }[];
  /** 選取帳本裡所有有地點的消費（不受 placeIds 影響），給標題的筆數與合計用 */
  readonly expenses: readonly MapExpense[];
  /** 選取帳本裡有地點的日記篇數（不受 placeIds 影響） */
  readonly entryCount: number;
  /** 不同座標的數量（同一家店的多筆消費、同一個地方的日記算一個） */
  readonly placeCount: number;
  /** 換算成新台幣的合計；匯率資料有誤的消費不算進去 */
  readonly totalBaseMinor: number;
}

/**
 * 消費卡片的內容。placeIds 是在地球上點的那一群 pin：有的話清單只列這幾筆消費、
 * 這幾篇日記，標題的筆數與合計仍然是整本（幾本）帳本的。
 */
export function globeSheet(
  data: MapData,
  pickedIds: readonly string[],
  placeIds: readonly string[] | null,
): GlobeSheetContent {
  const picked = data.ledgers.filter((l) => pickedIds.includes(l.id));
  const pins = data.pins.filter((p) => pickedIds.includes(p.ledgerId));
  const expenses = pins.filter((p) => p.kind === "expense");
  const entries = entriesOf(pins);
  const rows = sheetRows(expenses, entries).filter((row) =>
    placeIds === null
      ? true
      : row.kind === "expense"
        ? placeIds.includes(row.expense.id)
        : row.entry.pins.some((p) => placeIds.includes(p.id)),
  );
  return {
    sections: picked
      .map((ledger) => ({
        ledger,
        rows: rows.filter((r) => rowLedgerId(r) === ledger.id),
      }))
      .filter((s) => s.rows.length > 0),
    expenses,
    entryCount: entries.length,
    placeCount: groupByLocation(pins).length,
    totalBaseMinor: expenses.reduce((sum, e) => sum + (e.baseMinor ?? 0), 0),
  };
}

/** 日記的地點依日記合成一列，保持各篇第一次出現的順序 */
export function entriesOf(pins: readonly MapItem[]): MapEntry[] {
  const entries = new Map<string, MapEntry & { pins: JournalMapPin[] }>();
  for (const pin of pins) {
    if (pin.kind !== "journal") continue;
    const entry = entries.get(pin.entryId);
    if (entry) {
      entry.pins.push(pin);
    } else {
      entries.set(pin.entryId, {
        entryId: pin.entryId,
        journalId: pin.journalId,
        title: pin.title,
        date: pin.date,
        pins: [pin],
      });
    }
  }
  return [...entries.values()];
}

function sheetRows(
  expenses: readonly MapExpense[],
  entries: readonly MapEntry[],
): SheetRow[] {
  const keyed = [
    ...entries.map((entry) => ({
      date: entry.date,
      rank: 0,
      row: { kind: "entry", entry } as const,
    })),
    ...expenses.map((expense) => ({
      date: localDateOf(expense),
      rank: 1,
      row: { kind: "expense", expense } as const,
    })),
  ];
  // sort is stable, so expenses keep their time order within a day
  return keyed
    .sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank)
    .map((k) => k.row);
}

function rowLedgerId(row: SheetRow): string {
  return row.kind === "expense"
    ? row.expense.ledgerId
    : row.entry.pins[0].ledgerId;
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
export function clusterLabel(items: readonly MapItem[]): string {
  const names = [...new Set(items.map((e) => e.placeName ?? e.title))];
  return names.length === 1 ? names[0] : `${names[0]} 等`;
}

/** 讀給螢幕閱讀器的標記說明 */
export function clusterDescription(items: readonly MapItem[]): string {
  const names = [...new Set(items.map((e) => e.placeName ?? e.title))];
  return `${names.join("、")}，${countLabel(items)}`;
}

/** 「2 篇日記、3 筆消費」；沒有的那一種不寫 */
export function countLabel(items: readonly MapItem[]): string {
  const expenses = items.filter((p) => p.kind === "expense").length;
  const entries = entriesOf(items).length;
  return [
    entries > 0 ? `${entries} 篇日記` : null,
    expenses > 0 ? `${expenses} 筆消費` : null,
  ]
    .filter((part) => part !== null)
    .join("、");
}
