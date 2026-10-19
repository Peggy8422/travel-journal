import { toTaipeiDate } from "../../domain/fx";

/** 資料庫裡的資料不符合預期格式（例如 split JSON 損壞）。代表程式或 migration 有 bug，應該被記錄下來 */
export class StoredDataError extends Error {
  constructor(
    readonly table: string,
    readonly id: string,
    readonly reason: string,
  ) {
    super(`Invalid stored data in ${table} (${id}): ${reason}`);
    this.name = "StoredDataError";
  }
}

/**
 * 帶時區的時間字串轉成 epoch 毫秒，給排序欄位用。
 * 不帶時區的字串會被當成裝置本地時間解析，所以直接拒絕（呼叫端的 bug）。
 */
export function toEpochMs(timestamp: string): number {
  if (!toTaipeiDate(timestamp).ok) {
    throw new RangeError(
      `Timestamp must be ISO 8601 with a time zone, got ${timestamp}`,
    );
  }
  return Date.parse(timestamp);
}
