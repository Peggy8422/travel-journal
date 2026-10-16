/// <reference types="node" />
// 僅供測試使用：從臺銀網站下載的原始 CSV（保留 BOM 與 CRLF）
import { readFileSync } from "fs";
import { join } from "path";

const read = (name: string) => readFileSync(join(__dirname, name), "utf8");

/** 牌告匯率，2026-10-13 16:42 下載 */
export const realBotDailyCsv = read("bot-daily-2026-10-13.csv");

/** 美金近半年歷史匯率，2026-10-13 17:00 下載，涵蓋 2026-04-14 至 2026-10-13 */
export const realBotUsdHistoryCsv = read("bot-history-usd-6m-2026-10-13.csv");

/** 臺灣時間 2026-10-13 16:42 */
export const FIXTURE_NOW = new Date("2026-10-13T08:42:00Z");
