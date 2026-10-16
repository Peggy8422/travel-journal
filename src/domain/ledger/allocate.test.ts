import { allocateByWeights } from "./allocate";
import { seededRandom } from "./testFixtures";

describe("allocateByWeights", () => {
  it("gives leftover units to earlier indexes on a tie", () => {
    expect(allocateByWeights(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateByWeights(101, [1, 1, 1])).toEqual([34, 34, 33]);
  });

  it("splits evenly when divisible", () => {
    expect(allocateByWeights(90, [1, 1, 1])).toEqual([30, 30, 30]);
  });

  it("returns the weights themselves when total equals their sum", () => {
    expect(allocateByWeights(100, [60, 25, 15])).toEqual([60, 25, 15]);
  });

  it("gives the leftover to the largest remainder, not just the first index", () => {
    // 333.33 / 666.67 → 第二位餘數較大
    expect(allocateByWeights(1000, [1, 2])).toEqual([333, 667]);
  });

  it("handles totals smaller than the number of participants", () => {
    expect(allocateByWeights(2, [1, 1, 1])).toEqual([1, 1, 0]);
    expect(allocateByWeights(0, [1, 1])).toEqual([0, 0]);
  });

  it.each([
    [-1, [1]],
    [1.5, [1]],
    [Number.MAX_SAFE_INTEGER + 1, [1]],
    [10, []],
    [10, [0, 1]],
    [10, [-1, 2]],
    [10, [1.5]],
  ])(
    "throws on precondition violation (total=%p, weights=%p)",
    (total, weights) => {
      expect(() => allocateByWeights(total, weights)).toThrow(RangeError);
    },
  );

  it("always sums to the total and stays within one unit of the exact share", () => {
    const random = seededRandom(42);
    for (let run = 0; run < 500; run++) {
      const total = Math.floor(random() * 1_000_000);
      const weights = Array.from(
        { length: 1 + Math.floor(random() * 8) },
        () => 1 + Math.floor(random() * 1000),
      );
      const weightSum = weights.reduce((s, w) => s + w, 0);

      const result = allocateByWeights(total, weights);

      expect(result.reduce((s, v) => s + v, 0)).toBe(total);
      result.forEach((value, i) => {
        const exact = (total * (weights[i] ?? 0)) / weightSum;
        expect(value).toBeGreaterThanOrEqual(Math.floor(exact));
        expect(value).toBeLessThanOrEqual(Math.ceil(exact));
      });
    }
  });
});
