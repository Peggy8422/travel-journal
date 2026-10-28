import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { fonts } from "./fonts";
import { PaperBackground, SketchFrame } from "./handDrawn";
import { spacing, useTheme } from "./theme";

/**
 * 可捲動的畫面容器，鍵盤展開時不會蓋住正在輸入的欄位：
 * - iOS：由 ScrollView 自動把內容區延伸到鍵盤上方，並把輸入中的欄位捲進畫面
 * - Android：狀態列透明時系統的 resize 不可靠，改由 KeyboardAvoidingView 把畫面高度扣掉鍵盤，
 *   再由 ScrollView 把輸入中的欄位捲進畫面。它依實際被遮住的高度計算，系統已縮小時不會重複扣
 * 鍵盤展開時點擊空白處不會吃掉按鈕的點擊；往下拖動會收起鍵盤。
 * iOS 26 起 Stack 的 header 是透明的（Liquid Glass），由 contentInsetAdjustmentBehavior 讓內容從 header 下方開始。
 * 底層鋪和紙的方眼點陣，內容在上面捲動。
 */
export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "android" ? "height" : undefined}
    >
      <PaperBackground />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.screen}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <SketchFrame radius={14} />
        {children}
      </View>
    </View>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Label({
  children,
  muted,
  color,
}: {
  children: ReactNode;
  muted?: boolean;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Text
      style={[
        styles.label,
        { color: color ?? (muted ? theme.textMuted : theme.text) },
      ]}
    >
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** danger：刪除這類無法輕易復原的操作 */
  variant?: "primary" | "secondary" | "danger";
}) {
  const theme = useTheme();
  const primary = variant === "primary";
  // 主要按鈕是朱色實心；次要與危險按鈕是紙色加鉛筆框，危險用深朱色的框和字
  const color = primary
    ? theme.onPrimary
    : variant === "danger"
      ? theme.negative
      : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary && styles.buttonRaised,
        {
          backgroundColor: primary ? theme.primary : theme.surface,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {!primary && (
        <SketchFrame
          radius={14}
          color={variant === "danger" ? theme.negative : theme.pencil}
        />
      )}
      <Text style={[styles.buttonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function TextField({
  label,
  ...props
}: TextInputProps & { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {label && <Label muted>{label}</Label>}
      <TextInput
        placeholderTextColor={theme.textMuted}
        {...props}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.pencil },
          props.style,
        ]}
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: theme.text, borderColor: theme.text }
          : { backgroundColor: "transparent", borderColor: theme.pencil },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected
            ? { color: theme.surface, fontFamily: fonts.bold }
            : { color: theme.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chipGroup}>{children}</View>;
}

export function ErrorText({ message }: { message: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <Text style={[styles.label, { color: theme.negative }]}>{message}</Text>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  screen: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  // 四個角半徑不同，加上鉛筆框，像手撕的紙片
  card: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 16,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    boxShadow:
      "0px 2px 0px rgba(58,51,45,0.07), 0px 8px 18px rgba(58,51,45,0.08)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: 36,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  button: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 17,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonRaised: {
    boxShadow: "2px 3px 0px rgba(58,51,45,0.22)",
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  field: {
    gap: spacing.xs,
  },
  // 只有底線，像寫在筆記本的橫線上
  input: {
    borderBottomWidth: 1.5,
    paddingHorizontal: 2,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 17,
    minHeight: 44,
  },
  chip: {
    borderWidth: 1.2,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 17,
    borderBottomLeftRadius: 16,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: "center",
  },
  chipText: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});

/** 只顯示一段說明文字的畫面，用於讀取失敗、找不到資料等情況 */
export function MessageScreen({ text }: { text: string }) {
  return (
    <Screen>
      <Label muted>{text}</Label>
    </Screen>
  );
}
