import type {
  CoverPalette,
  CoverPattern,
  CoverStyle,
  LedgerCover,
} from "../../../domain/ledger";

/**
 * 封面配色。base 是封面底色；deep 是書背與地圖標記，上面放紙色文字約 4.5:1 以上；
 * tint 是淡色（索引籤、清單圖示底）；dot 是和柄的花紋色。
 */
export const COVER_COLORS: Readonly<
  Record<
    CoverPalette,
    {
      readonly name: string;
      readonly base: string;
      readonly deep: string;
      readonly tint: string;
      readonly dot: string;
    }
  >
> = {
  shu: {
    name: "朱",
    base: "#D9785C",
    deep: "#A3452E",
    tint: "#F2D2C4",
    dot: "rgba(255,240,225,0.42)",
  },
  ai: {
    name: "藍",
    base: "#6683AA",
    deep: "#3C5A86",
    tint: "#D3DDEA",
    dot: "rgba(236,242,250,0.34)",
  },
  matcha: {
    name: "抹茶",
    base: "#9DB07A",
    deep: "#5A7040",
    tint: "#DFE6CD",
    dot: "rgba(250,250,235,0.4)",
  },
  yamabuki: {
    name: "山吹",
    base: "#E2B45A",
    deep: "#85621A",
    tint: "#F3E0B4",
    dot: "rgba(255,250,235,0.45)",
  },
  sakura: {
    name: "櫻",
    base: "#E6B1AC",
    deep: "#9A5450",
    tint: "#F5DEDA",
    dot: "rgba(255,255,255,0.45)",
  },
  wakatake: {
    name: "若竹",
    base: "#7FAFA1",
    deep: "#3F6E62",
    tint: "#D3E6E0",
    dot: "rgba(240,252,248,0.4)",
  },
  fuji: {
    name: "藤",
    base: "#A596C5",
    deep: "#66588A",
    tint: "#E0DAEE",
    dot: "rgba(250,245,255,0.4)",
  },
  kraft: {
    name: "牛皮",
    base: "#C9A77C",
    deep: "#7E5F3A",
    tint: "#EADCC6",
    dot: "rgba(90,60,30,0.16)",
  },
};

const STYLE_NAMES: Readonly<Record<CoverStyle, string>> = {
  band: "書衣＋鬆緊帶",
  pattern: "和柄",
  spine: "布書背",
  tape: "紙膠帶",
};

const PATTERN_NAMES: Readonly<Record<CoverPattern, string>> = {
  dots: "水玉",
  stripes: "斜紋",
  checker: "市松",
  waves: "青海波",
  grid: "方眼",
};

/** 例如「和柄（水玉）· 藍色」 */
export function describeCover(cover: LedgerCover): string {
  const style =
    cover.style === "pattern"
      ? `${STYLE_NAMES.pattern}（${PATTERN_NAMES[cover.pattern]}）`
      : STYLE_NAMES[cover.style];
  return `${style} · ${COVER_COLORS[cover.palette].name}色`;
}
