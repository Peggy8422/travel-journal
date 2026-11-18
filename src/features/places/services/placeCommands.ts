import { err, ok, type Result } from "../../../domain/common/result";
import {
  checkTextLength,
  type GeoPoint,
  type TextTooLongError,
} from "../../../domain/ledger";
import type { DeviceLocator } from "../../../domain/location";
import {
  ACTIVE_CRITERIA_LIMIT,
  parseRating,
  PLACE_PHOTO_LIMIT,
  type PlaceKind,
  type PlaceRating,
  type PlaceStatus,
  type RatingCriterionRecord,
  type SavedPlaceRecord,
} from "../../../domain/places";
import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { createRepositories } from "../../../data/repositories";
import type { LedgerCommandDeps } from "../../ledger/services/ledgerCommands";
import { loadHereItems, type HereItem } from "./placeHere";

/*
 * 收藏地點與評分項目的寫入與讀取。和帳本一樣：驗證失敗回傳 Result，資料庫錯誤直接 throw。
 * 刪除地點是軟刪除，可以從提示紙條的「復原」或「最近刪除」放回來。
 */

export type PlaceCommandDeps = LedgerCommandDeps;

export type PlaceCommandError =
  | TextTooLongError
  | { readonly code: "EMPTY_PLACE_NAME" }
  | { readonly code: "TOO_MANY_PHOTOS"; readonly max: number }
  | { readonly code: "PLACE_NOT_FOUND"; readonly placeId: string }
  | {
      readonly code: "RATING_CRITERION_NOT_FOUND";
      readonly criterionId: string;
    }
  | { readonly code: "EMPTY_CRITERION_LABEL" }
  /** 使用中的評分項目已經有同名的 */
  | { readonly code: "DUPLICATE_CRITERION_LABEL"; readonly label: string }
  | { readonly code: "TOO_MANY_CRITERIA"; readonly max: number };

export type PlaceCommandResult<T> = Promise<Result<T, PlaceCommandError>>;

/** 新增與編輯地點時使用者可以改的欄位 */
export interface PlaceInput {
  readonly name: string;
  readonly location: GeoPoint;
  readonly city: string;
  readonly kind: PlaceKind;
  readonly status: PlaceStatus;
  readonly note: string;
  readonly ratings: readonly PlaceRating[];
  readonly revisit: boolean;
  readonly photos: readonly string[];
}

export async function addPlace(
  deps: PlaceCommandDeps,
  input: PlaceInput,
): PlaceCommandResult<SavedPlaceRecord> {
  const checked = await checkPlace(deps.db, input);
  if (!checked.ok) return checked;
  const timestamp = deps.now().toISOString();
  const place: SavedPlaceRecord = {
    id: deps.newId(),
    ...checked.value,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
  await deps.db.transaction((tx) =>
    createRepositories(tx).savedPlaces.insert(place),
  );
  return ok(place);
}

/** 修改地點；拿掉的照片之後由 tidyCoverPhotos 清掉 */
export async function updatePlace(
  deps: PlaceCommandDeps,
  placeId: string,
  input: PlaceInput,
): PlaceCommandResult<SavedPlaceRecord> {
  const place = await createRepositories(deps.db).savedPlaces.findById(placeId);
  if (!place || place.deletedAt !== null) {
    return err({ code: "PLACE_NOT_FOUND", placeId });
  }
  const checked = await checkPlace(deps.db, input);
  if (!checked.ok) return checked;
  const updated: SavedPlaceRecord = {
    ...place,
    ...checked.value,
    updatedAt: deps.now().toISOString(),
  };
  await deps.db.transaction((tx) =>
    createRepositories(tx).savedPlaces.update(updated),
  );
  return ok(updated);
}

export async function deletePlace(
  deps: PlaceCommandDeps,
  placeId: string,
): PlaceCommandResult<void> {
  const repos = createRepositories(deps.db);
  const place = await repos.savedPlaces.findById(placeId);
  if (!place || place.deletedAt !== null) {
    return err({ code: "PLACE_NOT_FOUND", placeId });
  }
  await repos.savedPlaces.softDelete(placeId, deps.now().toISOString());
  return ok(undefined);
}

/** 放回刪除的地點；已經在清單裡的也算成功 */
export async function restorePlace(
  deps: PlaceCommandDeps,
  placeId: string,
): PlaceCommandResult<void> {
  const repos = createRepositories(deps.db);
  const place = await repos.savedPlaces.findById(placeId);
  if (!place) return err({ code: "PLACE_NOT_FOUND", placeId });
  if (place.deletedAt !== null) {
    await repos.savedPlaces.restore(placeId, deps.now().toISOString());
  }
  return ok(undefined);
}

/**
 * 檢查並整理欄位：名稱、城市、心得去掉前後空白，名稱不能空白；
 * 同一個評分項目只留最後一個分數，分數夾回 1～5，評分項目要存在（封存的也可以，舊分數照樣保留）。
 */
async function checkPlace(
  db: SqlExecutor,
  input: PlaceInput,
): Promise<
  Result<
    Omit<SavedPlaceRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">,
    PlaceCommandError
  >
> {
  const name = input.name.trim();
  if (name === "") return err({ code: "EMPTY_PLACE_NAME" });
  const city = input.city.trim();
  const note = input.note.trim();
  for (const [field, text] of [
    ["placeName", name],
    ["city", city],
    ["placeNote", note],
  ] as const) {
    const length = checkTextLength(field, text);
    if (!length.ok) return length;
  }
  if (input.photos.length > PLACE_PHOTO_LIMIT) {
    return err({ code: "TOO_MANY_PHOTOS", max: PLACE_PHOTO_LIMIT });
  }
  const known = new Set(
    (await createRepositories(db).ratingCriteria.list()).map((c) => c.id),
  );
  const scores = new Map<string, PlaceRating>();
  for (const rating of input.ratings) {
    const parsed = parseRating(rating);
    if (!parsed.ok || !known.has(rating.criterionId)) {
      return err({
        code: "RATING_CRITERION_NOT_FOUND",
        criterionId: rating.criterionId,
      });
    }
    scores.set(rating.criterionId, parsed.value);
  }
  return ok({
    name,
    location: input.location,
    city,
    kind: input.kind,
    status: input.status,
    note,
    ratings: [...scores.values()],
    revisit: input.revisit,
    photos: input.photos,
  });
}

/** 收藏清單頁要顯示的資料 */
export interface PlaceList {
  /** 依加入的時間由新到舊 */
  readonly places: readonly SavedPlaceRecord[];
  /** 全部評分項目（含封存的），依顯示順序 */
  readonly criteria: readonly RatingCriterionRecord[];
  /** 最近刪除的在前 */
  readonly deleted: readonly SavedPlaceRecord[];
}

export async function loadPlaceList(db: SqlExecutor): Promise<PlaceList> {
  const repos = createRepositories(db);
  const [all, criteria] = await Promise.all([
    repos.savedPlaces.list({ includeDeleted: true }),
    repos.ratingCriteria.list(),
  ]);
  return {
    places: all.filter((p) => p.deletedAt === null),
    criteria,
    deleted: all
      .filter((p) => p.deletedAt !== null)
      .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")),
  };
}

/** 地點頁要顯示的資料 */
export interface PlaceDetail {
  readonly place: SavedPlaceRecord;
  readonly criteria: readonly RatingCriterionRecord[];
  /** 在這個地點附近的日記與消費，新的在前 */
  readonly here: readonly HereItem[];
}

/** 刪除的地點讀不到（地點頁直接當作不存在） */
export async function loadPlace(
  db: SqlExecutor,
  placeId: string,
): PlaceCommandResult<PlaceDetail> {
  const repos = createRepositories(db);
  const place = await repos.savedPlaces.findById(placeId);
  if (!place || place.deletedAt !== null) {
    return err({ code: "PLACE_NOT_FOUND", placeId });
  }
  const [criteria, here] = await Promise.all([
    repos.ratingCriteria.list(),
    loadHereItems(db, place.location),
  ]);
  return ok({ place, criteria, here });
}

/** 新增／編輯表單要的資料 */
export interface PlaceForm {
  /** 正在編輯的地點；新增時為 null */
  readonly place: SavedPlaceRecord | null;
  readonly criteria: readonly RatingCriterionRecord[];
  /** 已經收藏過的城市，用的次數多的在前，城市欄可以直接點選 */
  readonly cities: readonly string[];
}

export async function loadPlaceForm(
  db: SqlExecutor,
  placeId: string | null,
): PlaceCommandResult<PlaceForm> {
  const repos = createRepositories(db);
  const [places, criteria] = await Promise.all([
    repos.savedPlaces.list(),
    repos.ratingCriteria.list(),
  ]);
  let place: SavedPlaceRecord | null = null;
  if (placeId !== null) {
    place = places.find((p) => p.id === placeId) ?? null;
    if (!place) return err({ code: "PLACE_NOT_FOUND", placeId });
  }
  return ok({ place, criteria, cities: citiesByUse(places) });
}

function citiesByUse(places: readonly SavedPlaceRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const { city } of places) {
    if (city !== "") counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([city]) => city);
}

/** 座標所在的城市，填進城市欄用；查不到或查詢失敗時回傳 null，不會 throw */
export async function cityOf(
  locator: DeviceLocator,
  point: GeoPoint,
): Promise<string | null> {
  try {
    return (await locator.cityAt(point))?.trim() || null;
  } catch {
    return null;
  }
}

/** 清單上的一個城市分組 */
export interface CityGroup {
  /** 空字串是沒有填城市的地點 */
  readonly city: string;
  readonly places: readonly SavedPlaceRecord[];
}

/**
 * 依城市分組：最近加過地點的城市排前面，組內依加入的時間由新到舊；
 * 沒有填城市的放在最後。places 要先依加入時間由新到舊排好（loadPlaceList 的順序）。
 */
export function groupByCity(places: readonly SavedPlaceRecord[]): CityGroup[] {
  const groups = new Map<string, SavedPlaceRecord[]>();
  for (const place of places) {
    groups.set(place.city, [...(groups.get(place.city) ?? []), place]);
  }
  const named = [...groups.entries()].filter(([city]) => city !== "");
  const unnamed = groups.get("");
  return [
    ...named.map(([city, list]) => ({ city, places: list })),
    ...(unnamed ? [{ city: "", places: unnamed }] : []),
  ];
}

// ---- 評分項目 ----

/** 全部評分項目（含封存的），依顯示順序 */
export async function loadCriteria(
  db: SqlExecutor,
): Promise<RatingCriterionRecord[]> {
  return createRepositories(db).ratingCriteria.list();
}

export async function addCriterion(
  deps: PlaceCommandDeps,
  label: string,
): PlaceCommandResult<RatingCriterionRecord> {
  const all = await loadCriteria(deps.db);
  const checked = checkLabel(label, all, null);
  if (!checked.ok) return checked;
  if (
    all.filter((c) => c.archivedAt === null).length >= ACTIVE_CRITERIA_LIMIT
  ) {
    return err({ code: "TOO_MANY_CRITERIA", max: ACTIVE_CRITERIA_LIMIT });
  }
  const timestamp = deps.now().toISOString();
  const criterion: RatingCriterionRecord = {
    id: deps.newId(),
    label: checked.value,
    sortOrder: Math.max(-1, ...all.map((c) => c.sortOrder)) + 1,
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await createRepositories(deps.db).ratingCriteria.insert(criterion);
  return ok(criterion);
}

export async function renameCriterion(
  deps: PlaceCommandDeps,
  criterionId: string,
  label: string,
): PlaceCommandResult<RatingCriterionRecord> {
  const all = await loadCriteria(deps.db);
  const criterion = all.find((c) => c.id === criterionId);
  if (!criterion) {
    return err({ code: "RATING_CRITERION_NOT_FOUND", criterionId });
  }
  const checked = checkLabel(label, all, criterionId);
  if (!checked.ok) return checked;
  const updated = {
    ...criterion,
    label: checked.value,
    updatedAt: deps.now().toISOString(),
  };
  await createRepositories(deps.db).ratingCriteria.update(updated);
  return ok(updated);
}

/** 封存：不再出現在評分表單，已經打的分數照樣保留、照樣顯示 */
export async function archiveCriterion(
  deps: PlaceCommandDeps,
  criterionId: string,
): PlaceCommandResult<void> {
  const criterion = (await loadCriteria(deps.db)).find(
    (c) => c.id === criterionId,
  );
  if (!criterion) {
    return err({ code: "RATING_CRITERION_NOT_FOUND", criterionId });
  }
  if (criterion.archivedAt === null) {
    const timestamp = deps.now().toISOString();
    await createRepositories(deps.db).ratingCriteria.update({
      ...criterion,
      archivedAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return ok(undefined);
}

/** 把封存的項目拿回來用，接在使用中的最後面 */
export async function restoreCriterion(
  deps: PlaceCommandDeps,
  criterionId: string,
): PlaceCommandResult<void> {
  const all = await loadCriteria(deps.db);
  const criterion = all.find((c) => c.id === criterionId);
  if (!criterion) {
    return err({ code: "RATING_CRITERION_NOT_FOUND", criterionId });
  }
  if (criterion.archivedAt === null) return ok(undefined);
  const active = all.filter((c) => c.archivedAt === null);
  if (active.length >= ACTIVE_CRITERIA_LIMIT) {
    return err({ code: "TOO_MANY_CRITERIA", max: ACTIVE_CRITERIA_LIMIT });
  }
  const checked = checkLabel(criterion.label, all, criterionId);
  if (!checked.ok) return checked;
  await createRepositories(deps.db).ratingCriteria.update({
    ...criterion,
    archivedAt: null,
    sortOrder: Math.max(-1, ...all.map((c) => c.sortOrder)) + 1,
    updatedAt: deps.now().toISOString(),
  });
  return ok(undefined);
}

/** 使用中的評分項目往前（-1）或往後（1）移一格；已經在最前或最後時不動 */
export async function moveCriterion(
  deps: PlaceCommandDeps,
  criterionId: string,
  step: -1 | 1,
): PlaceCommandResult<void> {
  const active = (await loadCriteria(deps.db)).filter(
    (c) => c.archivedAt === null,
  );
  const index = active.findIndex((c) => c.id === criterionId);
  if (index < 0) {
    return err({ code: "RATING_CRITERION_NOT_FOUND", criterionId });
  }
  const other = active[index + step];
  if (!other) return ok(undefined);
  const current = active[index]!;
  const timestamp = deps.now().toISOString();
  await deps.db.transaction(async (tx) => {
    const repos = createRepositories(tx);
    await repos.ratingCriteria.update({
      ...current,
      sortOrder: other.sortOrder,
      updatedAt: timestamp,
    });
    await repos.ratingCriteria.update({
      ...other,
      sortOrder: current.sortOrder,
      updatedAt: timestamp,
    });
  });
  return ok(undefined);
}

/** 名稱去掉前後空白、不能空白、不能和其他使用中的項目同名（英文不分大小寫） */
function checkLabel(
  label: string,
  all: readonly RatingCriterionRecord[],
  selfId: string | null,
): Result<string, PlaceCommandError> {
  const trimmed = label.trim();
  if (trimmed === "") return err({ code: "EMPTY_CRITERION_LABEL" });
  const length = checkTextLength("ratingLabel", trimmed);
  if (!length.ok) return length;
  const clash = all.some(
    (c) =>
      c.id !== selfId &&
      c.archivedAt === null &&
      c.label.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  if (clash) return err({ code: "DUPLICATE_CRITERION_LABEL", label: trimmed });
  return ok(trimmed);
}
