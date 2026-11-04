import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import {
  formatMinorAmount,
  summarizePersonalMonth,
} from "../../../domain/ledger";
import { SmallButton } from "../../../shared/ui/components";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import {
  InkStamp,
  PaperBackground,
  RuledPaper,
  SketchFrame,
  WashiTape,
} from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { JournalCover } from "../../journal/components/JournalCover";
import { PencilIcon } from "../../journal/components/PencilIcon";
import { useJournalShelf } from "../../journal/hooks/useJournalQueries";
import type { JournalOverview } from "../../journal/services/journalCommands";
import {
  entryHeading,
  journalCaption,
} from "../../journal/services/journalDates";
import { PersonalSplit } from "../../ledger/components/PersonalSplit";
import { usePersonalSpending } from "../../ledger/hooks/usePersonalQueries";
import { toLocalIsoString } from "../../ledger/services/localTimestamp";

const STAMP = "#B5452B";

/**
 * 「個人」分頁：01 個人記帳（這個月的花費與入口）、02 旅遊手帳（最近的一本與入口）。
 * 導覽列隱藏，頁首自己畫。
 */
export function PersonalHomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data } = usePersonalSpending();
  const { data: journals } = useJournalShelf();
  const month = toLocalIsoString(new Date()).slice(0, 7);
  // 讀取中或讀取失敗時只是不顯示金額，按鈕仍然可以用
  const summary =
    data?.ok === true
      ? summarizePersonalMonth(data.value.entries, month)
      : undefined;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.selfStamp}>
            <InkStamp size={52} label="我" color={STAMP} labelScale={0.48} />
          </View>
          <View>
            <Text style={[styles.kicker, { color: theme.textMuted }]}>
              My Pages
            </Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: theme.text }]}
            >
              個人
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle
            number="01"
            title="個人記帳"
            hint="自己的花費＋分帳裡我負擔的部分"
          />
          <RuledPaper holes style={styles.ledgerCard}>
            <View style={styles.tape}>
              <WashiTape color="#6683AA" tilt={5} opacity={0.8} />
            </View>
            <Text style={[styles.monthLabel, { color: theme.textMuted }]}>
              {Number(month.slice(5, 7))} 月花費
            </Text>
            <Text style={[styles.total, { color: theme.text }]}>
              {summary
                ? `TWD ${formatMinorAmount(summary.totalMinor, "TWD")}`
                : "—"}
            </Text>
            {summary && (
              <PersonalSplit
                personalMinor={summary.personalMinor}
                sharedMinor={summary.sharedMinor}
              />
            )}
            <View style={styles.actions}>
              <SmallButton
                title="＋ 記一筆"
                variant="primary"
                onPress={() => router.push("/personal/add-expense")}
              />
              <SmallButton
                title="看明細與統計"
                onPress={() => router.push("/personal/spending")}
              />
            </View>
          </RuledPaper>
        </View>

        <View style={styles.section}>
          <SectionTitle
            number="02"
            title="旅遊手帳"
            hint={
              journals && journals.length > 0
                ? `${journals.length} 本手帳 · ${journals.reduce((n, o) => n + o.entryCount, 0)} 篇日記`
                : "每趟旅行一本"
            }
          />
          <JournalCard latest={journals ? latestJournal(journals) : null} />
        </View>
      </ScrollView>
    </View>
  );
}

/** 「01 個人記帳」這種小節標題：Caveat 朱色編號、粗體標題、一行說明 */
function SectionTitle({
  number,
  title,
  hint,
}: {
  number: string;
  title: string;
  hint: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.number, { color: theme.primary }]}>{number}</Text>
      <Text
        accessibilityRole="header"
        style={[styles.sectionName, { color: theme.text }]}
      >
        {title}
      </Text>
      <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>
    </View>
  );
}

/** 最近在寫的手帳：最後一篇日記日期最晚的那本；都還沒有日記時用最新建立的 */
function latestJournal(
  journals: readonly JournalOverview[],
): JournalOverview | null {
  return journals.reduce<JournalOverview | null>(
    (best, o) =>
      best === null || (o.lastDate ?? "") > (best.lastDate ?? "") ? o : best,
    null,
  );
}

/**
 * 旅遊手帳的牛皮紙卡片：有手帳時放最近那本的封面和最近一篇（點封面打開那本），
 * 還沒有手帳時是一段說明加「建立手帳」
 */
function JournalCard({ latest }: { latest: JournalOverview | null }) {
  const theme = useTheme();
  const entry = latest?.latestEntry ?? null;
  const recent = entry
    ? `最近一篇：${Number(entry.date.slice(5, 7))}/${Number(entry.date.slice(8, 10))} ${entryHeading(entry)}`
    : "還沒有日記";
  return (
    <View style={styles.journal}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id="journalKraft"
            patternUnits="userSpaceOnUse"
            width={7}
            height={7}
          >
            <Circle cx={3.5} cy={3.5} r={1} fill="rgba(120,90,50,0.13)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#journalKraft)" />
      </Svg>
      <View style={styles.journalSpine} />
      <View style={styles.journalBand} />
      <SketchFrame radius={12} strokeWidth={1.3} />
      {latest ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`打開手帳「${latest.journal.name}」`}
          onPress={() =>
            router.push({
              pathname: "/journal/[id]",
              params: { id: latest.journal.id },
            })
          }
          style={({ pressed }) => [
            styles.journalLatest,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <JournalCover
            cover={latest.journal.cover}
            title={latest.journal.name}
            caption={journalCaption(
              latest.journal.createdAt,
              latest.firstDate,
              latest.lastDate,
            )}
            width={86}
            tilt={-3}
          />
          <View style={styles.journalInfo}>
            <Text style={styles.journalKicker}>Travel Journal</Text>
            <Text style={styles.journalName}>{latest.journal.name}</Text>
            <Text style={styles.journalRecent}>{recent}</Text>
          </View>
        </Pressable>
      ) : (
        <>
          <Text style={styles.journalKicker}>Travel Journal</Text>
          <Text style={styles.journalText}>
            每趟旅行一本手帳，按日期寫下去了哪裡、吃了什麼。綁定帳本的話，日記頁還會列出那天的消費。
          </Text>
        </>
      )}
      <View style={styles.journalButtons}>
        {latest ? (
          <>
            <SmallButton
              title="寫日記"
              variant="primary"
              icon={
                <PencilIcon color={theme.onPrimary} size={16} strokeWidth={2} />
              }
              onPress={() =>
                router.push({
                  pathname: "/journal/[id]/write",
                  params: { id: latest.journal.id },
                })
              }
            />
            <SmallButton
              title="全部手帳"
              onPress={() => router.push("/journal")}
            />
          </>
        ) : (
          <SmallButton
            title="＋ 建立手帳"
            variant="primary"
            onPress={() => router.push("/journal/new")}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    gap: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  selfStamp: {
    transform: [{ rotate: "-8deg" }],
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
  section: {
    gap: 10,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 8,
  },
  number: {
    fontFamily: fonts.accent,
    fontSize: 24,
    lineHeight: 26,
    paddingRight: accentOverhang(24),
  },
  sectionName: {
    fontFamily: fonts.bold,
    fontSize: 19,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  ledgerCard: {
    gap: 12,
    paddingTop: 20,
    paddingRight: 18,
    paddingBottom: 18,
    paddingLeft: 46,
  },
  tape: {
    position: "absolute",
    right: 22,
    top: -8,
    width: 58,
    height: 17,
  },
  monthLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  total: {
    fontFamily: fonts.bold,
    fontSize: 34,
    lineHeight: 40,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 4,
  },
  journal: {
    gap: 14,
    paddingTop: 20,
    paddingRight: 52,
    paddingBottom: 18,
    paddingLeft: 32,
    backgroundColor: "#D8C29E",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 4,
    boxShadow: "3px 5px 0px rgba(58,51,45,0.16)",
  },
  journalSpine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 16,
    backgroundColor: "#BFA57C",
    borderRightWidth: 1.5,
    borderRightColor: "rgba(58,51,45,0.18)",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  journalBand: {
    position: "absolute",
    right: 22,
    top: 0,
    bottom: 0,
    width: 9,
    backgroundColor: "#7E5F3A",
  },
  journalLatest: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  journalInfo: {
    flex: 1,
    gap: 4,
  },
  journalName: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 23,
    color: "#3A332D",
  },
  journalRecent: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: "#4E4237",
  },
  journalKicker: {
    fontFamily: fonts.accent,
    fontSize: 21,
    lineHeight: 24,
    color: "#5E4A30",
    paddingRight: accentOverhang(21),
  },
  journalText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 25,
    color: "#3A332D",
  },
  journalButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
