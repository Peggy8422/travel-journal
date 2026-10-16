import { err, ok, type Result } from "../common/result";
import { parseFxRate } from "../ledger";
import type { FxError } from "./types";

/**
 * 計算 (買入 + 賣出) ÷ 2，全程整數運算，結果精確無誤差。
 * 除以 2 最多只會多一位小數，例如 (0.00097 + 0.00138) ÷ 2 = 0.001175。
 *
 * 買入價高於賣出價在牌告上不可能發生，出現時代表資料有誤（例如解析時欄位錯置），
 * 回傳錯誤而不是算出一個看似合理的數字。
 */
export function computeMidRate(
  buy: string,
  sell: string,
): Result<string, FxError> {
  const parsedBuy = parseFxRate(buy);
  if (!parsedBuy.ok) return err({ code: "INVALID_QUOTE_VALUE", value: buy });
  const parsedSell = parseFxRate(sell);
  if (!parsedSell.ok) return err({ code: "INVALID_QUOTE_VALUE", value: sell });

  const scale = Math.max(parsedBuy.value.scale, parsedSell.value.scale);
  const buyScaled = alignScale(
    parsedBuy.value.numerator,
    parsedBuy.value.scale,
    scale,
  );
  const sellScaled = alignScale(
    parsedSell.value.numerator,
    parsedSell.value.scale,
    scale,
  );

  if (buyScaled > sellScaled) {
    return err({ code: "QUOTE_BUY_ABOVE_SELL", buy, sell });
  }

  const sum = buyScaled + sellScaled;
  const mid =
    sum % 2n === 0n
      ? { value: sum / 2n, scale }
      : { value: sum * 5n, scale: scale + 1 };
  return ok(formatDecimal(mid.value, mid.scale));
}

function alignScale(numerator: bigint, from: number, to: number): bigint {
  return numerator * 10n ** BigInt(to - from);
}

/** 把 numerator / 10^scale 轉成十進位字串，並去掉多餘的尾數 0 */
export function formatDecimal(numerator: bigint, scale: number): string {
  if (scale === 0) return numerator.toString();
  const digits = numerator.toString().padStart(scale + 1, "0");
  const integerPart = digits.slice(0, -scale);
  const fractionPart = digits.slice(-scale).replace(/0+$/, "");
  return fractionPart === "" ? integerPart : `${integerPart}.${fractionPart}`;
}
