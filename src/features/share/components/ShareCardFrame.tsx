import type { ComponentRef, ReactNode, Ref } from "react";
import { StyleSheet, Text, View } from "react-native";

import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { PaperBackground } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { SHARE_CARD_WIDTH } from "../services/shareFormat";

/** 要存成圖片的那個 View */
export type ShareCardView = ComponentRef<typeof View>;

/** 拍立得的相紙色 */
export const POLAROID = "#FFFDF8";
export const POLAROID_SHADOW =
  "0px 0px 0px 0.8px rgba(58,51,45,0.16), 2px 6px 14px rgba(58,51,45,0.2)";
const FOOTER_INK = "#6E645A";

/**
 * 分享卡的外框：方眼和紙底，頁尾左邊是一小段紙膠帶色和名稱、右邊是日期；
 * 沒有日期時（限動）名稱置中，留給 IG 的回覆列；沒有名稱時不放頁尾。
 * ref 指到要存成圖片的 View。
 */
export function ShareCardFrame({
  ref,
  height,
  swatch,
  footerName,
  footerDate,
  children,
}: {
  ref?: Ref<ShareCardView>;
  height: number;
  /** 頁尾那一小段紙膠帶的顏色 */
  swatch: string;
  /** 頁尾的名稱；null 時不放頁尾（例如回顧封面，名稱已經寫在中間） */
  footerName: string | null;
  footerDate: string | null;
  children: ReactNode;
}) {
  const theme = useTheme();
  const tape = (
    <View style={[styles.footerTape, { backgroundColor: swatch }]} />
  );
  return (
    <View
      ref={ref}
      // Android drops views that only lay out children; captureRef needs a real one
      collapsable={false}
      style={[styles.card, { height, backgroundColor: theme.background }]}
    >
      <PaperBackground />
      {children}
      {footerName === null ? null : footerDate !== null ? (
        <View style={styles.footer}>
          <View style={styles.footerName}>
            {tape}
            <Text numberOfLines={1} style={styles.footerText}>
              {footerName}
            </Text>
          </View>
          <Text style={styles.footerDate}>{footerDate}</Text>
        </View>
      ) : (
        <View style={[styles.footer, styles.storyFooter]}>
          {tape}
          <Text numberOfLines={1} style={[styles.footerText, styles.storyName]}>
            {footerName}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    overflow: "hidden",
  },
  footer: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  footerName: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerTape: {
    width: 14,
    height: 6,
    transform: [{ rotate: "-6deg" }],
  },
  footerText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: FOOTER_INK,
  },
  storyFooter: {
    bottom: 34,
    justifyContent: "center",
    gap: 6,
  },
  storyName: {
    flexShrink: 1,
    fontSize: 12,
  },
  footerDate: {
    fontFamily: fonts.accent,
    fontSize: 15,
    lineHeight: 18,
    paddingRight: accentOverhang(15),
    color: FOOTER_INK,
  },
});
