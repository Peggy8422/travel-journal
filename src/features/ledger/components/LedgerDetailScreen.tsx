import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { coverFromId, formatMinorAmount } from "../../../domain/ledger";
import { fonts } from "../../../shared/ui/fonts";
import { PaperBackground } from "../../../shared/ui/handDrawn";
import { BackButton, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { useLedgerSummary } from "../hooks/useLedgerQueries";
import { tripMonthOf } from "../services/ledgerOverview";
import { COVER_COLORS } from "./coverStyles";
import { ExpenseList } from "./ExpenseList";
import { describeError } from "./messages";
import { CoverBand } from "./NotebookCover";
import { SettlePanel } from "./SettlePanel";

type Tab = "expenses" | "settle";

/** 封面色帶在安全區域以下的高度；名稱卡片的上緣會壓在色帶的波浪邊上 */
const BAND_HEIGHT = 96;

/**
 * 帳本內頁：頂端是封面色帶與名稱卡片，下面用兩個索引籤切換「消費」與「結算」，
 * 右下角固定「新增消費」。導覽列隱藏，返回鍵自己畫。
 */
export function LedgerDetailScreen({ ledgerId }: { ledgerId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error, reload } = useLedgerSummary(ledgerId);
  const [tab, setTab] = useState<Tab>("expenses");

  if (error) {
    return (
      <PageMessage backLabel="帳本" onBack={router.back} text="讀取帳本失敗" />
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
        backLabel="帳本"
        onBack={router.back}
        text={describeError(data.error)}
      />
    );
  }

  const summary = data.value;
  const { ledger, members, expenses, transfers } = summary;
  const base = ledger.baseCurrency;
  const cover = ledger.cover ?? coverFromId(ledger.id);
  const tint = COVER_COLORS[cover.palette].tint;
  let total = 0;
  for (const amount of summary.expenseBaseAmounts.values()) total += amount;
  const meta = [
    tripMonthOf(ledger, expenses).replace("-", "."),
    `${members.length} 人`,
    `總花費 ${base} ${formatMinorAmount(total, base)}`,
  ].join(" · ");
  const open = (pathname: "/ledger/[id]/settings" | "/ledger/[id]/stats") =>
    router.push({ pathname, params: { id: ledgerId } });

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <View>
        <View style={[styles.band, { height: insets.top + BAND_HEIGHT }]}>
          <CoverBand cover={cover} />
        </View>
        <WavyEdge top={insets.top + BAND_HEIGHT - 12} />

        <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
          <BackButton label="帳本" onPress={router.back} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="帳本設定"
            onPress={() => open("/ledger/[id]/settings")}
            style={({ pressed }) => [
              styles.roundButton,
              { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <GearIcon color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.titleRow}>
          <View style={[styles.titleCard, { backgroundColor: theme.surface }]}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: theme.text }]}
            >
              {ledger.name}
            </Text>
            <Text style={[styles.meta, { color: theme.textMuted }]}>
              {meta}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => open("/ledger/[id]/stats")}
            style={({ pressed }) => [
              styles.statsButton,
              { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ChartIcon color={theme.text} />
            <Text style={[styles.statsText, { color: theme.text }]}>統計</Text>
          </Pressable>
        </View>

        <View accessibilityRole="tablist" style={styles.tabs}>
          <FolderTab
            label={`消費 · ${expenses.length} 筆`}
            selected={tab === "expenses"}
            tint={tint}
            onPress={() => setTab("expenses")}
          />
          <FolderTab
            label={
              transfers.length > 0 ? `結算 · 待還 ${transfers.length}` : "結算"
            }
            selected={tab === "settle"}
            tint={tint}
            onPress={() => setTab("settle")}
          />
        </View>
      </View>

      <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
        {tab === "expenses" ? (
          <ExpenseList
            ledgerId={ledgerId}
            summary={summary}
            bottomInset={insets.bottom}
          />
        ) : (
          <SettlePanel
            ledgerId={ledgerId}
            summary={summary}
            reload={reload}
            bottomInset={insets.bottom}
          />
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: "/ledger/[id]/add-expense",
            params: { id: ledgerId },
          })
        }
        style={({ pressed }) => [
          styles.add,
          {
            bottom: insets.bottom + 18,
            backgroundColor: theme.primary,
            opacity: pressed ? 0.85 : 1,
          },
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
        <Text style={[styles.addText, { color: theme.onPrimary }]}>
          新增消費
        </Text>
      </Pressable>
    </View>
  );
}

/** 索引籤：選中的和下面的紙連在一起；沒選中的用封面淡色，往下沉一點 */
function FolderTab({
  label,
  selected,
  tint,
  onPress,
}: {
  label: string;
  selected: boolean;
  tint: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.tab,
        {
          backgroundColor: selected ? theme.surface : tint,
          transform: [{ translateY: selected ? 0 : 4 }],
        },
      ]}
    >
      <Text
        style={[
          styles.tabText,
          {
            color: theme.text,
            fontFamily: selected ? fonts.bold : fonts.regular,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 色帶下緣的波浪：先用和紙色填掉波浪以下，再描一條鉛筆線 */
function WavyEdge({ top }: { top: number }) {
  const theme = useTheme();
  const wave =
    "M0 7 C 30 1, 60 12, 92 6 S 152 1, 184 7 S 246 12, 278 6 S 340 1, 390 7";
  return (
    <Svg
      width="100%"
      height={14}
      viewBox="0 0 390 14"
      preserveAspectRatio="none"
      style={[styles.wave, { top }]}
    >
      <Path d={`${wave} V14 H0 Z`} fill={theme.background} />
      <Path
        d={wave}
        fill="none"
        stroke={theme.text}
        strokeOpacity={0.35}
        strokeWidth={1.2}
      />
    </Svg>
  );
}

function GearIcon({ color }: { color: string }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 22 22"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Circle cx={11} cy={11} r={3} />
      <Path
        d="M11 3.2c4.4-.2 7.9 3.4 7.8 7.9-.1 4.2-3.6 7.7-7.9 7.6-4.3 0-7.7-3.6-7.6-7.9.1-4.2 3.5-7.5 7.7-7.6z"
        strokeDasharray="3.2 2.4"
      />
    </Svg>
  );
}

function ChartIcon({ color }: { color: string }) {
  return (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3.6 19.6c5.6.2 11.2-.1 16.8.1" />
      <Path d="M6.6 19.2c.1-2.4-.1-4.6 0-6.8M11.4 19.2c-.1-4.1.1-8.2 0-12.3M16.2 19.2c.1-3.1-.1-6.1 0-9.1" />
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
  wave: {
    position: "absolute",
    left: 0,
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
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 34,
  },
  titleCard: {
    flex: 1,
    gap: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 9,
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
  statsButton: {
    width: 66,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 17,
    boxShadow: RING,
  },
  statsText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  tabs: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  tab: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderWidth: 1.3,
    borderBottomWidth: 0,
    borderColor: "rgba(58,51,45,0.45)",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 14,
  },
  tabText: {
    fontSize: 15,
  },
  sheet: {
    flex: 1,
    marginHorizontal: 10,
    borderTopRightRadius: 14,
    boxShadow:
      "0px -1px 0px rgba(58,51,45,0.14), 0px 6px 18px rgba(58,51,45,0.08)",
  },
  add: {
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
  addText: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
