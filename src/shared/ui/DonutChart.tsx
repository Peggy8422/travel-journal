import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { computeDonutArcs, describeArc } from "./donutGeometry";

export interface DonutSegment {
  readonly key: string;
  readonly value: number;
  readonly color: string;
}

/** 段與段之間的空隙（px，量在環的中線上） */
const GAP_PX = 2;
/** 選取某一段時，其他段的透明度 */
const DIMMED_OPACITY = 0.3;
/** 選取的那一段往內長 4px、往外長 6px（設計稿的 66–98 → 62–104） */
const SELECTED_INNER = 4;
const SELECTED_OUTER = 6;

/**
 * 甜甜圈圖：只負責畫環，數字、名稱等文字由呼叫端放在中間（children）與圖例裡。
 * 段落依傳入順序從正上方順時針排列；點一段會呼叫 onSelect，再點一次傳 null。
 * 選取的那一段會變粗、其他段變淡。
 */
export function DonutChart({
  segments,
  size = 200,
  thickness = 28,
  selectedKey,
  onSelect,
  accessibilityLabel,
  children,
}: {
  segments: readonly DonutSegment[];
  size?: number;
  thickness?: number;
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  accessibilityLabel?: string;
  /** 顯示在中間鏤空處的內容 */
  children?: ReactNode;
}) {
  const center = size / 2;
  // 留 1px 邊界，避免環的外緣貼齊畫布時被反鋸齒裁掉；選取的段會再往外長，也要留位置
  const radius = (size - thickness) / 2 - 1 - SELECTED_OUTER;
  const arcs = computeDonutArcs(segments, GAP_PX / radius);
  const colorOf = (key: string) =>
    segments.find((s) => s.key === key)?.color ?? "transparent";
  const opacityOf = (key: string) =>
    selectedKey && selectedKey !== key ? DIMMED_OPACITY : 1;
  // A thicker stroke centred slightly further out grows the ring both ways
  const ringOf = (key: string) =>
    selectedKey === key
      ? {
          r: radius + (SELECTED_OUTER - SELECTED_INNER) / 2,
          width: thickness + SELECTED_INNER + SELECTED_OUTER,
        }
      : { r: radius, width: thickness };
  const press = (key: string) => () =>
    onSelect?.(selectedKey === key ? null : key);

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size}>
        {arcs.length === 1 ? (
          <Circle
            cx={center}
            cy={center}
            r={ringOf(arcs[0]!.key).r}
            stroke={colorOf(arcs[0]!.key)}
            strokeWidth={ringOf(arcs[0]!.key).width}
            fill="none"
            opacity={opacityOf(arcs[0]!.key)}
            onPress={press(arcs[0]!.key)}
          />
        ) : (
          arcs.map((arc) => (
            <Path
              key={arc.key}
              d={describeArc(
                center,
                center,
                ringOf(arc.key).r,
                arc.startAngle,
                arc.endAngle,
              )}
              stroke={colorOf(arc.key)}
              strokeWidth={ringOf(arc.key).width}
              strokeLinecap="butt"
              fill="none"
              opacity={opacityOf(arc.key)}
              onPress={press(arc.key)}
            />
          ))
        )}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
});
