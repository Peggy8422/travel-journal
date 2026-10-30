import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { DashedLine, PaperBackground } from "./handDrawn";
import { accentOverhang, fonts } from "./fonts";
import { spacing, useTheme } from "./theme";

/** 紙色小膠囊加左箭頭；label 寫回到哪裡（例如「帳本」或帳本名稱） */
export function BackButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`返回${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.back,
        { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
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
      >
        <Path d="M11.2 3.8 C9 6 7.2 7.7 5.6 9.1 C7.4 10.6 9.2 12.3 11.4 14.4" />
      </Svg>
      <Text numberOfLines={1} style={[styles.backText, { color: theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * 自己畫的頁首（導覽列要設 headerShown: false）：頂端留安全區域，
 * 返回鍵下面是 Caveat 小字與大標題，divider 會在下緣畫一條虛線。
 */
export function PageHeader({
  backLabel,
  onBack,
  kicker,
  title,
  divider = false,
}: {
  backLabel: string;
  onBack: () => void;
  kicker: string;
  title: string;
  divider?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <BackButton label={backLabel} onPress={onBack} />
      <View>
        <Text style={[styles.kicker, { color: theme.textMuted }]}>
          {kicker}
        </Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.text }]}
        >
          {title}
        </Text>
      </View>
      {divider && (
        <View style={styles.divider}>
          <DashedLine />
        </View>
      )}
    </View>
  );
}

/** 隱藏導覽列的畫面讀取失敗時用：只有返回鍵和一段說明，避免使用者卡在沒有返回鍵的畫面 */
export function PageMessage({
  backLabel,
  onBack,
  text,
}: {
  backLabel: string;
  onBack: () => void;
  text: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.message,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + spacing.sm,
        },
      ]}
    >
      <PaperBackground />
      <BackButton label={backLabel} onPress={onBack} />
      <Text style={[styles.messageText, { color: theme.textMuted }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    flex: 1,
    alignItems: "flex-start",
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  messageText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
  },
  header: {
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    minHeight: 44,
    paddingLeft: 8,
    paddingRight: 14,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 21,
    borderBottomLeftRadius: 19,
    boxShadow:
      "0px 0px 0px 1.3px rgba(58,51,45,0.55), 1px 2px 0px rgba(58,51,45,0.12)",
  },
  backText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  kicker: {
    fontFamily: fonts.accent,
    fontSize: 18,
    lineHeight: 20,
    paddingRight: accentOverhang(18),
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 25,
    lineHeight: 32,
  },
  divider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
