import { useState } from "react";

import { shiftMonth } from "../../domain/ledger";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { accentOverhang, fonts } from "./fonts";
import { HandCircle } from "./handDrawn";
import { useTheme } from "./theme";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * 從下方滑出的年月選單：上面切換年份，下面 12 個月，點一個月就選定（由呼叫端關閉）。
 * value 是 YYYY-MM，選中的月份用朱筆圈起來（和書架的月份篩選一樣）。
 * 每次打開都從 value 的年份開始，所以呼叫端要在打開時才掛上、關閉時卸下。
 */
export function MonthPicker({
  title,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  value: string;
  onSelect: (month: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));

  return (
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="關閉選單"
        onPress={onClose}
        style={styles.backdrop}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.surface,
            paddingBottom: insets.bottom + 20,
          },
        ]}
      >
        <View style={styles.header}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.text }]}
          >
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            hitSlop={8}
            style={styles.cancel}
          >
            <Text style={[styles.cancelText, { color: theme.textMuted }]}>
              取消
            </Text>
          </Pressable>
        </View>

        <View style={styles.yearRow}>
          <StepButton
            direction="prev"
            label="前一年"
            onPress={() => setYear((y) => y - 1)}
          />
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.year, { color: theme.text }]}
          >
            {year} 年
          </Text>
          <StepButton
            direction="next"
            label="後一年"
            onPress={() => setYear((y) => y + 1)}
          />
        </View>

        <View style={styles.grid}>
          {MONTHS.map((month) => {
            const key = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
            const selected = key === value;
            return (
              <Pressable
                key={month}
                accessibilityRole="button"
                accessibilityLabel={`${year} 年 ${month} 月`}
                accessibilityState={{ selected }}
                onPress={() => onSelect(key)}
                style={({ pressed }) => [
                  styles.cell,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                {selected && (
                  <View style={styles.ring}>
                    <HandCircle width={50} height={50} />
                  </View>
                )}
                <Text style={[styles.number, { color: theme.text }]}>
                  {month}
                </Text>
                <Text style={[styles.unit, { color: theme.textMuted }]}>
                  月
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

/**
 * 年月設定的統一做法：左右箭頭一次移一個月，點中間的年月打開 MonthPicker 直接挑。
 * value 是 YYYY-MM；label 給螢幕閱讀器，例如「旅行月份」。
 */
export function MonthSwitcher({
  value,
  onChange,
  label,
  pickerTitle,
  disabled = false,
}: {
  value: string;
  onChange: (month: string) => void;
  label: string;
  pickerTitle: string;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const [picking, setPicking] = useState(false);
  const text = `${value.slice(0, 4)} 年 ${Number(value.slice(5, 7))} 月`;
  return (
    <View style={styles.switcher}>
      <StepButton
        direction="prev"
        label="上個月"
        disabled={disabled}
        onPress={() => onChange(shiftMonth(value, -1))}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${text}`}
        accessibilityHint="選擇年和月"
        disabled={disabled}
        onPress={() => setPicking(true)}
        style={({ pressed }) => [
          styles.switcherLabel,
          { opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[styles.switcherText, { color: theme.text }]}>{text}</Text>
        <Svg
          width={14}
          height={14}
          viewBox="0 0 18 18"
          fill="none"
          stroke={theme.textMuted}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M4.8 7l4.3 4.1 4.2-4.2" />
        </Svg>
      </Pressable>
      <StepButton
        direction="next"
        label="下個月"
        disabled={disabled}
        onPress={() => onChange(shiftMonth(value, 1))}
      />
      {picking && (
        <MonthPicker
          title={pickerTitle}
          value={value}
          onClose={() => setPicking(false)}
          onSelect={(month) => {
            setPicking(false);
            if (month !== value) onChange(month);
          }}
        />
      )}
    </View>
  );
}

/** 左右箭頭的小圓鈕（切換上一個／下一個月份、年份） */
export function StepButton({
  direction,
  label,
  disabled = false,
  onPress,
}: {
  direction: "prev" | "next";
  /** 給螢幕閱讀器的名稱，例如「上個月」 */
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.step,
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      <Svg
        width={18}
        height={18}
        viewBox="0 0 18 18"
        fill="none"
        stroke={theme.text}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          direction === "next" ? { transform: [{ scaleX: -1 }] } : undefined
        }
      >
        <Path d="M11.2 3.8 C9 6 7.2 7.7 5.6 9.1 C7.4 10.6 9.2 12.3 11.4 14.4" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(58,51,45,0.3)",
  },
  sheet: {
    gap: 14,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 22,
    boxShadow: "0px -4px 18px rgba(58,51,45,0.18)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  cancel: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cancelText: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  yearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  year: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.bold,
    fontSize: 19,
  },
  switcher: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switcherLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 44,
  },
  switcherText: {
    fontFamily: fonts.bold,
    fontSize: 19,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "25%",
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    top: 7,
  },
  number: {
    fontFamily: fonts.accent,
    fontSize: 24,
    lineHeight: 26,
    paddingRight: accentOverhang(24),
  },
  unit: {
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  step: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFDF8",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 23,
    borderBottomLeftRadius: 21,
    boxShadow: "0px 0px 0px 1.3px rgba(58,51,45,0.6)",
  },
});
