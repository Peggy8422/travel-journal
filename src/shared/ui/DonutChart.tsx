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

/**
 * 甜甜圈圖：只負責畫環，數字、名稱等文字由呼叫端放在中間（children）與圖例裡。
 * 段落依傳入順序從正上方順時針排列；點一段會呼叫 onSelect，再點一次傳 null。
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
  // 留 1px 邊界，避免環的外緣貼齊畫布時被反鋸齒裁掉
  const radius = (size - thickness) / 2 - 1;
  const arcs = computeDonutArcs(segments, GAP_PX / radius);
  const colorOf = (key: string) =>
    segments.find((s) => s.key === key)?.color ?? "transparent";
  const opacityOf = (key: string) =>
    selectedKey && selectedKey !== key ? DIMMED_OPACITY : 1;
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
            r={radius}
            stroke={colorOf(arcs[0]!.key)}
            strokeWidth={thickness}
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
                radius,
                arc.startAngle,
                arc.endAngle,
              )}
              stroke={colorOf(arc.key)}
              strokeWidth={thickness}
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
