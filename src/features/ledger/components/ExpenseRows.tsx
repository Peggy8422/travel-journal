import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts } from "../../../shared/ui/fonts";
import { DashedLine } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { CategoryIcon } from "./CategoryIcon";

/*
 * 依日期分組的消費列表（帳本內頁、個人記帳明細共用）的版面：
 * 日期標題下一條虛線，每筆消費之間是點線。
 */

/** 日期分組的標題：左邊日期，右邊當天合計 */
export function DayHeader({ label, total }: { label: string; total: string }) {
  const theme = useTheme();
  return (
    <>
      <View style={styles.dayHeader}>
        <Text
          accessibilityRole="header"
          style={[styles.dayLabel, { color: theme.text }]}
        >
          {label}
        </Text>
        <Text style={[styles.dayTotal, { color: theme.textMuted }]}>
          {total}
        </Text>
      </View>
      <DashedLine opacity={0.28} />
    </>
  );
}

/**
 * 一筆消費：分類圖示、名稱與小字說明、右邊金額。
 * secondary 是金額下的小字（換算後的金額、「我的負擔」），badge 放在最下面（已結清的小章）。
 * 沒有 onPress 時只顯示、不能點。
 */
export function ExpenseRowView({
  category,
  title,
  sub,
  note,
  amount,
  secondary,
  badge,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  category: string | null;
  title: string;
  sub: string;
  note: string | null;
  amount: string;
  secondary?: string;
  badge?: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const content = (
    <>
      <View style={styles.row}>
        <CategoryIcon category={category} />
        <View style={styles.main}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>{sub}</Text>
          {note !== null && (
            <Text style={[styles.note, { color: theme.textMuted }]}>
              備註：{note}
            </Text>
          )}
        </View>
        <View style={styles.side}>
          <Text style={[styles.amount, { color: theme.text }]}>{amount}</Text>
          {secondary !== undefined && (
            <Text style={[styles.secondary, { color: theme.textMuted }]}>
              {secondary}
            </Text>
          )}
          {badge}
        </View>
      </View>
      <DashedLine dotted />
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dayHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 16,
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  dayLabel: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
  },
  dayTotal: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minHeight: 58,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  main: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 20,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  side: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
  },
  secondary: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
});
