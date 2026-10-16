// 僅供測試使用的共用工具，不應被正式程式碼 import。
import type { Result } from "../common/result";
import type { Expense, Ledger } from "./types";

export const ledgerTWD: Ledger = {
  id: "ledger-1",
  baseCurrency: "TWD",
  members: [{ id: "a" }, { id: "b" }, { id: "c" }],
};

export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "e1",
    payerId: "a",
    amountMinor: 300,
    currency: "TWD",
    split: { kind: "equal", participantIds: ["a", "b", "c"] },
    ...overrides,
  };
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`Expected ok, got error: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (result.ok) {
    throw new Error(`Expected error, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error;
}

/** 可重現的偽隨機數產生器，讓不變量測試失敗時能重跑同一組資料 */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}
