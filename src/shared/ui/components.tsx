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

import { spacing, useTheme } from "./theme";

/**
 * 可捲動的畫面容器，鍵盤展開時不會蓋住正在輸入的欄位：
 * - iOS：由 ScrollView 自動把內容區延伸到鍵盤上方，並把輸入中的欄位捲進畫面
 * - Android：狀態列透明時系統的 resize 不可靠，改由 KeyboardAvoidingView 把畫面高度扣掉鍵盤，
 *   再由 ScrollView 把輸入中的欄位捲進畫面。它依實際被遮住的高度計算，系統已縮小時不會重複扣
 * 鍵盤展開時點擊空白處不會吃掉按鈕的點擊；往下拖動會收起鍵盤。
 * iOS 26 起 Stack 的 header 是透明的（Liquid Glass），由 contentInsetAdjustmentBehavior 讓內容從 header 下方開始。
 */
export function Screen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "android" ? "height" : undefined}
    >
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
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
        {title}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
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
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? theme.primary : theme.chip,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          {
            color: primary
              ? theme.onPrimary
              : variant === "danger"
                ? theme.negative
                : theme.text,
          },
        ]}
      >
        {title}
      </Text>
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
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
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
        { backgroundColor: selected ? theme.primary : theme.chip },
      ]}
    >
      <Text style={{ color: selected ? theme.onPrimary : theme.text }}>
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
  return <Text style={{ color: theme.negative }}>{message}</Text>;
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
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: 36,
  },
  label: {
    fontSize: 15,
  },
  button: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  field: {
    gap: spacing.xs,
  },
  input: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    minHeight: 44,
  },
  chip: {
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
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
