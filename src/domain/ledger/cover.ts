/**
 * 帳本封面：存三個代碼（樣式、配色、和柄），實際顏色與畫法在畫面層對照。
 * 代碼只能新增，不要改名或刪除，否則舊帳本的封面會讀不回來（讀不回來時會退回 coverFromId）。
 */
export const COVER_STYLES = [
  "band",
  "pattern",
  "spine",
  "tape",
  "photo",
] as const;
/** 隨機抽封面時的樣式；照片要使用者自己挑，不會抽到 */
const RANDOM_STYLES = ["band", "pattern", "spine", "tape"] as const;
export const COVER_PALETTES = [
  "shu",
  "ai",
  "matcha",
  "yamabuki",
  "sakura",
  "wakatake",
  "fuji",
  "kraft",
] as const;
export const COVER_PATTERNS = [
  "dots",
  "stripes",
  "checker",
  "waves",
  "grid",
] as const;

export type CoverStyle = (typeof COVER_STYLES)[number];
export type CoverPalette = (typeof COVER_PALETTES)[number];
export type CoverPattern = (typeof COVER_PATTERNS)[number];

export interface LedgerCover {
  readonly style: CoverStyle;
  /** 照片封面也用：書背的顏色，以及地球、地圖上這本帳本的顏色 */
  readonly palette: CoverPalette;
  /** 只有 pattern 樣式會畫出來，其他樣式也照樣存，換樣式時才有一致的和柄 */
  readonly pattern: CoverPattern;
  /**
   * 照片封面的檔名（存在 App 的封面照片資料夾），只有 photo 樣式才有。
   * 換成其他樣式時就不留，舊照片之後會被清掉。
   */
  readonly photo?: string;
}

/** 照片檔名只能是英數、底線、連字號加 .jpg，從備份讀回時才不會指到資料夾外面 */
const PHOTO_NAME = /^[A-Za-z0-9_-]{1,80}\.jpg$/;

export function isCoverPhotoName(value: unknown): value is string {
  return typeof value === "string" && PHOTO_NAME.test(value);
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/** 隨機封面；random 回傳 [0, 1)，測試時可以傳固定的序列 */
export function randomCover(random: () => number = Math.random): LedgerCover {
  return {
    style: pick(RANDOM_STYLES, random),
    palette: pick(COVER_PALETTES, random),
    pattern: pick(COVER_PATTERNS, random),
  };
}

/** 「換一個封面」：樣式和配色至少要換一個，避免看起來沒變 */
export function rerollCover(
  current: LedgerCover,
  random: () => number = Math.random,
): LedgerCover {
  for (let i = 0; i < 20; i++) {
    const next = randomCover(random);
    if (next.style !== current.style || next.palette !== current.palette) {
      return next;
    }
  }
  // 亂數一直抽到同一組（只會發生在固定序列的測試）時，直接換下一個配色
  const index = COVER_PALETTES.indexOf(current.palette);
  return {
    ...current,
    palette: COVER_PALETTES[(index + 1) % COVER_PALETTES.length],
  };
}

/**
 * 沒有存封面的帳本（建立於封面功能之前、或代碼已經讀不回來）依 id 給一個固定的封面，
 * 每次打開都一樣
 */
export function coverFromId(id: string): LedgerCover {
  return randomCover(seededRandom(hashString(id)));
}

/**
 * 從資料庫或備份讀回三個代碼與照片檔名；代碼任何一個不認得就回傳 null，交給 coverFromId。
 * photo 樣式沒有可用的檔名時改成同配色的書衣樣式，其他樣式不保留照片檔名。
 */
export function parseCover(
  style: unknown,
  palette: unknown,
  pattern: unknown,
  photo?: unknown,
): LedgerCover | null {
  if (
    !(COVER_STYLES as readonly unknown[]).includes(style) ||
    !(COVER_PALETTES as readonly unknown[]).includes(palette) ||
    !(COVER_PATTERNS as readonly unknown[]).includes(pattern)
  ) {
    return null;
  }
  const codes = {
    palette: palette as CoverPalette,
    pattern: pattern as CoverPattern,
  };
  if (style === "photo") {
    return isCoverPhotoName(photo)
      ? { style: "photo", ...codes, photo }
      : { style: "band", ...codes };
  }
  return { style: style as CoverStyle, ...codes };
}

/** FNV-1a */
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 */
function seededRandom(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
