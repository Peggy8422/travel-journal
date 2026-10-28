import { useId, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Defs, Path, Pattern, Rect } from "react-native-svg";

import { seedFromString, wobblyEllipsePath, wobblyRectPath } from "./sketch";
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

const styles = StyleSheet.create({
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
