/** 旅行月份的格式：YYYY-MM，月份 01–12 */
export function isTripMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
