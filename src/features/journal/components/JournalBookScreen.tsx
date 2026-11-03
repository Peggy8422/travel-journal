import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Path, Pattern, Rect } from "react-native-svg";

import type { JournalEntryRecord } from "../../../domain/journal";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import {
  DashedLine,
  PaperBackground,
  WavyEdge,
} from "../../../shared/ui/handDrawn";
import { BackButton, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { GearIcon } from "../../ledger/components/LedgerDetailScreen";
import { describeError } from "../../ledger/components/messages";
import { useJournal } from "../hooks/useJournalQueries";
import { formatDateRange } from "../services/journalDates";
import { KRAFT, ledgerDotColor } from "./tapes";

/** 牛皮紙色帶在安全區域以下的高度；名稱卡片的上緣壓在色帶的波浪邊上 */
const BAND_HEIGHT = 96;
const WEEKDAYS = "日一二三四五六";

/**
 * 一本手帳：頂端是牛皮紙色帶與名稱卡片（綁定帳本時可以點過去），下面依日期列出日記。
 * 導覽列隱藏，返回鍵自己畫。
 */
export function JournalBookScreen({ journalId }: { journalId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useJournal(journalId);

  if (error) {
    return (
      <PageMessage
        backLabel="旅遊手帳"
        onBack={router.back}
        text="讀取手帳失敗"
      />
    );
  }
  if (!data) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]} />
    );
  }
  if (!data.ok) {
    return (
      <PageMessage
        backLabel="旅遊手帳"
        onBack={router.back}
        text={describeError(data.error)}
      />
    );
  }

  const { journal, ledger, entries } = data.value;
  const range = formatDateRange(data.value.firstDate, data.value.lastDate);
  const meta = [
    range,
    entries.length > 0 ? `${entries.length} 篇日記` : "還沒有日記",
  ]
    .filter((part) => part !== null)
    .join(" · ");
  const first = entries[0]?.date ?? null;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <View>
        <View style={[styles.band, { height: insets.top + BAND_HEIGHT }]}>
          <KraftBand />
        </View>
        <WavyEdge top={insets.top + BAND_HEIGHT - 12} />

        <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
          <BackButton label="旅遊手帳" onPress={router.back} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="手帳設定"
            onPress={() =>
              router.push({
                pathname: "/journal/[id]/settings",
                params: { id: journalId },
              })
            }
            style={({ pressed }) => [
              styles.roundButton,
              { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <GearIcon color={theme.text} />
          </Pressable>
        </View>

        <View style={[styles.titleCard, { backgroundColor: theme.surface }]}>
          <Text
            accessibilityRole="header"
            style={[styles.title, { color: theme.text }]}
          >
            {journal.name}
          </Text>
          <Text style={[styles.meta, { color: theme.textMuted }]}>{meta}</Text>
          {ledger && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`打開帳本「${ledger.name}」`}
              onPress={() =>
                router.push({
                  pathname: "/ledger/[id]",
                  params: { id: ledger.id },
                })
              }
              style={({ pressed }) => [
                styles.ledgerChip,
                { backgroundColor: theme.chip, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: ledgerDotColor(ledger) },
                ]}
              />
              <Text
                numberOfLines={1}
                style={[styles.ledgerText, { color: theme.text }]}
              >
                帳本：{ledger.name}
              </Text>
              <ChevronIcon color={theme.text} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
        <ScrollView
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 40 },
          ]}
        >
          {entries.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              還沒有日記。
            </Text>
          ) : (
            entries.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 && <DashedLine />}
                <EntryRow entry={entry} firstDate={first ?? entry.date} />
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/** 一篇日記：左邊大大的日期，右邊標題與開頭幾行 */
function EntryRow({
  entry,
  firstDate,
}: {
  entry: JournalEntryRecord;
  firstDate: string;
}) {
  const theme = useTheme();
  const [year, month, day] = entry.date.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const weekday =
    WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const dayNumber =
    Math.round(
      (Date.UTC(year, month - 1, day) - Date.parse(`${firstDate}T00:00:00Z`)) /
        86_400_000,
    ) + 1;
  return (
    <View style={styles.entry}>
      <View style={styles.date}>
        <Text style={[styles.day, { color: theme.primary }]}>{day}</Text>
        <Text style={[styles.monthWeek, { color: theme.textMuted }]}>
          {month}月 · {weekday}
        </Text>
        <Text style={[styles.dayN, { color: theme.textMuted }]}>
          Day {dayNumber}
        </Text>
      </View>
      <View style={styles.entryText}>
        <Text style={[styles.entryTitle, { color: theme.text }]}>
          {entry.title || `${month}月${day}日`}
        </Text>
        {entry.body !== "" && (
          <Text
            numberOfLines={2}
            style={[styles.excerpt, { color: theme.textMuted }]}
          >
            {entry.body.replace(/\n/g, " ")}
          </Text>
        )}
      </View>
    </View>
  );
}

/** 牛皮紙色帶：底色加上細細的點 */
function KraftBand() {
  return (
    <Svg width="100%" height="100%">
      <Defs>
        <Pattern
          id="bookKraft"
          patternUnits="userSpaceOnUse"
          width={7}
          height={7}
        >
          <Circle cx={3.5} cy={3.5} r={1} fill={KRAFT.dot} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={KRAFT.paper} />
      <Rect width="100%" height="100%" fill="url(#bookKraft)" />
    </Svg>
  );
}

function ChevronIcon({ color }: { color: string }) {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 18 18"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M6.8 3.8 C9 6 10.8 7.7 12.4 9.1 C10.6 10.6 8.8 12.3 6.6 14.4" />
    </Svg>
  );
}

const RING =
  "0px 0px 0px 1.3px rgba(58,51,45,0.55), 1px 2px 0px rgba(58,51,45,0.12)";

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  band: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  roundButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 21,
    borderBottomRightRadius: 23,
    borderBottomLeftRadius: 21,
    boxShadow: RING,
  },
  titleCard: {
    gap: 4,
    marginHorizontal: 16,
    marginTop: 34,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 12,
    boxShadow:
      "0px 1px 0px rgba(58,51,45,0.12), 0px 4px 10px rgba(58,51,45,0.08)",
    transform: [{ rotate: "-0.8deg" }],
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 28,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  ledgerChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    minHeight: 34,
    marginTop: 2,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 17,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  ledgerText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  sheet: {
    flex: 1,
    marginTop: 16,
    marginHorizontal: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    boxShadow:
      "0px -1px 0px rgba(58,51,45,0.14), 0px 6px 18px rgba(58,51,45,0.08)",
  },
  list: {
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  empty: {
    paddingHorizontal: 10,
    paddingVertical: 40,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 24,
  },
  entry: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 16,
    paddingRight: 4,
  },
  date: {
    width: 52,
    alignItems: "center",
    gap: 2,
  },
  day: {
    fontFamily: fonts.accent,
    fontSize: 32,
    lineHeight: 32,
    paddingRight: accentOverhang(32),
  },
  monthWeek: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  dayN: {
    fontFamily: fonts.accent,
    fontSize: 14,
    lineHeight: 16,
    paddingRight: accentOverhang(14),
  },
  entryText: {
    flex: 1,
    gap: 6,
  },
  entryTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  excerpt: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 22,
  },
});
