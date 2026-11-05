import {
  strokePath,
  type DrawPoint,
  type IllustrationStroke,
} from "../../../domain/journal";
import { seededRandom } from "../../../shared/ui/sketch";

/*
 * 插圖的鉛筆筆刷：一道淡淡的底色，加上兩道並排、輕微抖動的細筆跡，
 * 再用 Mask 挖掉沿著筆畫撒的小點當紙紋顆粒（react-native-svg 沒有濾鏡可用）。
 * 亂數種子取自這一筆的起點，同一筆每次畫出來都一樣；顆粒和抖動都是照順序從頭產生，
 * 手指還在畫、筆畫變長時前面的部分不會跳動。
 */

export interface PencilLine {
  readonly d: string;
  readonly width: number;
  readonly opacity: number;
}

/** Mask 用的一層小點，ink 是留下多少墨（0 是完全挖掉） */
export interface PencilSpecks {
  readonly d: string;
  readonly ink: number;
}

export interface PencilLook {
  readonly lines: readonly PencilLine[];
  readonly specks: readonly PencilSpecks[];
}

const BASE_OPACITY = 0.3;
const FIBERS = 2;
const FIBER_WIDTH = 0.6;
const FIBER_OPACITY = 0.55;
/** 筆跡抖動的幅度（筆寬的比例） */
const FIBER_JITTER = 0.18;
/** 每單位長度撒幾個顆粒，再除以筆寬（粗的筆顆粒也大，數量要少一點） */
const SPECKS_PER_LENGTH = 12;

const cache = new WeakMap<IllustrationStroke, PencilLook>();

export function pencilLook(stroke: IllustrationStroke): PencilLook {
  const cached = cache.get(stroke);
  if (cached) return cached;
  const { points, width } = stroke;
  const first = points[0] ?? [0, 0];
  const seed = first[0] * 31 + first[1] * 1009 + width;
  const normals = normalsOf(points);
  const lines: PencilLine[] = [
    { d: strokePath(points), width, opacity: BASE_OPACITY },
  ];
  for (let f = 0; f < FIBERS; f++) {
    // Each fibre has its own random stream so a growing stroke keeps its shape
    const random = seededRandom(seed + (f + 1) * 7919);
    const offset = (f / (FIBERS - 1) - 0.5) * width * 0.5;
    const shifted = points.map(([x, y], i): DrawPoint => {
      const across = offset + (random() - 0.5) * width * FIBER_JITTER;
      const [nx, ny] = normals[i]!;
      return [x + nx * across, y + ny * across];
    });
    lines.push({
      d: strokePath(shifted),
      width: width * FIBER_WIDTH,
      opacity: FIBER_OPACITY,
    });
  }
  const look = { lines, specks: specksOf(points, normals, width, seed) };
  cache.set(stroke, look);
  return look;
}

function specksOf(
  points: readonly DrawPoint[],
  normals: readonly DrawPoint[],
  width: number,
  seed: number,
): PencilSpecks[] {
  const random = seededRandom(seed);
  const layers: string[][] = [[], []];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i]!;
    const [bx, by] = points[i + 1]!;
    const [nx, ny] = normals[i]!;
    const count = Math.round(
      (Math.hypot(bx - ax, by - ay) * SPECKS_PER_LENGTH) / width,
    );
    for (let j = 0; j < count; j++) {
      const t = random();
      const across = (random() - 0.5) * width * 1.3;
      const layer = random() < 0.55 ? 0 : 1;
      const r = width * (0.04 + random() * random() * 0.09);
      layers[layer]!.push(
        dot(
          ax + (bx - ax) * t + nx * across,
          ay + (by - ay) * t + ny * across,
          r,
        ),
      );
    }
  }
  return [
    { d: layers[0]!.join(""), ink: 0 },
    { d: layers[1]!.join(""), ink: 0.45 },
  ];
}

/** 一個小圓：兩段弧，全部串成一條 path */
function dot(cx: number, cy: number, r: number): string {
  const rr = r.toFixed(2);
  return `M${(cx - r).toFixed(1)} ${cy.toFixed(1)}a${rr} ${rr} 0 1 0 ${(r * 2).toFixed(2)} 0a${rr} ${rr} 0 1 0 ${(-r * 2).toFixed(2)} 0`;
}

function normalsOf(points: readonly DrawPoint[]): DrawPoint[] {
  const n = points.length;
  return points.map((_, i) => {
    const [ax, ay] = points[Math.max(0, i - 1)]!;
    const [bx, by] = points[Math.min(n - 1, i + 1)]!;
    const length = Math.hypot(bx - ax, by - ay) || 1;
    return [-(by - ay) / length, (bx - ax) / length];
  });
}
