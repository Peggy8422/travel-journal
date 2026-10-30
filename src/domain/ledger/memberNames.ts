/*
 * 同一本帳本裡成員名字不能重複，不然記帳、看結算時分不出是誰。
 */

/** 兩個名字算不算同一個：去掉前後空白，英文不分大小寫 */
export function sameMemberName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** 名單裡第一個和前面重複的名字（原樣回傳）；沒有重複時為 undefined */
export function findDuplicateName(
  names: readonly string[],
): string | undefined {
  return names.find((name, i) =>
    names.slice(0, i).some((other) => sameMemberName(other, name)),
  );
}
