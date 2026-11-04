import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { PaperBackground, RuledPaper } from "../../../shared/ui/handDrawn";
import { BackButton, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { describeError } from "../../ledger/components/messages";
import { useEntry } from "../hooks/useJournalQueries";
import { entryHeading, monthDayLabel } from "../services/journalDates";
import { PhotoCollage, PhotoViewer } from "./EntryPhotos";
import { JournalStamp } from "./JournalStamp";
import { PencilIcon } from "./PencilIcon";
import { TAPE_COLORS } from "./tapes";

/**
 * 一篇日記（只能看）：橫線信紙上寫日期、印章、標題、照片與內容，右上角「編輯」才進表單。
 * 點照片全螢幕看，可以左右滑。
 * 導覽列隱藏，返回鍵自己畫。
 */
export function JournalEntryScreen({ entryId }: { entryId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useEntry(entryId);
  /** 全螢幕看的那張照片；沒在看時為 null */
  const [viewing, setViewing] = useState<number | null>(null);

  if (error) {
    return <PageMessage onBack={router.back} text="讀取日記失敗" />;
  }
  if (!data) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]} />
    );
  }
  if (!data.ok) {
    return (
      <PageMessage onBack={router.back} text={describeError(data.error)} />
    );
  }

  const { entry, journal, dayNumber } = data.value;
  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
        <BackButton onPress={router.back} />
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/journal/[id]/entry/[entryId]/edit",
              params: { id: journal.id, entryId: entry.id },
            })
          }
          style={({ pressed }) => [
            styles.edit,
            { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <PencilIcon color={theme.text} size={17} />
          <Text style={[styles.editText, { color: theme.text }]}>編輯</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <RuledPaper marginLine={30} style={styles.page}>
          <View style={styles.head}>
            <View style={styles.date}>
              <Text style={[styles.dayN, { color: theme.primary }]}>
                Day {dayNumber}
              </Text>
              <Text style={[styles.dateLabel, { color: theme.text }]}>
                {`${entry.date.slice(0, 4)} 年 ${monthDayLabel(entry.date)}`}
              </Text>
            </View>
            <View style={styles.stamps}>
              {entry.weather && (
                <JournalStamp code={entry.weather} size={54} tilt={-8} />
              )}
              {entry.mood && (
                <JournalStamp code={entry.mood} size={54} tilt={6} />
              )}
            </View>
          </View>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.text }]}
          >
            {entryHeading(entry)}
          </Text>
          {entry.photos.length > 0 && (
            <PhotoCollage
              photos={entry.photos}
              tape={TAPE_COLORS[journal.cover.tape].color}
              onOpen={setViewing}
            />
          )}
          {entry.body !== "" && (
            <Text selectable style={[styles.body, { color: theme.text }]}>
              {entry.body}
            </Text>
          )}
        </RuledPaper>
      </ScrollView>
      {viewing !== null && (
        <PhotoViewer
          photos={entry.photos}
          start={Math.min(viewing, entry.photos.length - 1)}
          onClose={() => setViewing(null)}
        />
      )}
    </View>
  );
}

const RING =
  "0px 0px 0px 1.3px rgba(58,51,45,0.55), 1px 2px 0px rgba(58,51,45,0.12)";

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 21,
    borderBottomLeftRadius: 19,
    boxShadow: RING,
  },
  editText: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  page: {
    gap: 18,
    paddingTop: 22,
    paddingRight: 18,
    paddingBottom: 26,
    paddingLeft: 42,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  date: {
    gap: 2,
  },
  dayN: {
    fontFamily: fonts.accent,
    fontSize: 20,
    lineHeight: 22,
    paddingRight: accentOverhang(20),
  },
  dateLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  stamps: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -4,
  },
  title: {
    marginTop: -6,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 31,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15.5,
    lineHeight: 28,
  },
});
