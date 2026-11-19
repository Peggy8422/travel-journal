import { Image } from "expo-image";
import type { Ref } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { JournalRecord } from "../../../domain/journal";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { WashiTape } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { coverPhotoUri } from "../../ledger/services/appCoverPhotos";
import {
  POLAROID,
  POLAROID_SHADOW,
  ShareCardFrame,
  type ShareCardView,
} from "../../share/components/ShareCardFrame";
import { shareCardSize } from "../../share/services/shareFormat";
import { entryHeading } from "../services/journalDates";
import { dottedDate } from "../services/shareEntry";
import {
  recapStatsLabel,
  tabWindowStart,
  type RecapDay,
  type RecapStats,
} from "../services/shareRecap";
import { JournalCover } from "./JournalCover";
import { JournalStamp } from "./JournalStamp";
import { TAPE_COLORS } from "./tapes";

/*
 * 整本手帳回顧的卡片（4:5）：封面是手帳的牛皮紙筆記本，之後每天一張，
 * 上面一排 Day 索引籤標出是第幾天。
 */

const POST_HEIGHT = shareCardSize("post").height;
/** 每天那張上面一次放幾個索引籤 */
const TAB_COUNT = 5;

/** 回顧封面：手帳封面、日期範圍、天數與篇數 */
export function RecapCoverCard({
  ref,
  journal,
  range,
  stats,
  onPhotoReady,
}: {
  ref?: Ref<ShareCardView>;
  journal: JournalRecord;
  /** 日記的日期範圍，例如「2025.11.21 – 11.24」 */
  range: string;
  stats: RecapStats;
  onPhotoReady?: (index: number) => void;
}) {
  const theme = useTheme();
  return (
    <ShareCardFrame
      ref={ref}
      height={POST_HEIGHT}
      swatch={TAPE_COLORS[journal.cover.tape].color}
      // The name and dates are already on the cover
      footerName={null}
      footerDate={null}
    >
      <View style={styles.coverBook}>
        <JournalCover
          cover={journal.cover}
          title={journal.name}
          caption="Travel Journal"
          width={252}
          tilt={-1.5}
          onPhotoLoad={() => onPhotoReady?.(0)}
        />
      </View>
      <View style={styles.coverMeta}>
        <Text style={[styles.coverRange, { color: theme.primary }]}>
          {range}
        </Text>
        <Text style={[styles.coverStats, { color: theme.textMuted }]}>
          {recapStatsLabel(stats)}
        </Text>
      </View>
    </ShareCardFrame>
  );
}

/** 回顧的每天一張：Day 索引籤、照片與印章、這天第一篇的標題與內文 */
export function RecapDayCard({
  ref,
  journal,
  days,
  index,
  onPhotoReady,
}: {
  ref?: Ref<ShareCardView>;
  journal: JournalRecord;
  days: readonly RecapDay[];
  index: number;
  onPhotoReady?: (index: number) => void;
}) {
  const theme = useTheme();
  const day = days[index]!;
  const { entry } = day;
  const tape = TAPE_COLORS[journal.cover.tape].color;
  const start = tabWindowStart(days.length, index, TAB_COUNT);
  const tabs = days.slice(start, start + TAB_COUNT);
  return (
    <ShareCardFrame
      ref={ref}
      height={POST_HEIGHT}
      swatch={tape}
      footerName={journal.name}
      footerDate={dottedDate(day.date)}
    >
      <View style={styles.day}>
        <View style={styles.tabs}>
          {tabs.map((tab) => {
            const on = tab.date === day.date;
            return (
              <View
                key={tab.date}
                style={[
                  styles.tab,
                  on
                    ? {
                        backgroundColor: tape,
                        boxShadow: `0px 0px 0px 1.3px ${theme.primary}`,
                      }
                    : { backgroundColor: theme.surface },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: on ? theme.text : theme.textMuted },
                  ]}
                >
                  Day {tab.dayNumber}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.dayArea}>
          {day.photo !== null ? (
            <View style={styles.dayPolaroid}>
              <Image
                source={{ uri: coverPhotoUri(day.photo) }}
                contentFit="cover"
                style={styles.dayImage}
                onLoad={() => onPhotoReady?.(0)}
                onError={() => onPhotoReady?.(0)}
                accessibilityIgnoresInvertColors
              />
            </View>
          ) : (
            entry.body !== "" && (
              // No photo that day: a slip of the diary text instead
              <View style={styles.dayNote}>
                <Text
                  numberOfLines={7}
                  style={[styles.dayNoteText, { color: theme.text }]}
                >
                  {entry.body}
                </Text>
                <View style={styles.dayNoteTape}>
                  <WashiTape color={tape} />
                </View>
              </View>
            )
          )}
          <View style={styles.dayStamps}>
            {entry.weather && (
              <JournalStamp code={entry.weather} size={42} tilt={-8} />
            )}
            {entry.mood && (
              <JournalStamp code={entry.mood} size={42} tilt={6} />
            )}
          </View>
        </View>

        <Text
          numberOfLines={2}
          style={[styles.dayTitle, { color: theme.text }]}
        >
          {entryHeading(entry)}
        </Text>
        {day.photo !== null && entry.body !== "" && (
          <Text
            numberOfLines={2}
            style={[styles.dayBody, { color: theme.text }]}
          >
            {entry.body}
          </Text>
        )}
      </View>
    </ShareCardFrame>
  );
}

const styles = StyleSheet.create({
  coverBook: {
    position: "absolute",
    left: 54,
    top: 28,
  },
  coverMeta: {
    position: "absolute",
    left: 22,
    right: 22,
    top: 382,
    alignItems: "center",
    gap: 4,
  },
  coverRange: {
    fontFamily: fonts.accent,
    fontSize: 21,
    lineHeight: 24,
    paddingRight: accentOverhang(21),
  },
  coverStats: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  day: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 22,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
  },
  tab: {
    flex: 1,
    maxWidth: 70,
    alignItems: "center",
    paddingTop: 5,
    paddingBottom: 4,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    boxShadow: "0px 0px 0px 1px rgba(58,51,45,0.2)",
  },
  tabText: {
    fontFamily: fonts.accent,
    fontSize: 16,
    lineHeight: 18,
    paddingRight: accentOverhang(16),
  },
  dayArea: {
    height: 228,
    marginTop: 18,
  },
  dayPolaroid: {
    position: "absolute",
    left: 6,
    top: 4,
    width: 292,
    padding: 8,
    paddingBottom: 24,
    backgroundColor: POLAROID,
    boxShadow: POLAROID_SHADOW,
    transform: [{ rotate: "1.5deg" }],
  },
  dayImage: {
    width: "100%",
    height: 186,
  },
  dayNote: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 12,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    backgroundColor: POLAROID,
    boxShadow: POLAROID_SHADOW,
    transform: [{ rotate: "1.2deg" }],
  },
  dayNoteText: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 24,
  },
  dayNoteTape: {
    position: "absolute",
    left: "50%",
    top: -9,
    width: 70,
    height: 18,
    marginLeft: -35,
    transform: [{ rotate: "-3deg" }],
  },
  dayStamps: {
    position: "absolute",
    right: -6,
    top: -12,
    flexDirection: "row",
  },
  dayTitle: {
    marginTop: 12,
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 28,
  },
  dayBody: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 22,
  },
});
