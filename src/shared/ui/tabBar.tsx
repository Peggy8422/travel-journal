import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ColorValue,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { fonts } from "./fonts";
import { WatercolorBlob } from "./handDrawn";
import { useTheme } from "./theme";

export type TabIconKind = "globe" | "notebook" | "person";

// 手繪的分頁圖示（26×26），故意不完全對稱
const ICON_PATHS: Record<TabIconKind, readonly string[]> = {
  globe: [
    "M13 3.6c5.4-.2 9.5 4 9.4 9.5-.1 5.3-4.3 9.3-9.6 9.2C7.5 22.2 3.5 18 3.6 12.8 3.7 7.6 7.8 3.7 13 3.6z",
    "M13.2 3.8c-2.6 2.4-3.9 5.6-3.9 9.2 0 3.6 1.4 6.8 3.8 9.1M13 3.8c2.5 2.5 3.8 5.7 3.8 9.3 0 3.4-1.3 6.6-3.6 9",
    "M4.4 9.6c5.6 1.4 11.6 1.3 17.3-.1M4.2 16.2c5.7 1.2 11.8 1.3 17.5 0",
  ],
  notebook: [
    "M6.2 3.8h12.4c1 0 1.7.8 1.7 1.7l-.2 15.2c0 1-.7 1.6-1.6 1.6H6.1z",
    "M9.2 3.9l-.1 18.3",
    "M16.6 3.9v18.2",
  ],
  person: [
    "M13 4.4c2.4-.1 4.1 1.8 4.1 4.2 0 2.5-1.9 4.3-4.2 4.2-2.3 0-4-1.9-4-4.3.1-2.3 1.8-4.1 4.1-4.1z",
    "M5 21.8c.8-4.3 4.1-6.9 8.1-6.9 4 .1 7 2.8 7.9 6.8",
  ],
};

/** 分頁圖示；選取中的分頁後面墊一塊山吹色水彩 */
export function TabIcon({
  kind,
  focused,
  color,
}: {
  kind: TabIconKind;
  focused: boolean;
  color: ColorValue;
}) {
  return (
    <View style={styles.icon}>
      {focused && <WatercolorBlob width={46} height={28} style={styles.blob} />}
      <Svg
        width={26}
        height={26}
        viewBox="0 0 26 26"
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICON_PATHS[kind].map((d) => (
          <Path key={d} d={d} />
        ))}
      </Svg>
    </View>
  );
}

/** 給 Tabs.Screen 的 tabBarIcon 用 */
export function tabBarIcon(kind: TabIconKind) {
  return function TabBarIcon({
    focused,
    color,
  }: {
    focused: boolean;
    color: ColorValue;
  }) {
    return <TabIcon kind={kind} focused={focused} color={color} />;
  };
}

/** 分頁標籤：選取中的用粗體 */
export function TabLabel({
  focused,
  color,
  children,
}: {
  focused: boolean;
  color: ColorValue;
  children: ReactNode;
}) {
  return (
    <Text
      style={[
        styles.label,
        { color, fontFamily: focused ? fonts.bold : fonts.regular },
      ]}
    >
      {children}
    </Text>
  );
}

/** 分頁列的底：紙色，上緣是一條鉛筆畫的波浪線 */
export function TabBarBackground() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const step = width / 6;
  // 三段起伏的波浪，從畫面外一點點開始畫，兩端不會露出線頭
  const d = `M-4 5 C ${step * 0.4} 2, ${step * 0.8} 8, ${step * 1.2} 5 S ${step * 2.4} 2, ${step * 3} 6 S ${step * 4.8} 3, ${width + 4} 5`;
  return (
    <View style={[styles.background, { backgroundColor: theme.surface }]}>
      <Svg width={width} height={10} style={styles.edge}>
        <Path
          d={d}
          fill="none"
          stroke={theme.text}
          strokeOpacity={0.4}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 46,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  blob: {
    position: "absolute",
    left: 0,
    top: 1,
  },
  label: {
    fontSize: 12.5,
  },
  background: {
    flex: 1,
  },
  edge: {
    position: "absolute",
    left: 0,
    top: -5,
  },
});
