import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Pattern,
  Polygon,
  Rect,
} from "react-native-svg";

import { COVER_PALETTES, type LedgerCover } from "../../../domain/ledger";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { InkStamp, SketchFrame, WashiTape } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { COVER_COLORS } from "./coverStyles";

const PAPER = "#FBF7EE";
const STAMP = "#B5452B";

/** 各樣式的名稱標籤位置，以封面寬高的比例表示 */
const LABEL_BOX = {
  band: { left: 0.16, right: 0.27, top: 0.15 },
  pattern: { left: 0.18, right: 0.1, top: 0.22 },
  spine: { left: 0.33, right: 0.09, top: 0.16 },
  tape: { left: 0.15, right: 0.12, top: 0.26 },
} as const;

/**
 * 筆記本封面：書背、樣式花紋、寫著帳本名稱的標籤，結清的帳本蓋一個印章。
 * 只是外觀，外層按鈕負責無障礙標籤，所以封面本身對螢幕閱讀器隱藏。
 */
export function NotebookCover({
  cover,
  title,
  caption,
  width,
  settled = false,
  fresh = false,
  tilt = 0,
}: {
  cover: LedgerCover;
  title: string;
  /** 標籤上的小字，例如旅行月份「2025.11」 */
  caption: string;
  width: number;
  settled?: boolean;
  /** 剛建立的帳本，右上角貼一段 NEW 紙膠帶 */
  fresh?: boolean;
  /** 傾斜角度，讓書架上的書不會排得太整齊 */
  tilt?: number;
}) {
  const theme = useTheme();
  const height = Math.round((width * 4) / 3);
  const colors = COVER_COLORS[cover.palette];
  const box = LABEL_BOX[cover.style];
  const fontSize = Math.max(12, Math.min(16, width / 11));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, transform: [{ rotate: `${tilt}deg` }] }}
    >
      {/* 封面右下露出的內頁 */}
      <View
        style={[
          styles.pages,
          {
            left: width * 0.04,
            top: height * 0.02,
            right: -width * 0.025,
            bottom: -height * 0.02,
          },
        ]}
      />
      <View style={[styles.body, { backgroundColor: colors.base }]}>
        <CoverArt cover={cover} width={width} height={height} />
        <View
          style={[
            styles.label,
            {
              left: width * box.left,
              right: width * box.right,
              top: height * box.top,
              paddingHorizontal: width * 0.06,
              paddingVertical: width * 0.06,
            },
            cover.style === "spine" && {
              borderWidth: 1.3,
              borderColor: colors.deep,
            },
            cover.style === "tape" && styles.labelDashed,
          ]}
        >
          <Text
            numberOfLines={2}
            style={[
              styles.title,
              { color: theme.text, fontSize, lineHeight: fontSize * 1.35 },
            ]}
          >
            {title}
          </Text>
          <Text style={[styles.caption, { color: theme.textMuted }]}>
            {caption}
          </Text>
        </View>
        {settled && (
          <View
            style={[
              styles.stamp,
              { right: width * 0.09, bottom: height * 0.07 },
            ]}
          >
            <InkStamp size={width * 0.3} label="結清" color={STAMP} />
          </View>
        )}
      </View>
      <SketchFrame radius={10} strokeWidth={1.4} />
      {fresh && (
        <View
          style={[styles.newTape, { right: -width * 0.05, top: height * 0.05 }]}
        >
          <WashiTape color="#E9C46A" opacity={0.95} />
          <Text style={[styles.newText, { color: theme.text }]}>NEW</Text>
        </View>
      )}
    </View>
  );
}

/** 封面底色、花紋、書背、鬆緊帶、紙膠帶，整張畫在一個 Svg 裡 */
function CoverArt({
  cover,
  width: w,
  height: h,
}: {
  cover: LedgerCover;
  width: number;
  height: number;
}) {
  const c = COVER_COLORS[cover.palette];
  const edge = (x: number) => (
    <Line
      x1={x}
      y1={0}
      x2={x}
      y2={h}
      stroke="rgba(58,51,45,0.2)"
      strokeWidth={1.5}
    />
  );

  if (cover.style === "band") {
    return (
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Rect width={w} height={h} fill={c.base} />
        <Rect width={w * 0.07} height={h} fill={c.deep} />
        {edge(w * 0.07)}
        {/* 車縫線 */}
        <Rect
          x={w * 0.12}
          y={h * 0.05}
          width={w * 0.83}
          height={h * 0.9}
          rx={4}
          fill="none"
          stroke="rgba(255,250,240,0.6)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        {/* 鬆緊帶 */}
        <Rect x={w * 0.805} width={w * 0.055} height={h} fill={c.deep} />
      </Svg>
    );
  }

  if (cover.style === "pattern") {
    return (
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <PatternTile kind={cover.pattern} base={c.base} dot={c.dot} />
        </Defs>
        <Rect width={w} height={h} fill={c.base} />
        <Rect width={w} height={h} fill="url(#coverTile)" />
        <Rect width={w * 0.08} height={h} fill={c.deep} />
        {edge(w * 0.08)}
      </Svg>
    );
  }

  if (cover.style === "spine") {
    return (
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="ruled"
            patternUnits="userSpaceOnUse"
            width={w}
            height={12}
          >
            <Line
              x1={0}
              y1={0.5}
              x2={w}
              y2={0.5}
              stroke="rgba(58,51,45,0.05)"
            />
          </Pattern>
          <Pattern
            id="cloth"
            patternUnits="userSpaceOnUse"
            width={5}
            height={h}
          >
            <Rect width={2} height={h} fill="rgba(255,255,255,0.16)" />
          </Pattern>
        </Defs>
        <Rect width={w} height={h} fill="#F7F2E8" />
        <Rect width={w} height={h} fill="url(#ruled)" />
        <Rect width={w * 0.24} height={h} fill={c.base} />
        <Rect width={w * 0.24} height={h} fill="url(#cloth)" />
        {edge(w * 0.24)}
      </Svg>
    );
  }

  // tape：牛皮紙封面，斜貼兩條紙膠帶（第二條用另一組配色）
  const other =
    COVER_COLORS[
      COVER_PALETTES[
        (COVER_PALETTES.indexOf(cover.palette) + 3) % COVER_PALETTES.length
      ]
    ];
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="kraft" patternUnits="userSpaceOnUse" width={7} height={7}>
          <Circle cx={3.5} cy={3.5} r={1} fill="rgba(120,90,50,0.14)" />
        </Pattern>
        <Pattern
          id="tapeStripes"
          patternUnits="userSpaceOnUse"
          width={9}
          height={h}
        >
          <Rect width={4} height={h} fill="rgba(255,255,255,0.35)" />
        </Pattern>
        <Pattern
          id="tapeDots"
          patternUnits="userSpaceOnUse"
          width={8}
          height={8}
        >
          <Circle cx={4} cy={4} r={1.6} fill="rgba(255,255,255,0.55)" />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill="#D6BE98" />
      <Rect width={w} height={h} fill="url(#kraft)" />
      <Rect width={w * 0.07} height={h} fill="#BFA57C" />
      {edge(w * 0.07)}
      <G rotation={-24} origin={`${w * 0.2}, ${h * 0.13}`} opacity={0.92}>
        <Polygon
          points={tapePoints(-w * 0.08, h * 0.08, w * 0.56, h * 0.11)}
          fill={c.base}
        />
        <Polygon
          points={tapePoints(-w * 0.08, h * 0.08, w * 0.56, h * 0.11)}
          fill="url(#tapeStripes)"
        />
      </G>
      <G rotation={-18} origin={`${w * 0.84}, ${h * 0.81}`} opacity={0.9}>
        <Polygon
          points={tapePoints(w * 0.58, h * 0.76, w * 0.52, h * 0.1)}
          fill={other.base}
        />
        <Polygon
          points={tapePoints(w * 0.58, h * 0.76, w * 0.52, h * 0.1)}
          fill="url(#tapeDots)"
        />
      </G>
    </Svg>
  );
}

/**
 * 帳本內頁頂端的色帶：和封面同一套底色與花紋，鋪滿父元件（不畫書背、鬆緊帶、紙膠帶）。
 * 紙膠帶樣式的封面是牛皮紙，所以色帶也是牛皮紙。
 */
export function CoverBand({ cover }: { cover: LedgerCover }) {
  const c = COVER_COLORS[cover.palette];
  const fill =
    cover.style === "pattern"
      ? "url(#coverTile)"
      : cover.style === "spine"
        ? "url(#cloth)"
        : cover.style === "tape"
          ? "url(#kraft)"
          : null;
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
      <Defs>
        {cover.style === "pattern" && (
          <PatternTile kind={cover.pattern} base={c.base} dot={c.dot} />
        )}
        <Pattern id="cloth" patternUnits="userSpaceOnUse" width={5} height={8}>
          <Rect width={2} height={8} fill="rgba(255,255,255,0.16)" />
        </Pattern>
        <Pattern id="kraft" patternUnits="userSpaceOnUse" width={7} height={7}>
          <Circle cx={3.5} cy={3.5} r={1} fill="rgba(120,90,50,0.14)" />
        </Pattern>
      </Defs>
      <Rect
        width="100%"
        height="100%"
        fill={cover.style === "tape" ? "#D6BE98" : c.base}
      />
      {fill && <Rect width="100%" height="100%" fill={fill} />}
    </Svg>
  );
}

/** 紙膠帶的外形：長方形，兩端是撕開的鋸齒 */
function tapePoints(x: number, y: number, w: number, h: number): string {
  return [
    [0.02, 0],
    [0.98, 0],
    [1, 0.25],
    [0.97, 0.5],
    [1, 0.75],
    [0.99, 1],
    [0.01, 1],
    [0.03, 0.75],
    [0, 0.5],
    [0.03, 0.25],
  ]
    .map(([px, py]) => `${(x + px * w).toFixed(1)},${(y + py * h).toFixed(1)}`)
    .join(" ");
}

/** 和柄的單位花紋，由 Rect 的 fill="url(#coverTile)" 重複鋪滿 */
function PatternTile({
  kind,
  base,
  dot,
}: {
  kind: LedgerCover["pattern"];
  base: string;
  dot: string;
}) {
  if (kind === "dots") {
    return (
      <Pattern
        id="coverTile"
        patternUnits="userSpaceOnUse"
        width={16}
        height={16}
      >
        <Circle cx={4} cy={4} r={2.2} fill={dot} />
        <Circle cx={12} cy={12} r={2.2} fill={dot} />
      </Pattern>
    );
  }
  if (kind === "stripes") {
    return (
      <Pattern
        id="coverTile"
        patternUnits="userSpaceOnUse"
        width={13}
        height={13}
        patternTransform="rotate(45)"
      >
        <Rect width={5} height={13} fill={dot} />
      </Pattern>
    );
  }
  if (kind === "checker") {
    return (
      <Pattern
        id="coverTile"
        patternUnits="userSpaceOnUse"
        width={22}
        height={22}
      >
        <Rect width={11} height={11} fill={dot} />
        <Rect x={11} y={11} width={11} height={11} fill={dot} />
      </Pattern>
    );
  }
  if (kind === "waves") {
    // 青海波：上一排的扇形先畫，下一排蓋在上面
    const scale = (cx: number, cy: number) => (
      <G key={`${cx}-${cy}`}>
        <Path
          d={`M${cx - 16} ${cy} A16 16 0 0 1 ${cx + 16} ${cy} Z`}
          fill={base}
        />
        {[14, 9.5, 5].map((r) => (
          <Path
            key={r}
            d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={dot}
            strokeWidth={2}
          />
        ))}
      </G>
    );
    return (
      <Pattern
        id="coverTile"
        patternUnits="userSpaceOnUse"
        width={32}
        height={16}
      >
        {scale(0, 8)}
        {scale(32, 8)}
        {scale(16, 16)}
      </Pattern>
    );
  }
  return (
    <Pattern
      id="coverTile"
      patternUnits="userSpaceOnUse"
      width={12}
      height={12}
    >
      <Path d="M0 0.5H12M0.5 0V12" stroke={dot} strokeWidth={1} />
    </Pattern>
  );
}

const styles = StyleSheet.create({
  pages: {
    position: "absolute",
    backgroundColor: PAPER,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(58,51,45,0.28)",
    boxShadow: "3px 5px 0px rgba(58,51,45,0.14)",
  },
  body: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 3,
  },
  label: {
    position: "absolute",
    gap: 4,
    backgroundColor: PAPER,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 7,
    boxShadow: "0px 1px 0px rgba(58,51,45,0.14)",
  },
  labelDashed: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(58,51,45,0.45)",
  },
  title: {
    fontFamily: fonts.bold,
  },
  caption: {
    fontFamily: fonts.accent,
    fontSize: 15,
    lineHeight: 16,
    paddingRight: accentOverhang(15),
  },
  stamp: {
    position: "absolute",
    transform: [{ rotate: "-14deg" }],
  },
  newTape: {
    position: "absolute",
    paddingTop: 2,
    paddingHorizontal: 10,
    paddingBottom: 1,
    transform: [{ rotate: "8deg" }],
  },
  newText: {
    fontFamily: fonts.accent,
    fontSize: 16,
    lineHeight: 19,
    paddingRight: accentOverhang(16),
  },
});
