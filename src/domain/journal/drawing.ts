import type { DrawPoint, IllustrationStroke } from "./illustration";

/*
 * 畫插圖用的幾何計算，畫板與貼紙共用。座標都是畫布單位。
 */

/**
 * 一筆的 SVG 路徑：相鄰兩點的中點之間用二次曲線連起來，手指的鋸齒會變得圓順。
 * 只有一個點時畫一段極短的線，配合圓頭線帽就是一個圓點。
 */
export function strokePath(points: readonly DrawPoint[]): string {
  const [first, ...rest] = points;
  if (!first) return "";
  const start = `M${num(first[0])} ${num(first[1])}`;
  if (rest.length === 0) return `${start}l0.01 0`;
  const last = rest[rest.length - 1]!;
  let path = start;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    path += `Q${num(x)} ${num(y)} ${num((x + nx) / 2)} ${num((y + ny) / 2)}`;
  }
  return `${path}L${num(last[0])} ${num(last[1])}`;
}

export interface DrawBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * 所有筆畫占的範圍（含筆寬的一半），貼紙用它當 viewBox，只留有畫的地方。
 * 橡皮擦的筆畫不算；沒有筆畫時回傳 null。
 */
export function strokesBounds(
  strokes: readonly IllustrationStroke[],
): DrawBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    if (stroke.tool === "eraser") continue;
    const half = stroke.width / 2;
    for (const [x, y] of stroke.points) {
      minX = Math.min(minX, x - half);
      minY = Math.min(minY, y - half);
      maxX = Math.max(maxX, x + half);
      maxY = Math.max(maxY, y + half);
    }
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * 去掉和前一個保留的點距離不到 minDistance 的點（最後一點一定保留），
 * 手指停著不動時不會一直累積點，存起來也比較小。
 */
export function thinPoints(
  points: readonly DrawPoint[],
  minDistance: number,
): DrawPoint[] {
  const kept: DrawPoint[] = [];
  for (const [index, point] of points.entries()) {
    const previous = kept[kept.length - 1];
    const isLast = index === points.length - 1;
    if (!previous || isLast || distance(previous, point) >= minDistance) {
      kept.push(point);
    }
  }
  return kept;
}

function distance(a: DrawPoint, b: DrawPoint): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** 路徑裡的數字最多一位小數 */
function num(value: number): string {
  return String(Math.round(value * 10) / 10);
}
