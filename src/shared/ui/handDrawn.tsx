import { useId, useMemo, useState, type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Mask,
  Path,
  Pattern,
  Polygon,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import { fonts } from "./fonts";
import {
  handLoopPoints,
  pencilGrain,
  pencilPasses,
  ringPoints,
  seedFromString,
  stampWear,
  wobblyEllipsePath,
  wobblyRectPath,
  type SpeckLayer,
} from "./sketch";
import { useTheme } from "./theme";

interface Size {
  readonly width: number;
  readonly height: number;
}

/** 量出自己的大小；尺寸沒變時不重設 state，避免多餘的重繪 */
function useLayoutSize() {
  const [size, setSize] = useState<Size | null>(null);
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev &&
      Math.abs(prev.width - width) < 0.5 &&
      Math.abs(prev.height - height) < 0.5
        ? prev
        : { width, height },
    );
  };
  return [size, onLayout] as const;
}

/** 每個元件掛載時固定一個種子，同一個框重繪時筆觸不變 */
function useSeed(): number {
  return seedFromString(useId());
}

/**
 * 鉛筆描的外框，蓋在父元件上（父元件要能讓子元件絕對定位，例如有背景色的 View）。
 * double 會再描一條淡一點、偏一點的線，用在需要強調的卡片。
 */
export function SketchFrame({
  radius = 12,
  color,
  strokeWidth = 1.3,
  wobble = 0.9,
  double = false,
}: {
  radius?: number;
  color?: string;
  strokeWidth?: number;
  wobble?: number;
  double?: boolean;
}) {
  const theme = useTheme();
  const seed = useSeed();
  const [size, onLayout] = useLayoutSize();
  const paths = useMemo(() => {
    if (!size) return null;
    const main = wobblyRectPath({ ...size, radius, wobble, seed, strokeWidth });
    const echo = double
      ? wobblyRectPath({
          ...size,
          radius,
          wobble: wobble * 1.5,
          seed: seed + 7,
          strokeWidth,
        })
      : null;
    return { main, echo };
  }, [size, radius, wobble, seed, strokeWidth, double]);

  return (
    <View style={styles.overlay} onLayout={onLayout}>
      {size && paths && (
        <Svg width={size.width} height={size.height}>
          <Path
            d={paths.main}
            fill="none"
            stroke={color ?? theme.pencil}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {paths.echo && (
            <Path
              d={paths.echo}
              fill="none"
              stroke={color ?? theme.pencil}
              strokeOpacity={0.4}
              strokeWidth={strokeWidth * 0.75}
              strokeLinecap="round"
            />
          )}
        </Svg>
      )}
    </View>
  );
}

/** 和紙的方眼點陣，鋪在畫面最底層，不會跟著內容捲動 */
export function PaperBackground() {
  return (
    <Svg style={styles.overlay} width="100%" height="100%">
      <Defs>
        <Pattern
          id="paperDots"
          patternUnits="userSpaceOnUse"
          width={20}
          height={20}
        >
          <Circle cx={10} cy={10} r={1} fill="rgba(110,90,70,0.16)" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#paperDots)" />
    </Svg>
  );
}

/**
 * 水彩暈染：兩層半透明、略微錯開的手繪橢圓疊在一起，邊緣會有深淺。
 * 只當底色用，上面的文字或圖示要另外放。
 */
export function WatercolorBlob({
  width,
  height,
  color,
  opacity = 0.42,
  style,
}: {
  width: number;
  height: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const seed = useSeed();
  const layers = useMemo(() => {
    const wobble = Math.min(width, height) * 0.08;
    const base = {
      cx: width / 2,
      cy: height / 2,
      rx: width / 2 - wobble,
      ry: height / 2 - wobble,
      wobble,
    };
    return [
      wobblyEllipsePath({ ...base, seed }),
      wobblyEllipsePath({
        ...base,
        cx: base.cx + wobble * 0.4,
        rx: base.rx - wobble * 0.6,
        seed: seed + 3,
      }),
    ];
  }, [width, height, seed]);

  return (
    <Svg width={width} height={height} style={[styles.noTouch, style]}>
      {layers.map((d, i) => (
        <Path key={i} d={d} fill={color ?? theme.wash} opacity={opacity} />
      ))}
    </Svg>
  );
}

/**
 * 水彩塗的長條：蓋滿父元件（父元件決定位置與大小），邊緣微微起伏，
 * 兩層顏料疊出深淺，邊緣再描一圈稍深的顏色（水彩乾掉時顏料積在邊上）。
 */
export function WashFill({
  color,
  radius = 5,
}: {
  color: string;
  radius?: number;
}) {
  const seed = useSeed();
  const [size, onLayout] = useLayoutSize();
  const paths = useMemo(() => {
    if (!size) return null;
    const wobble = Math.min(1.2, size.height * 0.1);
    const base = { ...size, radius, strokeWidth: 0 };
    return {
      main: wobblyRectPath({ ...base, wobble, seed }),
      bleed: wobblyRectPath({ ...base, wobble: wobble * 1.6, seed: seed + 5 }),
    };
  }, [size, radius, seed]);

  return (
    <View style={styles.overlay} onLayout={onLayout}>
      {size && paths && (
        <Svg width={size.width} height={size.height}>
          <Path d={paths.bleed} fill={color} opacity={0.35} />
          <Path
            d={paths.main}
            fill={color}
            fillOpacity={0.72}
            stroke={color}
            strokeOpacity={0.55}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </View>
  );
}

/**
 * 紙膠帶：半透明、兩端鋸齒、有細直紋。蓋在父元件上（絕對定位填滿），
 * 用在選取中的標籤底色、卡片角落的裝飾；tilt 是傾斜角度。
 */
export function WashiTape({
  color,
  tilt = 0,
  opacity = 0.88,
}: {
  color?: string;
  tilt?: number;
  opacity?: number;
}) {
  const theme = useTheme();
  const [size, onLayout] = useLayoutSize();
  const points = useMemo(() => {
    if (!size) return "";
    const { width: w, height: h } = size;
    // 左右兩端是撕開的鋸齒
    return [
      [w * 0.02, 0],
      [w * 0.98, 0],
      [w, h * 0.2],
      [w * 0.97, h * 0.4],
      [w, h * 0.6],
      [w * 0.97, h * 0.8],
      [w * 0.99, h],
      [w * 0.01, h],
      [w * 0.03, h * 0.8],
      [0, h * 0.6],
      [w * 0.03, h * 0.4],
      [0, h * 0.2],
    ]
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  }, [size]);

  return (
    <View
      style={[
        styles.overlay,
        { opacity, transform: [{ rotate: `${tilt}deg` }] },
      ]}
      onLayout={onLayout}
    >
      {size && (
        <Svg width={size.width} height={size.height}>
          <Defs>
            <Pattern
              id="washiStripes"
              patternUnits="userSpaceOnUse"
              width={9}
              height={size.height}
            >
              <Rect
                width={4}
                height={size.height}
                fill="rgba(255,255,255,0.38)"
              />
            </Pattern>
          </Defs>
          <Polygon points={points} fill={color ?? theme.wash} />
          <Polygon points={points} fill="url(#washiStripes)" />
        </Svg>
      )}
    </View>
  );
}

/**
 * 用 Mask 把小點從筆跡上挖掉（紙紋顆粒、印章缺墨），
 * 因為 react-native-svg 沒有實作 feTurbulence，顆粒要自己畫。
 */
function SpeckMask({
  id,
  width,
  height,
  layers,
}: {
  id: string;
  width: number;
  height: number;
  layers: readonly SpeckLayer[];
}) {
  return (
    <Mask
      id={id}
      maskUnits="userSpaceOnUse"
      x={0}
      y={0}
      width={width}
      height={height}
    >
      <Rect width={width} height={height} fill="white" />
      {layers.map((layer, i) => {
        const v = Math.round(layer.ink * 255);
        return <Path key={i} d={layer.d} fill={`rgb(${v},${v},${v})`} />;
      })}
    </Mask>
  );
}

/**
 * 用鉛筆圈起來的圓（例如月曆上圈選的日期），只有線不填色：
 * 從左上方起筆繞一圈多一點，兩端收細、錯開，筆跡上有紙紋顆粒。
 */
export function HandCircle({
  width,
  height,
  color,
  strokeWidth = 2.1,
}: {
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
}) {
  const theme = useTheme();
  const seed = useSeed();
  return (
    <Svg
      width={width}
      height={height}
      style={[styles.noTouch, { transform: [{ rotate: "-8deg" }] }]}
    >
      <PencilLoop
        width={width}
        height={height}
        strokeWidth={strokeWidth}
        color={color ?? theme.primary}
        seed={seed}
      />
    </Svg>
  );
}

/**
 * 鉛筆圈的筆跡本體，放在 Svg 裡面。圈選用的是頭尾錯開的一圈；
 * closed 是頭尾接好的正圓（印章外框）。grain 是每 px 撒幾個紙紋顆粒。
 */
function PencilLoop({
  width,
  height,
  strokeWidth,
  color,
  seed,
  closed = false,
  grain = 3,
}: {
  width: number;
  height: number;
  strokeWidth: number;
  color: string;
  seed: number;
  closed?: boolean;
  grain?: number;
}) {
  const stroke = useMemo(() => {
    const ellipse = {
      cx: width / 2,
      cy: height / 2,
      rx: width / 2 - strokeWidth,
      ry: height / 2 - strokeWidth,
    };
    const points = closed
      ? ringPoints(ellipse)
      : handLoopPoints({ ...ellipse, seed });
    return {
      passes: pencilPasses(points, {
        width: strokeWidth,
        seed: seed + 1,
        closed,
      }),
      grain: pencilGrain(points, {
        width: strokeWidth,
        seed: seed + 2,
        perPx: grain,
        closed,
      }),
    };
  }, [width, height, strokeWidth, seed, closed, grain]);
  return (
    <>
      <Defs>
        <SpeckMask
          id="pencilGrain"
          width={width}
          height={height}
          layers={stroke.grain}
        />
      </Defs>
      <G mask="url(#pencilGrain)">
        {stroke.passes.map((pass, i) => (
          <Path
            key={i}
            d={pass.d}
            fill="none"
            stroke={color}
            strokeOpacity={pass.opacity}
            strokeWidth={pass.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </G>
    </>
  );
}

/**
 * 蓋上去的圓形印章（例如「結清」）：外框是頭尾接好的粗鉛筆正圓，顆粒比圈選密，
 * 字有沒沾滿墨的淡區和白點。傾斜角度由外層決定。
 */
export function InkStamp({
  size,
  label,
  color,
  labelScale = 0.27,
}: {
  size: number;
  label: string;
  color: string;
  /** 字的大小相對印章直徑的比例；兩三個字用預設，單一個字可以放大 */
  labelScale?: number;
}) {
  const seed = useSeed();
  const wear = useMemo(
    () => stampWear({ width: size, height: size, seed: seed + 3, density: 3 }),
    [size, seed],
  );
  const fontSize = size * labelScale;
  return (
    <Svg width={size} height={size} style={styles.noTouch}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - 2}
        fill="rgba(251,247,238,0.35)"
      />
      <PencilLoop
        width={size}
        height={size}
        strokeWidth={2.4}
        grain={5}
        closed
        color={color}
        seed={seed}
      />
      <Defs>
        <SpeckMask id="stampWear" width={size} height={size} layers={wear} />
      </Defs>
      <G mask="url(#stampWear)">
        <SvgText
          x={size / 2}
          y={size / 2 + fontSize * 0.36}
          textAnchor="middle"
          fontFamily={fonts.bold}
          fontSize={fontSize}
          fill={color}
        >
          {label}
        </SvgText>
      </G>
    </Svg>
  );
}

/** 收據紙上下鋸齒的齒數與深度 */
const RECEIPT_TEETH = 24;
const RECEIPT_TOOTH = 7;

/**
 * 收據紙：上下兩邊是撕下來的鋸齒，底下墊一層往下偏的淡影子。
 * 紙和影子畫在 Svg 裡（量到大小後才畫），內容放在上面，style 用來設內距。
 */
export function ReceiptPaper({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [size, onLayout] = useLayoutSize();
  const points = useMemo(() => {
    if (!size) return "";
    const { width: w, height: h } = size;
    const edge: string[] = [];
    for (let i = 0; i <= RECEIPT_TEETH; i++) {
      edge.push(
        `${((i * w) / RECEIPT_TEETH).toFixed(1)},${i % 2 ? 0 : RECEIPT_TOOTH}`,
      );
    }
    for (let i = RECEIPT_TEETH; i >= 0; i--) {
      edge.push(
        `${((i * w) / RECEIPT_TEETH).toFixed(1)},${i % 2 ? h : h - RECEIPT_TOOTH}`,
      );
    }
    return edge.join(" ");
  }, [size]);
  return (
    <View style={style} onLayout={onLayout}>
      {size && (
        <Svg width={size.width} height={size.height + 6} style={styles.receipt}>
          <Polygon
            points={points}
            fill="rgba(58,51,45,0.1)"
            transform="translate(0, 5)"
          />
          <Polygon points={points} fill="#FFFDF8" />
        </Svg>
      )}
      {children}
    </View>
  );
}

/** 橫線筆記紙的行高與第一條線的位置 */
const RULE_GAP = 28;
const RULE_OFFSET = 12;

/**
 * 橫線筆記紙：藍色橫線、左邊一條朱色邊線，可以加三個活頁孔。
 * 內容會從邊線右邊開始（paddingLeft 由呼叫端的 style 決定，要留出邊線與孔的位置）。
 */
export function RuledPaper({
  children,
  style,
  marginLine = 32,
  holes = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 朱色邊線離左邊的距離 */
  marginLine?: number;
  holes?: boolean;
}) {
  return (
    <View style={[styles.ruled, style]}>
      <Svg width="100%" height="100%" style={styles.overlay}>
        <Defs>
          <Pattern
            id="rules"
            patternUnits="userSpaceOnUse"
            x={0}
            y={RULE_OFFSET}
            width={8}
            height={RULE_GAP}
          >
            <Rect
              y={RULE_GAP - 1}
              width={8}
              height={1}
              fill="rgba(60,90,134,0.16)"
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#rules)" />
        <Line
          x1={marginLine}
          y1={0}
          x2={marginLine}
          y2="100%"
          stroke="rgba(181,69,43,0.45)"
          strokeWidth={1.5}
        />
      </Svg>
      {holes && (
        <>
          <View style={[styles.hole, { top: 28 }]} />
          <View style={[styles.hole, { top: "50%" }]} />
          <View style={[styles.hole, { bottom: 28 }]} />
        </>
      )}
      <SketchFrame radius={10} strokeWidth={1.2} />
      {children}
    </View>
  );
}

/**
 * 一條橫的虛線，寬度隨父元件伸縮（分隔線、列表的列與列之間）。
 * React Native 的 borderStyle dashed 在 iOS 只有四邊同寬才有效，單邊虛線要用這個。
 * dotted 是圓點，否則是短線。
 */
export function DashedLine({
  color,
  opacity = 0.22,
  dotted = false,
}: {
  color?: string;
  opacity?: number;
  dotted?: boolean;
}) {
  const theme = useTheme();
  return (
    <Svg width="100%" height={2} style={styles.noTouch}>
      <Line
        x1={1}
        y1={1}
        x2="100%"
        y2={1}
        stroke={color ?? theme.text}
        strokeOpacity={opacity}
        strokeWidth={dotted ? 1.3 : 1.2}
        strokeDasharray={dotted ? "0.1 3.5" : "4 4"}
        strokeLinecap={dotted ? "round" : "butt"}
      />
    </Svg>
  );
}

/** 鉛筆畫的波浪線，寬度隨父元件伸縮（例如標題後面的分隔線） */
export function WavyLine({ color }: { color?: string }) {
  const theme = useTheme();
  const [size, onLayout] = useLayoutSize();
  const d = useMemo(() => {
    if (!size) return "";
    const wave = 34;
    let path = "M1 4";
    for (let x = 1; x + wave / 2 < size.width; x += wave / 2) {
      const up = Math.round(x / (wave / 2)) % 2 === 0;
      path += ` Q${(x + wave / 4).toFixed(1)} ${up ? 1 : 7} ${(x + wave / 2).toFixed(1)} 4`;
    }
    return path;
  }, [size]);
  return (
    <View style={styles.wavy} onLayout={onLayout}>
      {size && (
        <Svg width={size.width} height={8}>
          <Path
            d={d}
            fill="none"
            stroke={color ?? theme.text}
            strokeOpacity={0.32}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wavy: {
    flex: 1,
    minWidth: 20,
    height: 8,
    pointerEvents: "none",
  },
  ruled: {
    backgroundColor: "#FFFDF8",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 14,
    boxShadow:
      "0px 2px 0px rgba(58,51,45,0.08), 0px 10px 22px rgba(58,51,45,0.1)",
  },
  hole: {
    position: "absolute",
    left: 11,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F3EDE1",
    boxShadow: "inset 1px 1px 0px rgba(58,51,45,0.25)",
  },
  receipt: {
    position: "absolute",
    left: 0,
    top: 0,
    pointerEvents: "none",
  },
  overlay: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
  },
  noTouch: {
    pointerEvents: "none",
  },
});
