import { Image } from "expo-image";
import type { ComponentRef, ReactNode, Ref } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { JournalTape } from "../../../domain/journal";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { PaperBackground, WashiTape } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { coverPhotoUri } from "../../ledger/services/appCoverPhotos";
import type { EntryDetail } from "../services/entryCommands";
import { entryHeading, weekdayOf } from "../services/journalDates";
import {
  dottedDate,
  photoCaption,
  type SharePage,
} from "../services/shareEntry";
import { PlacePinIcon } from "./EntryPlaces";
import { JournalStamp } from "./JournalStamp";
import { TAPE_COLORS } from "./tapes";

/*
 * 分享到 IG 的卡片（設計稿的「分享卡」）。卡片一律用 360×450 的版面畫，
 * 存成圖片時放大成 1080×1350，所以這裡的尺寸都是固定值，不跟著螢幕寬度變。
 */

/** 卡片版面的寬高（4:5） */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 450;
/** 存成圖片的像素 */
export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1350;

/** 要存成圖片的那個 View */
export type ShareCardView = ComponentRef<typeof View>;

const POLAROID = "#FFFDF8";
const FOOTER_INK = "#6E645A";

/**
 * 一頁分享卡。ref 指到要存成圖片的那個 View。
 * onReady 在卡片上的照片載入完（或載入失敗）時呼叫，載入完才存得到照片。
 */
export function ShareCard({
  ref,
  detail,
  page,
  onReady,
}: {
  ref?: Ref<ShareCardView>;
  detail: EntryDetail;
  page: SharePage;
  onReady?: () => void;
}) {
  const { journal, entry } = detail;
  return (
    <CardFrame
      ref={ref}
      tape={journal.cover.tape}
      footerName={journal.name}
      footerDate={dottedDate(entry.date)}
    >
      {page.kind === "cover" ? (
        <CoverPage detail={detail} onReady={onReady} />
      ) : (
        <PhotoPage
          detail={detail}
          photo={page.photo}
          index={page.index}
          onReady={onReady}
        />
      )}
    </CardFrame>
  );
}

/** 方眼和紙底，頁尾寫手帳名稱和日期 */
function CardFrame({
  ref,
  tape,
  footerName,
  footerDate,
  children,
}: {
  ref?: Ref<ShareCardView>;
  tape: JournalTape;
  footerName: string;
  footerDate: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      ref={ref}
      // Android drops views that only lay out children; captureRef needs a real one
      collapsable={false}
      style={[styles.card, { backgroundColor: theme.background }]}
    >
      <PaperBackground />
      {children}
      <View style={styles.footer}>
        <View style={styles.footerName}>
          <View
            style={[
              styles.footerTape,
              { backgroundColor: TAPE_COLORS[tape].color },
            ]}
          />
          <Text numberOfLines={1} style={styles.footerText}>
            {footerName}
          </Text>
        </View>
        <Text style={styles.footerDate}>{footerDate}</Text>
      </View>
    </View>
  );
}

/** ① 封面：Day、日期、印章、第一張照片、標題與去過的地方 */
function CoverPage({
  detail,
  onReady,
}: {
  detail: EntryDetail;
  onReady?: () => void;
}) {
  const theme = useTheme();
  const { journal, entry, dayNumber } = detail;
  const photo = entry.photos[0];
  const places = entry.places.map((place) => place.name).join("、");
  return (
    <View style={styles.cover}>
      <View style={styles.coverHead}>
        <View style={styles.coverDate}>
          <Text style={[styles.dayN, { color: theme.primary }]}>
            Day {dayNumber}
          </Text>
          <Text style={[styles.dateLabel, { color: theme.text }]}>
            {longDate(entry.date)}
          </Text>
        </View>
        <View style={styles.stamps}>
          {entry.weather && (
            <JournalStamp code={entry.weather} size={50} tilt={-8} />
          )}
          {entry.mood && <JournalStamp code={entry.mood} size={50} tilt={6} />}
        </View>
      </View>

      {photo !== undefined ? (
        <View style={styles.coverPhotoArea}>
          <View style={styles.coverPolaroid}>
            <Image
              source={{ uri: coverPhotoUri(photo) }}
              contentFit="cover"
              style={styles.coverImage}
              onLoad={onReady}
              onError={onReady}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.coverTape}>
              <WashiTape color={TAPE_COLORS[journal.cover.tape].color} />
            </View>
          </View>
        </View>
      ) : entry.body !== "" ? (
        // No photo: a slip of the diary text takes the photo's place
        <View style={styles.coverPhotoArea}>
          <View style={styles.coverNote}>
            <Text
              numberOfLines={7}
              style={[styles.coverNoteText, { color: theme.text }]}
            >
              {entry.body}
            </Text>
            <View style={styles.coverTape}>
              <WashiTape color={TAPE_COLORS[journal.cover.tape].color} />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.coverSpacer} />
      )}

      <Text
        numberOfLines={2}
        style={[styles.coverTitle, { color: theme.text }]}
      >
        {entryHeading(entry)}
      </Text>
      {places !== "" && (
        <View style={styles.coverPlaces}>
          <PlacePinIcon size={15} filled />
          <Text
            numberOfLines={1}
            style={[styles.coverPlacesText, { color: theme.textMuted }]}
          >
            {places}
          </Text>
        </View>
      )}
    </View>
  );
}

/** ② 照片頁：一張照片一頁，拍立得框對角貼兩條紙膠帶 */
function PhotoPage({
  detail,
  photo,
  index,
  onReady,
}: {
  detail: EntryDetail;
  photo: string;
  index: number;
  onReady?: () => void;
}) {
  const theme = useTheme();
  const { journal, entry, dayNumber } = detail;
  const tape = journal.cover.tape;
  // The second strip contrasts with the journal's own tape
  const other = tape === "yamabuki" ? "sakura" : "yamabuki";
  return (
    <View
      style={[
        styles.photoPolaroid,
        // Alternate the tilt so a carousel does not look stamped out
        { transform: [{ rotate: index % 2 ? "-1.6deg" : "1.8deg" }] },
      ]}
    >
      <Image
        source={{ uri: coverPhotoUri(photo) }}
        contentFit="cover"
        style={styles.photoImage}
        onLoad={onReady}
        onError={onReady}
        accessibilityIgnoresInvertColors
      />
      <Text style={[styles.photoCaption, { color: theme.textMuted }]}>
        {photoCaption(dayNumber, entry.date)}
      </Text>
      <View style={[styles.cornerTape, styles.cornerTapeTop]}>
        <WashiTape color={TAPE_COLORS[tape].color} />
      </View>
      <View style={[styles.cornerTape, styles.cornerTapeBottom]}>
        <WashiTape color={TAPE_COLORS[other].color} />
      </View>
    </View>
  );
}

/** 「2025 年 11 月 22 日（六）」 */
function longDate(date: string): string {
  return `${date.slice(0, 4)} 年 ${Number(date.slice(5, 7))} 月 ${Number(date.slice(8, 10))} 日（${weekdayOf(date)}）`;
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
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
  footerDate: {
    fontFamily: fonts.accent,
    fontSize: 15,
    lineHeight: 18,
    paddingRight: accentOverhang(15),
    color: FOOTER_INK,
  },
  cover: {
    flex: 1,
    paddingTop: 22,
    paddingHorizontal: 22,
  },
  coverHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  coverDate: {
    gap: 3,
  },
  dayN: {
    fontFamily: fonts.accent,
    fontSize: 32,
    lineHeight: 34,
    paddingRight: accentOverhang(32),
  },
  dateLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  stamps: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: -2,
  },
  coverPhotoArea: {
    height: 222,
    marginTop: 14,
  },
  coverSpacer: {
    height: 24,
  },
  coverPolaroid: {
    position: "absolute",
    left: 22,
    top: 6,
    width: 272,
    padding: 8,
    paddingBottom: 24,
    backgroundColor: POLAROID,
    boxShadow:
      "0px 0px 0px 0.8px rgba(58,51,45,0.16), 2px 6px 14px rgba(58,51,45,0.18)",
    transform: [{ rotate: "-2.5deg" }],
  },
  coverImage: {
    width: "100%",
    height: 178,
  },
  coverNote: {
    position: "absolute",
    left: 18,
    top: 10,
    right: 18,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    backgroundColor: POLAROID,
    boxShadow:
      "0px 0px 0px 0.8px rgba(58,51,45,0.16), 2px 6px 14px rgba(58,51,45,0.18)",
    transform: [{ rotate: "-1.5deg" }],
  },
  coverNoteText: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 24,
  },
  coverTape: {
    position: "absolute",
    left: "50%",
    top: -9,
    width: 70,
    height: 18,
    marginLeft: -35,
    transform: [{ rotate: "3deg" }],
  },
  coverTitle: {
    marginTop: 10,
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 29,
  },
  coverPlaces: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  coverPlacesText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  photoPolaroid: {
    position: "absolute",
    left: 34,
    top: 46,
    width: 292,
    padding: 10,
    paddingBottom: 40,
    backgroundColor: POLAROID,
    boxShadow:
      "0px 0px 0px 0.8px rgba(58,51,45,0.16), 3px 8px 18px rgba(58,51,45,0.2)",
  },
  photoImage: {
    width: "100%",
    aspectRatio: 1,
  },
  photoCaption: {
    position: "absolute",
    left: 14,
    bottom: 9,
    fontFamily: fonts.accent,
    fontSize: 19,
    lineHeight: 22,
    paddingRight: accentOverhang(19),
  },
  cornerTape: {
    position: "absolute",
    width: 64,
    height: 18,
    transform: [{ rotate: "-38deg" }],
  },
  cornerTapeTop: {
    left: -16,
    top: 6,
  },
  cornerTapeBottom: {
    right: -16,
    bottom: 14,
  },
});
