import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import type { JournalEntryRecord } from "../../../domain/journal";
import type {
  CurrencyCode,
  GeoPoint,
  LedgerRecord,
  LocatedExpenseRecord,
} from "../../../domain/ledger";
import {
  isNearby,
  isPlaceKind,
  placeKindOf,
  type PlaceKind,
  type SavedPlaceRecord,
} from "../../../domain/places";
import { entryHeading } from "../../journal/services/journalDates";

/*
 * 收藏地點和日記、消費之間不另外存關聯，一律用距離判斷（NEARBY_METERS）：
 * 地點頁列出「在這裡的日記與消費」，日記頁、消費明細的地點旁邊顯示收藏過了沒。
 */

/** 地點頁「在這裡的日記與消費」的一列 */
export type HereItem =
  | {
      readonly kind: "entry";
      readonly id: string;
      readonly journalId: string;
      /** 日記日期（當地 YYYY-MM-DD） */
      readonly date: string;
      readonly title: string;
      readonly journalName: string;
    }
  | {
      readonly kind: "expense";
      readonly id: string;
      /** 消費當地日期 YYYY-MM-DD */
      readonly date: string;
      readonly title: string;
      readonly category: string | null;
      readonly amountMinor: number;
      readonly currency: CurrencyCode;
      /** 帳本名稱；個人記帳為 null */
      readonly ledgerName: string | null;
    };

export interface HereJournal {
  readonly name: string;
  readonly entries: readonly JournalEntryRecord[];
}

/**
 * 在這個地點附近的日記（任一個地點在附近就算）與消費，新的在前；
 * 同一天日記排在消費前面，消費依時間由晚到早。
 */
export function hereItems(
  point: GeoPoint,
  expenses: readonly LocatedExpenseRecord[],
  ledgers: readonly LedgerRecord[],
  journals: readonly HereJournal[],
): HereItem[] {
  const ledgerById = new Map(ledgers.map((l) => [l.id, l]));
  const entries: HereItem[] = journals.flatMap((journal) =>
    journal.entries
      .filter(
        (entry) =>
          entry.deletedAt === null &&
          entry.places.some((p) => isNearby(point, p.location)),
      )
      .map((entry) => ({
        kind: "entry" as const,
        id: entry.id,
        journalId: entry.journalId,
        date: entry.date,
        title: entryHeading(entry),
        journalName: journal.name,
      })),
  );
  const spent = expenses
    .filter((e) => e.deletedAt === null && isNearby(point, e.location))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .map((e): HereItem => {
      const ledger = ledgerById.get(e.ledgerId);
      return {
        kind: "expense",
        id: e.id,
        date: e.occurredAt.slice(0, 10),
        title: e.title,
        category: e.category,
        amountMinor: e.amountMinor,
        currency: e.currency,
        ledgerName: !ledger || ledger.kind === "personal" ? null : ledger.name,
      };
    });
  // Stable sort keeps entries ahead of expenses on the same day
  return [...entries, ...spent].sort((a, b) => b.date.localeCompare(a.date));
}

export async function loadHereItems(
  db: SqlExecutor,
  point: GeoPoint,
): Promise<HereItem[]> {
  const repos = createRepositories(db);
  const [expenses, ledgers, journals] = await Promise.all([
    repos.expenses.listWithLocation(),
    repos.ledgers.list(),
    repos.journals.list(),
  ]);
  const withEntries = await Promise.all(
    journals.map(async (journal) => ({
      name: journal.name,
      entries: await repos.journalEntries.listByJournal(journal.id),
    })),
  );
  return hereItems(point, expenses, ledgers, withEntries);
}

/** 收藏清單裡沒刪除的地點，日記頁、消費明細判斷地點收藏過了沒 */
export async function loadSavedPlaces(
  db: SqlExecutor,
): Promise<SavedPlaceRecord[]> {
  return createRepositories(db).savedPlaces.list();
}

/** 「收藏這裡」帶進收藏表單的內容；表單打開後名稱、類型都還能改 */
export interface PlacePrefill {
  readonly name: string;
  readonly location: GeoPoint;
  readonly kind: PlaceKind;
}

/** 收藏表單的路由參數（`/places/new`） */
export type PrefillParams = {
  readonly name: string;
  readonly lat: string;
  readonly lng: string;
  readonly kind: string;
};

export function prefillParams(prefill: PlacePrefill): PrefillParams {
  return {
    name: prefill.name,
    lat: String(prefill.location.latitude),
    lng: String(prefill.location.longitude),
    kind: prefill.kind,
  };
}

/** 從消費的地點收藏：名稱用記帳時的地名（沒有的話用消費名稱），類型照消費分類 */
export function prefillFromExpense(expense: {
  readonly title: string;
  readonly placeName: string | null;
  readonly category: string | null;
  readonly location: GeoPoint;
}): PlacePrefill {
  return {
    name: expense.placeName ?? expense.title,
    location: expense.location,
    kind: placeKindOf(expense.category),
  };
}

/** 讀回路由參數；座標不完整或超出範圍時當作沒有帶入（一般的「收藏地點」） */
export function parsePrefill(
  params: Partial<Record<keyof PrefillParams, string>>,
): PlacePrefill | null {
  const latitude = Number(params.lat);
  const longitude = Number(params.lng);
  if (
    params.lat === undefined ||
    params.lng === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return {
    name: params.name?.trim() ?? "",
    location: { latitude, longitude },
    kind:
      params.kind !== undefined && isPlaceKind(params.kind)
        ? params.kind
        : "other",
  };
}
