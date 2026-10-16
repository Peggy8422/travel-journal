import { err, ok, type Result } from "../common/result";
import type { FxError } from "./types";

/** 臺灣自 1979 年起未實施日光節約時間，固定 UTC+8 */
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 必須明確帶時區：結尾為 Z 或 ±hh:mm */
const TIMESTAMP_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 把帶時區的時間點換算成臺灣時間的日期（YYYY-MM-DD）。
 * 拒絕不帶時區的字串，因為那會被當成裝置本地時間解析，不同手機結果不同。
 */
export function toTaipeiDate(timestamp: string): Result<string, FxError> {
  if (!TIMESTAMP_WITH_ZONE.test(timestamp)) {
    return err({ code: "INVALID_TIMESTAMP", value: timestamp });
  }
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) {
    return err({ code: "INVALID_TIMESTAMP", value: timestamp });
  }
  return ok(new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10));
}

/** 日期字串加減天數，結果仍為 YYYY-MM-DD。拒絕 2026-02-30 這類會被 Date 自動進位的無效日期 */
export function addDays(date: string, days: number): Result<string, FxError> {
  if (!DATE_ONLY.test(date)) {
    return err({ code: "INVALID_DATE", value: date });
  }
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    return err({ code: "INVALID_DATE", value: date });
  }
  return ok(new Date(ms + days * DAY_MS).toISOString().slice(0, 10));
}
