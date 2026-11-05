import { err, ok, type Result } from "../common/result";

/*
 * 使用者自己畫的小插圖，畫一次可以貼在很多篇日記上。
 * 插圖存的是筆畫（向量），不是圖片：檔案小，備份不用另外帶圖檔，放大也不會糊。
 */

/**
 * 墨水色代碼，實際顏色在畫面層。只能新增代碼，不要改名或刪除，否則舊插圖的顏色會跑掉。
 */
export const ILLUSTRATION_INKS = [
  "sumi",
  "shu",
  "sakura",
  "yamabuki",
  "moegi",
  "ai",
] as const;

/** pen 是一般的筆；wash 是水彩，畫面上用半透明的粗筆刷塗色 */
export const ILLUSTRATION_TOOLS = ["pen", "wash"] as const;

export type IllustrationInk = (typeof ILLUSTRATION_INKS)[number];
export type IllustrationTool = (typeof ILLUSTRATION_TOOLS)[number];

/** 畫布是 ILLUSTRATION_CANVAS × ILLUSTRATION_CANVAS 的正方形，點的座標用整數 */
export const ILLUSTRATION_CANVAS = 1000;
/** 筆寬（畫布單位）的範圍，超出的讀回時夾回範圍內 */
export const STROKE_WIDTH = { min: 1, max: 200 } as const;
/** 一張插圖最多幾筆、一筆最多幾個點；插圖會整份放進備份檔，不設上限檔案會越來越大 */
export const ILLUSTRATION_STROKE_LIMIT = 400;
export const STROKE_POINT_LIMIT = 1000;

/** 畫布上的一個點 [x, y] */
export type DrawPoint = readonly [x: number, y: number];

export interface IllustrationStroke {
  readonly tool: IllustrationTool;
  readonly ink: IllustrationInk;
  /** 筆寬，畫布單位 */
  readonly width: number;
  /** 依畫的順序，至少一個點（只點一下就是一個圓點） */
  readonly points: readonly DrawPoint[];
}

export interface IllustrationRecord {
  readonly id: string;
  /** 依畫的順序，後畫的蓋在上面 */
  readonly strokes: readonly IllustrationStroke[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 一篇日記最多貼幾張插圖 */
export const ENTRY_STICKER_LIMIT = 20;
/** 貼紙寬度（頁寬的比例）的範圍 */
export const STICKER_SIZE = { min: 0.08, max: 1 } as const;
/** 貼紙中心離頁首最遠幾個頁寬，避免讀到離譜的值把頁面撐得很長 */
const STICKER_MAX_Y = 40;

/**
 * 貼在日記頁上的一張插圖。位置都以日記頁的寬度為單位，換手機尺寸也貼在同一個地方：
 * x 是中心的橫向位置（0 是左邊、1 是右邊），y 是中心離頁首幾個頁寬，
 * size 是貼紙的寬度占頁寬的比例，rotation 是順時針旋轉的角度。
 */
export interface EntrySticker {
  readonly illustrationId: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly rotation: number;
}

export function isIllustrationInk(value: unknown): value is IllustrationInk {
  return (ILLUSTRATION_INKS as readonly unknown[]).includes(value);
}

export function isIllustrationTool(value: unknown): value is IllustrationTool {
  return (ILLUSTRATION_TOOLS as readonly unknown[]).includes(value);
}

/**
 * 從資料庫或備份讀回筆畫。結構不對（不是陣列、點不是數字、超過上限）就拒絕；
 * 只影響外觀的值放寬處理：認不得的墨水色用墨黑、認不得的工具當成筆，
 * 筆寬與座標夾回範圍內並取整數。
 */
export function parseStrokes(
  value: unknown,
): Result<IllustrationStroke[], string> {
  if (!Array.isArray(value)) return err("strokes must be an array");
  if (value.length > ILLUSTRATION_STROKE_LIMIT) {
    return err(`more than ${ILLUSTRATION_STROKE_LIMIT} strokes`);
  }
  const strokes: IllustrationStroke[] = [];
  for (const [index, item] of value.entries()) {
    const stroke = parseStroke(item);
    if (!stroke.ok) return err(`strokes[${index}]: ${stroke.error}`);
    strokes.push(stroke.value);
  }
  return ok(strokes);
}

function parseStroke(value: unknown): Result<IllustrationStroke, string> {
  if (!isObject(value)) return err("not an object");
  if (!isFiniteNumber(value.width)) return err("invalid width");
  const raw = value.points;
  if (!Array.isArray(raw) || raw.length === 0) {
    return err("points must be a non-empty array");
  }
  if (raw.length > STROKE_POINT_LIMIT) {
    return err(`more than ${STROKE_POINT_LIMIT} points`);
  }
  const points: DrawPoint[] = [];
  for (const point of raw) {
    if (
      !Array.isArray(point) ||
      point.length !== 2 ||
      !isFiniteNumber(point[0]) ||
      !isFiniteNumber(point[1])
    ) {
      return err("invalid point");
    }
    points.push([toCanvas(point[0]), toCanvas(point[1])]);
  }
  return ok({
    tool: isIllustrationTool(value.tool) ? value.tool : "pen",
    ink: isIllustrationInk(value.ink) ? value.ink : "sumi",
    width: clamp(Math.round(value.width), STROKE_WIDTH.min, STROKE_WIDTH.max),
    points,
  });
}

/**
 * 從資料庫或備份讀回一張貼紙。插圖 id 不是字串或數值不是有限數字就拒絕；
 * 位置、大小夾回範圍內，角度換成 -180～180 度。
 */
export function parseSticker(value: unknown): Result<EntrySticker, string> {
  if (!isObject(value)) return err("not an object");
  if (typeof value.illustrationId !== "string") {
    return err("invalid illustrationId");
  }
  for (const key of ["x", "y", "size", "rotation"] as const) {
    if (!isFiniteNumber(value[key])) return err(`invalid ${key}`);
  }
  return ok({
    illustrationId: value.illustrationId,
    x: clamp(value.x as number, 0, 1),
    y: clamp(value.y as number, 0, STICKER_MAX_Y),
    size: clamp(value.size as number, STICKER_SIZE.min, STICKER_SIZE.max),
    rotation: normalizeAngle(value.rotation as number),
  });
}

/** 換成 (-180, 180] 度 */
export function normalizeAngle(degrees: number): number {
  const turned = ((degrees % 360) + 360) % 360;
  return turned > 180 ? turned - 360 : turned;
}

function toCanvas(value: number): number {
  return clamp(Math.round(value), 0, ILLUSTRATION_CANVAS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
