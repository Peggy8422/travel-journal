import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";

import { fonts } from "../../../shared/ui/fonts";
import { WornInk } from "../../../shared/ui/handDrawn";
import { stampStyle, type StampCode } from "./stamps";

const INK = { weather: "#3C5A86", mood: "#B5452B" } as const;
/** 還沒蓋下去的印章（寫日記時沒選的）只畫淡淡的鉛筆色 */
const UNINKED = "rgba(58,51,45,0.4)";

/**
 * 天氣與心情小印章：天氣是藍色圓章，心情是朱色方章，蓋上去的有缺墨。
 * 小尺寸（列表上）不寫字、只放圖案。
 */
export function JournalStamp({
  code,
  size,
  inked = true,
  showLabel = true,
  tilt = 0,
}: {
  code: StampCode;
  size: number;
  inked?: boolean;
  showLabel?: boolean;
  tilt?: number;
}) {
  const stamp = stampStyle(code);
  const color = inked ? INK[stamp.kind] : UNINKED;
  const border = size >= 40 ? 2 : 1.5;
  const inset = Math.max(2, Math.round(size * 0.06));
  const icon = Math.round(size * (showLabel ? 0.42 : 0.6));
  const font = Math.max(10, Math.round(size * 0.2));
  const gap = Math.max(1, Math.round(size * 0.04));
  // Icon and label sit together in the middle of the stamp
  const top = (size - icon - (showLabel ? gap + font : 0)) / 2;
  const half = border / 2;
  const outline =
    stamp.kind === "weather" ? (
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - half}
        fill={inked ? "rgba(251,248,241,0.5)" : "none"}
        stroke={color}
        strokeWidth={border}
      />
    ) : (
      <Rect
        x={half}
        y={half}
        width={size - border}
        height={size - border}
        rx={size * 0.22}
        fill={inked ? "rgba(251,248,241,0.5)" : "none"}
        stroke={color}
        strokeWidth={border}
      />
    );
  const ring =
    inked && size >= 40 ? (
      stamp.kind === "weather" ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - inset}
          fill="none"
          stroke={color}
          strokeOpacity={0.7}
          strokeWidth={1}
        />
      ) : (
        <Rect
          x={inset}
          y={inset}
          width={size - inset * 2}
          height={size - inset * 2}
          rx={size * 0.18}
          fill="none"
          stroke={color}
          strokeOpacity={0.7}
          strokeWidth={1}
        />
      )
    ) : null;
  const art = (
    <>
      {outline}
      {ring}
      <G
        transform={`translate(${(size - icon) / 2} ${top}) scale(${icon / 24})`}
      >
        <Path
          d={stamp.icon}
          fill="none"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      {showLabel && (
        <SvgText
          x={size / 2}
          y={top + icon + gap + font * 0.85}
          textAnchor="middle"
          fontFamily={fonts.bold}
          fontSize={font}
          fill={color}
        >
          {stamp.label}
        </SvgText>
      )}
    </>
  );
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${stamp.kind === "weather" ? "天氣" : "心情"}：${stamp.label}`}
      style={[
        styles.stamp,
        { width: size, height: size, transform: [{ rotate: `${tilt}deg` }] },
      ]}
    >
      <Svg width={size} height={size}>
        {inked ? (
          <WornInk width={size} height={size}>
            {art}
          </WornInk>
        ) : (
          art
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    pointerEvents: "none",
  },
});
