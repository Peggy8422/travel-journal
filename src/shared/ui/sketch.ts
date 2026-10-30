/*
 * 手繪線條的幾何計算（純函式，不依賴 React Native）。
 * 把圓角矩形、橢圓的外框拆成很多點，每個點依固定種子輕微偏移，再用二次曲線連起來，
 * 畫出來像鉛筆描的線。同一個種子每次結果都一樣，重繪時線條不會跳動。
 */

export interface Point {
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

export interface HandLoopOptions {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly seed?: number;
  /** 繞幾圈；超過 1 的部分是收筆時和起筆重疊的那一段 */
  readonly turns?: number;
  /** 半徑起伏的比例 */
  readonly wobble?: number;
}

/**
 * 用筆圈起來的一圈：從左上方起筆、順時針繞，半徑緩緩起伏，
 * 收筆時半徑比起筆大一點，兩端錯開而不是剛好接上。整圈都在 rx × ry 以內。
 */
export function handLoopPoints({
  cx,
  cy,
  rx,
  ry,
  seed = 1,
  turns = 1.15,
  wobble = 0.045,
}: HandLoopOptions): Point[] {
  if (rx <= 0 || ry <= 0) return [];
  const random = seededRandom(seed);
  const phase2 = random() * Math.PI * 2;
  const phase3 = random() * Math.PI * 2;
  const start = -Math.PI * (0.6 + random() * 0.12);
  const drift = 0.07 + random() * 0.04;
  const scale = 1 / (1 + wobble + drift / 2);
  const count = Math.max(28, Math.round((rx + ry) * turns));
  const points: Point[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const a = start + t * turns * Math.PI * 2;
    const k =
      (1 +
        wobble *
          (0.6 * Math.sin(2 * a + phase2) + 0.4 * Math.sin(3 * a + phase3)) +
        drift * (t - 0.5)) *
      scale;
    points.push({ x: cx + rx * k * Math.cos(a), y: cy + ry * k * Math.sin(a) });
  }
  return points;
}

/** 頭尾相接的一圈（不重複最後一點），給印章這類要整齊閉合的外框，配 pencilPasses 的 closed */
export function ringPoints({
  cx,
  cy,
  rx,
  ry,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}): Point[] {
  if (rx <= 0 || ry <= 0) return [];
  const count = Math.max(24, Math.round(rx + ry));
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/** 一道筆跡；幾道疊在一起才是一條線 */
export interface PencilPass {
  readonly d: string;
  readonly width: number;
  readonly opacity: number;
}

export interface PencilOptions {
  /** 整條線疊起來的寬度 */
  readonly width?: number;
  readonly seed?: number;
  /** 幾道筆跡並排 */
  readonly fibers?: number;
  /** points 是頭尾相接的一圈（例如 ringPoints）：不收細、不錯開，畫成閉合的線 */
  readonly closed?: boolean;
}

/**
 * 把一條路徑畫成手繪的線：幾道筆跡在線寬範圍內並排、各自輕微抖動，
 * 越接近起筆和收筆越往中間收，兩端像筆尖一樣變細。
 */
export function pencilPasses(
  points: readonly Point[],
  { width = 2, seed = 1, fibers = 3, closed = false }: PencilOptions = {},
): PencilPass[] {
  const n = points.length;
  if (n < 2) return [];
  const random = seededRandom(seed);
  const normals = pathNormals(points, closed);
  // 最後一點的角度可能因浮點誤差略大於 π，sin 變成極小的負數，開 0.4 次方會變 NaN
  const taper = points.map((_, i) =>
    closed ? 1 : Math.max(0, Math.sin((Math.PI * i) / (n - 1))) ** 0.4,
  );
  const result: PencilPass[] = [];
  for (let k = 0; k < fibers; k++) {
    const spread = fibers === 1 ? 0 : (k / (fibers - 1) - 0.5) * width * 0.45;
    const offset = points.map((p, i) => ({
      x: p.x + normals[i].x * spread * taper[i],
      y: p.y + normals[i].y * spread * taper[i],
    }));
    let d: string;
    if (closed) {
      d = closedPath(jitter(offset, width * 0.1, random), 0);
    } else {
      const shifted = jitterOpen(offset, width * 0.1, random);
      // 每道筆跡起筆晚一點、收筆早一點，兩端不會整齊地切齊
      const from = Math.floor(n * 0.04 * random());
      const to = n - Math.floor(n * 0.04 * random());
      d = openPath(shifted.slice(from, to));
    }
    result.push({
      d,
      width: width * (0.5 + random() * 0.15),
      opacity: 0.72 + random() * 0.2,
    });
  }
  return result;
}

/**
 * 給 Mask 挖掉筆跡用的一層小點，全部合成一條 path（點再多也只有一個 SVG 節點）。
 * ink 是那層要留下多少墨：0 是完全挖掉，越接近 1 越淡。
 */
export interface SpeckLayer {
  readonly d: string;
  readonly ink: number;
}

/** 鉛筆在紙紋上的顆粒：沿著路徑、在線寬範圍內撒很多小點；closed 會多撒最後一點回到起點那段 */
export function pencilGrain(
  points: readonly Point[],
  {
    width = 2,
    seed = 1,
    perPx = 3,
    closed = false,
  }: { width?: number; seed?: number; perPx?: number; closed?: boolean } = {},
): SpeckLayer[] {
  const n = points.length;
  if (n < 2) return [];
  const random = seededRandom(seed);
  const normals = pathNormals(points, closed);
  const layers: Dot[][] = [[], []];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const count = Math.round(Math.hypot(b.x - a.x, b.y - a.y) * perPx);
    for (let j = 0; j < count; j++) {
      const t = random();
      const across = (random() - 0.5) * width * 1.1;
      layers[random() < 0.55 ? 0 : 1].push({
        cx: a.x + (b.x - a.x) * t + normals[i].x * across,
        cy: a.y + (b.y - a.y) * t + normals[i].y * across,
        r: width * (0.07 + random() * random() * 0.16),
      });
    }
  }
  return [
    { d: dotsPath(layers[0]), ink: 0 },
    { d: dotsPath(layers[1]), ink: 0.45 },
  ];
}

/**
 * 印章沒沾滿墨：疏而大的小白點，加上幾塊淡掉的區域，撒滿 width × height。
 * density 是每 100 平方 px 的點數。
 */
export function stampWear({
  width,
  height,
  seed = 1,
  density = 1.6,
}: {
  width: number;
  height: number;
  seed?: number;
  density?: number;
}): SpeckLayer[] {
  const random = seededRandom(seed);
  const patches: Dot[] = [];
  for (let i = 0; i < 3; i++) {
    patches.push({
      cx: random() * width,
      cy: random() * height,
      r: Math.min(width, height) * (0.08 + random() * 0.1),
    });
  }
  const dots: Dot[] = [];
  const count = Math.round((width * height * density) / 100);
  for (let i = 0; i < count; i++) {
    dots.push({
      cx: random() * width,
      cy: random() * height,
      r: 0.25 + random() * random() * 0.9,
    });
  }
  // 淡掉的區域放前面，畫在下層，小白點才不會被蓋過
  return [
    { d: dotsPath(patches), ink: 0.6 },
    { d: dotsPath(dots), ink: 0.1 },
  ];
}

interface Dot {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** 每個點用兩段弧畫成一個圓，全部串在同一條 path */
function dotsPath(dots: readonly Dot[]): string {
  return dots
    .map(({ cx, cy, r }) => {
      const rr = r.toFixed(2);
      return `M${(cx - r).toFixed(1)} ${cy.toFixed(1)}a${rr} ${rr} 0 1 0 ${(r * 2).toFixed(2)} 0a${rr} ${rr} 0 1 0 ${(-r * 2).toFixed(2)} 0`;
    })
    .join("");
}

function pathNormals(points: readonly Point[], closed = false): Point[] {
  const n = points.length;
  return points.map((_, i) => {
    const a = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  });
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

/** 開放路徑的版本：兩端固定不動，中間的點才偏移，避免起筆收筆亂跳 */
function jitterOpen(points: Point[], wobble: number, random: () => number) {
  const raw = points.map(() => ({
    dx: (random() * 2 - 1) * wobble,
    dy: (random() * 2 - 1) * wobble,
  }));
  const last = raw.length - 1;
  return points.map((p, i) => {
    const prev = raw[Math.max(0, i - 1)];
    const next = raw[Math.min(last, i + 1)];
    return {
      x: p.x + (prev.dx + raw[i].dx * 2 + next.dx) / 4,
      y: p.y + (prev.dy + raw[i].dy * 2 + next.dy) / 4,
    };
  });
}

/** 經過相鄰點中點的二次曲線，從第一個點畫到最後一個點 */
function openPath(points: readonly Point[]): string {
  const n = points.length;
  if (n < 2) return "";
  const fmt = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  let d = `M${fmt(points[0])}`;
  for (let i = 1; i < n - 1; i++) {
    const next = points[i + 1];
    d += `Q${fmt(points[i])} ${fmt({ x: (points[i].x + next.x) / 2, y: (points[i].y + next.y) / 2 })}`;
  }
  return d + `L${fmt(points[n - 1])}`;
}
