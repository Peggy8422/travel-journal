import { useState, type ReactNode } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";

import Svg, { Path } from "react-native-svg";

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
export function Screen({
  children,
  header,
  contentStyle,
}: {
  children: ReactNode;
  /** 固定在捲動區上方、不跟著捲動的頁首（例如隱藏導覽列時自己畫的 PageHeader） */
  header?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "android" ? "height" : undefined}
    >
      <PaperBackground />
      {header}
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.screen, contentStyle]}
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

/** 紙片卡：四角半徑不同、淡淡的影子，標題由內容自己放（不像 Section 放在卡片外） */
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }, style]}>
      {children}
    </View>
  );
}

/** 卡片裡的標題列：左邊粗體標題，右邊一行小字說明（可省略） */
export function CardTitle({
  title,
  hint,
  color,
}: {
  title: string;
  hint?: ReactNode;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.cardTitleRow}>
      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, { color: color ?? theme.text }]}
      >
        {title}
      </Text>
      {typeof hint === "string" ? (
        <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>
      ) : (
        hint
      )}
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

/**
 * 按鈕按下時先收起鍵盤再執行動作：Screen 的 keyboardShouldPersistTaps 是 "handled"，
 * 點按鈕不會自動收鍵盤，儲存後鍵盤會一直留著，錯誤訊息也可能被擋住。
 */
function dismissKeyboardThen(onPress: () => void) {
  return () => {
    Keyboard.dismiss();
    onPress();
  };
}

/** 整列寬的按鈕；按下時會先收起鍵盤（keepKeyboard 除外） */
export function Button({
  title,
  onPress,
  disabled,
  variant = "primary",
  keepKeyboard = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  /** danger：刪除這類無法輕易復原的操作 */
  variant?: "primary" | "secondary" | "danger";
  /** 按下後會冒出新的輸入欄位、要接著打字時設 true（例如「新增成員」），不收鍵盤 */
  keepKeyboard?: boolean;
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
      onPress={keepKeyboard ? onPress : dismissKeyboardThen(onPress)}
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

/**
 * 卡片裡的小按鈕（記錄還款、換一個封面、新增…）：outline 是紙色加細框，primary 是朱色實心。
 * icon 放在文字左邊；按下時會先收起鍵盤。
 */
export function SmallButton({
  title,
  onPress,
  disabled,
  variant = "outline",
  icon,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "outline" | "primary";
  icon?: ReactNode;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={dismissKeyboardThen(onPress)}
      style={({ pressed }) => [
        styles.smallButton,
        primary ? null : styles.smallButtonOutline,
        {
          backgroundColor: primary ? theme.primary : "#FFFDF8",
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon}
      <Text
        style={[
          styles.smallButtonText,
          primary
            ? { color: theme.onPrimary, fontFamily: fonts.bold }
            : { color: theme.text },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * 底線輸入框。有 maxLength 時，聚焦中或寫到八成以上會在右邊顯示「12 / 20」。
 * 舊資料（例如還原的備份）已經超過上限時，maxLength 放寬到目前長度，
 * 否則 Android 會把顯示的文字截掉；這時字數變成朱色，存檔時由指令擋下並說明上限。
 */
/**
 * 底線文字按鈕（手動修改匯率、刪除這筆消費…），不像按鈕那麼搶眼。
 * 按下時會先收起鍵盤；按下後要接著打字的（會冒出新輸入欄位）設 keepKeyboard。
 */
export function TextButton({
  title,
  onPress,
  color,
  disabled,
  keepKeyboard = false,
  align = "flex-start",
}: {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  keepKeyboard?: boolean;
  align?: "flex-start" | "center";
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={keepKeyboard ? onPress : dismissKeyboardThen(onPress)}
      style={({ pressed }) => [
        styles.textButton,
        { alignSelf: align, opacity: disabled ? 0.45 : pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.textButtonText, { color: color ?? theme.positive }]}>
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * 右下角固定的朱色新增鈕（「新增消費」「記一筆」），bottom 由呼叫端加上安全區域。
 * 按下時會先收起鍵盤。
 */
export function FloatingAddButton({
  title,
  onPress,
  bottom,
}: {
  title: string;
  onPress: () => void;
  bottom: number;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={dismissKeyboardThen(onPress)}
      style={({ pressed }) => [
        styles.floatingAdd,
        { bottom, backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Svg width={20} height={20} viewBox="0 0 26 26">
        <Path
          d="M13 4.5 C13.3 9 12.8 17 13.1 21.5 M4.5 13.2 C9 12.8 17 13.4 21.5 12.9"
          fill="none"
          stroke={theme.onPrimary}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={[styles.floatingAddText, { color: theme.onPrimary }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export function TextField({
  label,
  strongLabel = false,
  maxLength,
  onFocus,
  onBlur,
  ...props
}: TextInputProps & {
  label?: string;
  /** 標籤用粗體墨色（收據表單的欄位標題），預設是淡色 */
  strongLabel?: boolean;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const length = props.value?.length ?? 0;
  const limited = maxLength !== undefined;
  const over = limited && length > maxLength;
  const showCount = limited && (focused || length >= maxLength * 0.8);
  const input = (
    <TextInput
      placeholderTextColor={theme.textMuted}
      {...props}
      maxLength={limited ? Math.max(maxLength, length) : undefined}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        limited ? styles.inputInRow : { borderColor: theme.pencil },
        { color: theme.text },
        props.style,
      ]}
    />
  );
  return (
    <View style={styles.field}>
      {label &&
        (strongLabel ? (
          <Text style={[styles.strongLabel, { color: theme.text }]}>
            {label}
          </Text>
        ) : (
          <Label muted>{label}</Label>
        ))}
      {limited ? (
        // 底線畫在外層，字數才會在底線上方、輸入框的右邊
        <View style={[styles.inputRow, { borderColor: theme.pencil }]}>
          {input}
          {showCount && (
            <Text
              accessibilityLabel={`已輸入 ${length} 字，上限 ${maxLength} 字`}
              style={[
                styles.count,
                { color: over ? theme.negative : theme.textMuted },
              ]}
            >
              {length} / {maxLength}
            </Text>
          )}
        </View>
      ) : (
        input
      )}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  dot,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 標籤前面的小圓點顏色（例如分類色） */
  dot?: string;
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
      {dot && (
        <View
          style={[
            styles.chipDot,
            { backgroundColor: dot, borderColor: theme.surface },
          ]}
        />
      )}
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
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  smallButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 17,
    borderBottomRightRadius: 19,
    borderBottomLeftRadius: 18,
  },
  smallButtonOutline: {
    boxShadow: "0px 0px 0px 1.3px rgba(58,51,45,0.6)",
  },
  smallButtonText: {
    fontFamily: fonts.regular,
    fontSize: 14,
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
  floatingAdd: {
    position: "absolute",
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 54,
    paddingLeft: 16,
    paddingRight: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 27,
    borderBottomLeftRadius: 25,
    boxShadow: "3px 4px 0px rgba(58,51,45,0.25)",
  },
  floatingAddText: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  strongLabel: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  textButton: {
    minHeight: 36,
    justifyContent: "center",
  },
  textButtonText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    textDecorationLine: "underline",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    borderBottomWidth: 1.5,
  },
  inputInRow: {
    flex: 1,
    borderBottomWidth: 0,
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 12,
    paddingBottom: spacing.sm + 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.2,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 17,
    borderBottomLeftRadius: 16,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: "center",
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
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
