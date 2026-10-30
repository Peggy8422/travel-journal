import type { CurrencyCode } from "../../../domain/ledger";

/** 幣別的中文名稱（幣別選單用）；SUPPORTED_CURRENCIES 新增幣別時要一起補 */
const CURRENCY_NAMES: Readonly<Record<CurrencyCode, string>> = {
  TWD: "新台幣",
  JPY: "日圓",
  KRW: "韓元",
  VND: "越南盾",
  IDR: "印尼盾",
  USD: "美元",
  EUR: "歐元",
  GBP: "英鎊",
  HKD: "港幣",
  CNY: "人民幣",
  SGD: "新加坡幣",
  THB: "泰銖",
  MYR: "馬來西亞令吉",
  AUD: "澳幣",
  CAD: "加拿大幣",
  CHF: "瑞士法郎",
  ZAR: "南非幣",
  SEK: "瑞典克朗",
  NZD: "紐西蘭幣",
  PHP: "菲律賓披索",
};

/** 例如「JPY 日圓」；沒有中文名稱的幣別只顯示代碼 */
export function currencyLabel(code: CurrencyCode): string {
  const name = CURRENCY_NAMES[code];
  return name ? `${code} ${name}` : code;
}
