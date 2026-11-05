import { Image } from "expo-image";
import { useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import type { JournalCover as Cover } from "../../../domain/journal";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { SketchFrame, WashiTape } from "../../../shared/ui/handDrawn";
import { coverPhotoUri } from "../../ledger/services/appCoverPhotos";
import { KRAFT, TAPE_COLORS } from "./tapes";

const PAPER = "#FBF7EE";
const POLAROID = "#FFFDF8";

/**
 * 手帳封面：牛皮紙筆記本、左邊書背、右邊鬆緊帶，上方用紙膠帶貼一張拍立得照片
 * （沒有照片時改貼兩段紙膠帶），下方是寫著手帳名稱的標籤。
 * 只是外觀，外層按鈕負責無障礙標籤，所以封面本身對螢幕閱讀器隱藏。
 */
export function JournalCover({
  cover,
  title,
  caption,
  width,
  tilt = 0,
  photoUri,
}: {
  cover: Cover;
  title: string;
  /** 標籤上的小字，例如日記的日期範圍 */
  caption: string;
  width: number;
  tilt?: number;
  /** 剛挑的照片（還沒存檔）；省略時用 cover.photo 存好的照片 */
  photoUri?: string;
}) {
  const patternId = `kraft${useId().replace(/:/g, "")}`;
  const height = Math.round((width * 4) / 3);
  const tape = TAPE_COLORS[cover.tape].color;
  const source =
    photoUri ?? (cover.photo ? coverPhotoUri(cover.photo) : undefined);
  const titleSize = Math.max(11, Math.min(15, width / 11.5));
  const captionSize = Math.max(11, Math.min(15, width / 11.5));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, transform: [{ rotate: `${tilt}deg` }] }}
    >
      {/* 封面右下露出的內頁 */}
      <View style={styles.pages} />
      <View style={styles.body}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id={patternId}
              patternUnits="userSpaceOnUse"
              width={7}
              height={7}
            >
              <Circle cx={3.5} cy={3.5} r={1} fill={KRAFT.dot} />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </Svg>
        <View style={styles.spine} />
        <View style={styles.band} />

        {source ? (
          <View style={[styles.polaroid, { transform: [{ rotate: "-3deg" }] }]}>
            <Image
              source={{ uri: source }}
              style={styles.photo}
              contentFit="cover"
            />
            <View
              style={[
                styles.photoTape,
                { width: width * 0.28, height: width * 0.085 },
              ]}
            >
              <WashiTape color={tape} tilt={-6} />
            </View>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.tapeA,
                { height: height * 0.12, transform: [{ rotate: "-20deg" }] },
              ]}
            >
              <WashiTape color={tape} />
            </View>
            <View
              style={[
                styles.tapeB,
                { height: height * 0.09, transform: [{ rotate: "12deg" }] },
              ]}
            >
              <WashiTape color="#E9C46A" opacity={0.85} />
            </View>
          </>
        )}

        <View style={styles.label}>
          <Text
            numberOfLines={2}
            style={[
              styles.title,
              { fontSize: titleSize, lineHeight: titleSize * 1.3 },
            ]}
          >
            {title}
          </Text>
          {caption !== "" && (
            <Text
              numberOfLines={1}
              style={[
                styles.caption,
                {
                  fontSize: captionSize,
                  lineHeight: captionSize * 1.1,
                  paddingRight: accentOverhang(captionSize),
                },
              ]}
            >
              {caption}
            </Text>
          )}
        </View>
      </View>
      <SketchFrame radius={10} strokeWidth={1.4} />
    </View>
  );
}

const styles = StyleSheet.create({
  pages: {
    position: "absolute",
    left: "4%",
    top: "2%",
    right: "-2.5%",
    bottom: "-2%",
    backgroundColor: PAPER,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 3,
    boxShadow:
      "0px 0px 0px 1px rgba(58,51,45,0.28), 3px 5px 0px rgba(58,51,45,0.14)",
  },
  body: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    backgroundColor: KRAFT.paper,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 3,
  },
  spine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "8%",
    backgroundColor: KRAFT.spine,
    borderRightWidth: 1.5,
    borderRightColor: "rgba(58,51,45,0.18)",
  },
  band: {
    position: "absolute",
    right: "10%",
    top: 0,
    bottom: 0,
    width: "6%",
    backgroundColor: KRAFT.band,
  },
  polaroid: {
    position: "absolute",
    left: "19%",
    right: "25%",
    top: "9%",
    padding: "4%",
    paddingBottom: "10%",
    backgroundColor: POLAROID,
    boxShadow:
      "0px 1px 0px rgba(58,51,45,0.14), 1px 3px 6px rgba(58,51,45,0.18)",
  },
  photo: {
    width: "100%",
    aspectRatio: 1,
  },
  photoTape: {
    position: "absolute",
    top: -6,
    alignSelf: "center",
  },
  tapeA: {
    position: "absolute",
    left: "-6%",
    top: "14%",
    width: "70%",
  },
  tapeB: {
    position: "absolute",
    left: "30%",
    top: "30%",
    width: "62%",
  },
  label: {
    position: "absolute",
    left: "15%",
    right: "21%",
    bottom: "8%",
    gap: 3,
    paddingHorizontal: 7,
    paddingTop: 6,
    paddingBottom: 5,
    backgroundColor: "#FBF8F1",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 7,
    boxShadow: "0px 1px 0px rgba(58,51,45,0.14)",
  },
  title: {
    fontFamily: fonts.bold,
    color: "#3A332D",
  },
  caption: {
    fontFamily: fonts.accent,
    color: "#6E645A",
  },
});
