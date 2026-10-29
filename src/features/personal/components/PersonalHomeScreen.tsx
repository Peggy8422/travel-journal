import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
import { PersonalSplit } from "../../ledger/components/PersonalSplit";
import { usePersonalSpending } from "../../ledger/hooks/usePersonalQueries";
import { toLocalIsoString } from "../../ledger/services/localTimestamp";

const STAMP = "#B5452B";

/**
 * 「個人」分頁：01 個人記帳（這個月的花費與入口）、02 旅遊手帳（準備中）。
 * 導覽列隱藏，頁首自己畫。
 */
export function PersonalHomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data } = usePersonalSpending();
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
          <SectionTitle number="02" title="旅遊手帳" hint="準備中" />
          <JournalCover />
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

/** 旅遊手帳的牛皮紙封面：還沒開放，蓋一個「準備中」的章 */
function JournalCover() {
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
      <Text style={styles.journalKicker}>Travel Journal</Text>
      <Text style={styles.journalText}>
        之後可以在這裡寫下每趟旅行的日記，記下的地點也會出現在地圖上。
      </Text>
      <View style={styles.journalButton}>
        <SmallButton title="敬請期待" disabled onPress={() => {}} />
      </View>
      <View style={styles.journalStamp}>
        <InkStamp size={66} label="準備中" color={STAMP} labelScale={0.24} />
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
    minHeight: 190,
    gap: 10,
    paddingTop: 22,
    paddingRight: 70,
    paddingBottom: 20,
    paddingLeft: 34,
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
    right: 28,
    top: 0,
    bottom: 0,
    width: 9,
    backgroundColor: "#7E5F3A",
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
  journalButton: {
    alignItems: "flex-start",
    marginTop: 4,
  },
  journalStamp: {
    position: "absolute",
    right: 50,
    bottom: 16,
    transform: [{ rotate: "-14deg" }],
  },
});
