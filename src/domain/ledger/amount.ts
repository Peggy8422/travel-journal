import { err, type Result } from "../common/result";
import { getCurrencyDecimals } from "./currency";
import type { LedgerError } from "./errors";
import type { CurrencyCode } from "./types";
import { validatePositiveAmount } from "./validation";

const AMOUNT_INPUT = /^(0|[1-9]\d*)(\.(\d+))?$/;

/**
 * 把使用者輸入的金額（例如 "1234.5"）轉成該幣別最小單位的整數。
 * 全程用字串處理，不經過浮點數；小數位數超過幣別允許的位數時回傳錯誤，不自動四捨五入。
 */
export function parseAmountInput(
  text: string,
  currency: CurrencyCode,
): Result<number, LedgerError> {
  const decimals = getCurrencyDecimals(currency);
  if (!decimals.ok) return decimals;

  const match = AMOUNT_INPUT.exec(text.trim().replace(/,/g, ""));
  if (!match) return err({ code: "INVALID_AMOUNT_INPUT", text });
  const [, integerPart = "", , fractionPart = ""] = match;
  if (fractionPart.length > decimals.value) {
    return err({
      code: "TOO_MANY_DECIMALS",
      currency,
      decimals: decimals.value,
    });
  }

  const minor = Number(integerPart + fractionPart.padEnd(decimals.value, "0"));
  return validatePositiveAmount(minor);
}

/**
 * 把最小單位整數格式化成顯示用字串，例如 USD 123450 → "1,234.50"。
 * 支援負數（結餘）。不支援的幣別直接顯示整數，不猜測小數位數。
 */
export function formatMinorAmount(
  amountMinor: number,
  currency: CurrencyCode,
): string {
  const decimals = getCurrencyDecimals(currency);
  const digits = String(Math.abs(amountMinor));
  const sign = amountMinor < 0 ? "-" : "";
  if (!decimals.ok || decimals.value === 0) {
    return sign + groupThousands(digits);
  }
  const padded = digits.padStart(decimals.value + 1, "0");
  const integerPart = padded.slice(0, -decimals.value);
  const fractionPart = padded.slice(-decimals.value);
  return `${sign}${groupThousands(integerPart)}.${fractionPart}`;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
