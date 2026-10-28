/*
 * 手繪線條的幾何計算（純函式，不依賴 React Native）。
 * 把圓角矩形、橢圓的外框拆成很多點，每個點依固定種子輕微偏移，再用二次曲線連起來，
 * 畫出來像鉛筆描的線。同一個種子每次結果都一樣，重繪時線條不會跳動。
 */

interface Point {
  readonly x: number;
  readonly y: number;
}

/** mulberry32：可重現的亂數，回傳 [0, 1) */
export function seededRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 把字串（例如 React 的 useId）轉成種子，讓每個元件有自己的筆觸（FNV-1a） */
export function seedFromString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface WobblyRectOptions {
  readonly width: number;
  readonly height: number;
  /** 圓角半徑，會限制在短邊的一半以內 */
  readonly radius?: number;
  /** 線條偏移的最大幅度（px） */
  readonly wobble?: number;
  readonly seed?: number;
  /** 線寬：外框會內縮線寬的一半加上偏移幅度，整條線都留在 width × height 內 */
  readonly strokeWidth?: number;
}

/** 手繪感的圓角矩形外框，回傳 SVG path；空間不夠時回傳空字串 */
export function wobblyRectPath({
  width,
  height,
  radius = 12,
  wobble = 0.9,
  seed = 1,
  strokeWidth = 1.3,
}: WobblyRectOptions): string {
  const inset = strokeWidth / 2 + wobble;
  const w = width - inset * 2;
  const h = height - inset * 2;
  if (w <= 0 || h <= 0) return "";
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  const outline = roundedRectOutline(inset, inset, w, h, r);
  return closedPath(jitter(outline, wobble, seededRandom(seed)), wobble);
}

export interface WobblyEllipseOptions {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly wobble?: number;
  readonly seed?: number;
}

/** 手繪感的橢圓，用在水彩暈染、印章；外框會在 rx/ry 再往外最多 wobble 的範圍內 */
export function wobblyEllipsePath({
  cx,
  cy,
  rx,
  ry,
  wobble = 1.5,
  seed = 1,
}: WobblyEllipseOptions): string {
  if (rx <= 0 || ry <= 0) return "";
  const segments = Math.max(16, Math.round((rx + ry) / 3));
  const points: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return closedPath(jitter(points, wobble, seededRandom(seed)), 0);
}

/** 沿圓角矩形外框取點：直線每 STEP px 一點，圓角各取幾個點 */
const STEP = 10;

function roundedRectOutline(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): Point[] {
  const points: Point[] = [];
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / STEP));
    for (let i = 0; i < n; i++) {
      points.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n });
    }
  };
  const corner = (cx: number, cy: number, from: number) => {
    if (r === 0) return;
    const n = Math.max(2, Math.ceil(r / 4));
    for (let i = 0; i < n; i++) {
      const a = from + ((Math.PI / 2) * i) / n;
      points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  };
  line(x + r, y, x + w - r, y);
  corner(x + w - r, y + r, -Math.PI / 2);
  line(x + w, y + r, x + w, y + h - r);
  corner(x + w - r, y + h - r, 0);
  line(x + w - r, y + h, x + r, y + h);
  corner(x + r, y + h - r, Math.PI / 2);
  line(x, y + h - r, x, y + r);
  corner(x + r, y + r, Math.PI);
  return points;
}

/**
 * 每個點加上 [-wobble, wobble] 的偏移，再和左右鄰點平均，
 * 讓線條是緩緩起伏而不是鋸齒（平均後的偏移仍在 ±wobble 內）
 */
function jitter(points: Point[], wobble: number, random: () => number) {
  const raw = points.map(() => ({
    dx: (random() * 2 - 1) * wobble,
    dy: (random() * 2 - 1) * wobble,
  }));
  const n = raw.length;
  return points.map((p, i) => {
    const prev = raw[(i - 1 + n) % n];
    const next = raw[(i + 1) % n];
    return {
      x: p.x + (prev.dx + raw[i].dx * 2 + next.dx) / 4,
      y: p.y + (prev.dy + raw[i].dy * 2 + next.dy) / 4,
    };
  });
}

/**
 * 經過相鄰點中點的二次曲線，繞一圈後多畫一小段：
 * 像鉛筆畫框時收尾和起筆稍微重疊，不是剛好接上。
 * overlap 是重疊那段往內偏的距離，0 代表剛好閉合。
 */
function closedPath(points: Point[], overlap: number): string {
  const n = points.length;
  const mid = (a: Point, b: Point) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const fmt = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const start = mid(points[n - 1], points[0]);
  let d = `M${fmt(start)}`;
  for (let i = 0; i < n; i++) {
    d += `Q${fmt(points[i])} ${fmt(mid(points[i], points[(i + 1) % n]))}`;
  }
  if (overlap > 0 && n > 2) {
    const tail = { x: points[1].x, y: points[1].y + overlap * 0.6 };
    d += `Q${fmt(points[0])} ${fmt(mid(points[0], tail))}`;
  }
  return d;
}
