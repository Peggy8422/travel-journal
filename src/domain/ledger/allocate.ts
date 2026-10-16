/**
 * 用最大餘數法把 totalMinor 依權重分成整數份額，保證加總等於 totalMinor。
 * 餘數相同時，索引較前者優先；呼叫端應依成員加入順序傳入權重。
 *
 * 前置條件（違反時 throw，屬於程式錯誤而非使用者輸入錯誤）：
 * - totalMinor 為非負安全整數
 * - weights 非空，且每個值都是正安全整數
 */
export function allocateByWeights(
  totalMinor: number,
  weights: readonly number[],
): number[] {
  assertPreconditions(totalMinor, weights);

  const total = BigInt(totalMinor);
  const bigWeights = weights.map(BigInt);
  const weightSum = bigWeights.reduce((sum, w) => sum + w, 0n);

  const allocated = bigWeights.map((w) => (total * w) / weightSum);
  const byRemainderDesc = bigWeights
    .map((w, index) => ({ index, remainder: (total * w) % weightSum }))
    .sort((a, b) => compareRemainderDesc(a, b));

  let leftover = total - allocated.reduce((sum, a) => sum + a, 0n);
  for (const { index } of byRemainderDesc) {
    if (leftover === 0n) break;
    allocated[index] = (allocated[index] ?? 0n) + 1n;
    leftover -= 1n;
  }

  return allocated.map(Number);
}

function compareRemainderDesc(
  a: { index: number; remainder: bigint },
  b: { index: number; remainder: bigint },
): number {
  if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
  return a.index - b.index;
}

function assertPreconditions(
  totalMinor: number,
  weights: readonly number[],
): void {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) {
    throw new RangeError(
      `totalMinor must be a non-negative safe integer, got ${totalMinor}`,
    );
  }
  if (weights.length === 0) {
    throw new RangeError("weights must not be empty");
  }
  for (const w of weights) {
    if (!Number.isSafeInteger(w) || w <= 0) {
      throw new RangeError(
        `every weight must be a positive safe integer, got ${w}`,
      );
    }
  }
}
