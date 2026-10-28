import { useEffect, useState, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { fonts } from "./fonts";
import { useTheme } from "./theme";

export interface FabMenuItem {
  readonly key: string;
  readonly label: string;
  readonly icon: ReactNode;
  /** 圓形圖示的底色，省略時用卡片紙色 */
  readonly tint?: string;
  readonly onPress: () => void;
}

/**
 * 右下角的朱色印章按鈕，點開往上展開幾個動作（像把功能收在一顆按鈕裡）。
 * 展開時畫面蓋一層和紙色，點空白處收起；items 由上到下排列，最常用的放最後（最靠近按鈕）。
 */
export function FabMenu({
  items,
  label,
  bottom = 18,
}: {
  items: readonly FabMenuItem[];
  /** 給螢幕閱讀器的名稱，例如「帳本選單」 */
  label: string;
  bottom?: number;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  // 動畫值只建立一次；用 useState 而不是 useRef，render 時讀取才不會違反 refs 的規則
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  return (
    <>
      {open && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`關閉${label}`}
          onPress={() => setOpen(false)}
          style={[
            styles.backdrop,
            { backgroundColor: "rgba(243,237,225,0.8)" },
          ]}
        />
      )}
      <View style={[styles.stack, { bottom }]}>
        {items.map((item, index) => (
          <Animated.View
            key={item.key}
            accessibilityElementsHidden={!open}
            importantForAccessibility={open ? "auto" : "no-hide-descendants"}
            style={{
              opacity: progress,
              pointerEvents: open ? "auto" : "none",
              transform: [
                {
                  // 越上面的項目從越遠的地方滑出來
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16 + (items.length - 1 - index) * 14, 0],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
              ],
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => {
                setOpen(false);
                item.onPress();
              }}
              style={({ pressed }) => [
                styles.item,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.tag,
                  { backgroundColor: theme.surface },
                  { transform: [{ rotate: index % 2 ? "1.2deg" : "-1.5deg" }] },
                ]}
              >
                <Text style={[styles.tagText, { color: theme.text }]}>
                  {item.label}
                </Text>
              </View>
              <View
                style={[
                  styles.itemIcon,
                  { backgroundColor: item.tint ?? theme.surface },
                ]}
              >
                {item.icon}
              </View>
            </Pressable>
          </Animated.View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? `關閉${label}` : `打開${label}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((o) => !o)}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          {/* 印章內圈的虛線 */}
          <View
            style={[styles.fabRing, { borderColor: "rgba(251,248,241,0.55)" }]}
          />
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Svg width={26} height={26} viewBox="0 0 26 26">
              <Path
                d="M13 4.5 C13.3 9 12.8 17 13.1 21.5 M4.5 13.2 C9 12.8 17 13.4 21.5 12.9"
                fill="none"
                stroke={theme.onPrimary}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  stack: {
    position: "absolute",
    right: 18,
    alignItems: "flex-end",
    gap: 14,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 10,
    boxShadow:
      "0px 0px 0px 1px rgba(58,51,45,0.3), 0px 6px 14px rgba(58,51,45,0.12)",
  },
  tagText: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#3A332D",
    boxShadow: "2px 3px 0px rgba(58,51,45,0.18)",
  },
  fab: {
    width: 62,
    height: 62,
    borderTopLeftRadius: 31,
    borderTopRightRadius: 29,
    borderBottomRightRadius: 32,
    borderBottomLeftRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "3px 4px 0px rgba(58,51,45,0.25)",
  },
  fabRing: {
    position: "absolute",
    left: 5,
    top: 5,
    right: 5,
    bottom: 5,
    borderRadius: 26,
    borderWidth: 1.2,
    borderStyle: "dashed",
  },
});
