/**
 * 可預期錯誤的回傳型別。
 * 慣例：商業規則不成立（例如金額加總不符）回傳 Result；
 * 程式呼叫方式錯誤（違反前置條件）才 throw。
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
