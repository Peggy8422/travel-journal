import { err, ok, type Result } from "../common/result";
import type { LedgerError } from "./errors";
import type { CurrencyCode } from "./types";

/**
 * 各幣別的最小單位小數位數。
 * 未列出的幣別一律回傳錯誤，不猜測位數。
 */
const CURRENCY_DECIMALS: Readonly<Record<CurrencyCode, number>> = {
  // ISO 4217 定義 TWD 為 2 位小數，但日常交易不使用角、分，這裡刻意採 0 位
  TWD: 0,
  JPY: 0,
  KRW: 0,
  VND: 0,
  // ISO 4217 定義 IDR 為 2 位小數，但實務上不使用，比照 TWD 採 0 位
  IDR: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  HKD: 2,
  CNY: 2,
  SGD: 2,
  THB: 2,
  MYR: 2,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  ZAR: 2,
  SEK: 2,
  NZD: 2,
  PHP: 2,
};

/** 帳本支援的所有幣別，順序同上表 */
export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] =
  Object.keys(CURRENCY_DECIMALS);

/** 匯率最多接受的小數位數 */
const MAX_FX_RATE_DECIMALS = 10;
const FX_RATE_PATTERN = new RegExp(
  `^(0|[1-9]\\d*)(\\.\\d{1,${MAX_FX_RATE_DECIMALS}})?$`,
);

/** 匯率 = numerator / 10^scale */
export interface ParsedFxRate {
  readonly numerator: bigint;
  readonly scale: number;
}

export function getCurrencyDecimals(
  currency: CurrencyCode,
): Result<number, LedgerError> {
  const decimals = CURRENCY_DECIMALS[currency];
  return decimals === undefined
    ? err({ code: "UNSUPPORTED_CURRENCY", currency })
    : ok(decimals);
}

export function parseFxRate(rate: string): Result<ParsedFxRate, LedgerError> {
  if (!FX_RATE_PATTERN.test(rate)) {
    return err({ code: "INVALID_FX_RATE", rate });
  }
  const [integerPart = "", fractionPart = ""] = rate.split(".");
  const numerator = BigInt(integerPart + fractionPart);
  if (numerator === 0n) {
    return err({ code: "INVALID_FX_RATE", rate });
  }
  return ok({ numerator, scale: fractionPart.length });
}

/**
 * 把原幣金額換算成基準幣金額，四捨五入（半數進位）只發生這一次。
 * 前置條件：amountMinor 為正安全整數（由呼叫端驗證）。
 */
export function convertToBase(
  amountMinor: number,
  currency: CurrencyCode,
  baseCurrency: CurrencyCode,
  fxRateToBase: string | undefined,
): Result<number, LedgerError> {
  if (currency === baseCurrency) {
    return fxRateToBase === undefined
      ? ok(amountMinor)
      : err({ code: "FX_RATE_UNEXPECTED" });
  }
  if (fxRateToBase === undefined) {
    return err({ code: "FX_RATE_REQUIRED" });
  }

  const fromDecimals = getCurrencyDecimals(currency);
  if (!fromDecimals.ok) return fromDecimals;
  const toDecimals = getCurrencyDecimals(baseCurrency);
  if (!toDecimals.ok) return toDecimals;
  const rate = parseFxRate(fxRateToBase);
  if (!rate.ok) return rate;

  // base = amountMinor / 10^from × (numerator / 10^scale) × 10^to
  const numerator =
    BigInt(amountMinor) *
    rate.value.numerator *
    10n ** BigInt(toDecimals.value);
  const denominator = 10n ** BigInt(rate.value.scale + fromDecimals.value);
  const converted = divideRoundHalfUp(numerator, denominator);

  if (converted === 0n) {
    return err({ code: "CONVERTED_AMOUNT_ZERO" });
  }
  if (converted > BigInt(Number.MAX_SAFE_INTEGER)) {
    return err({ code: "CONVERTED_AMOUNT_TOO_LARGE" });
  }
  return ok(Number(converted));
}

/** 非負整數除法，半數進位 */
function divideRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}
