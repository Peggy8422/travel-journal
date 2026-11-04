import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatMinorAmount } from "../../../domain/ledger";
import { localDateOf } from "../../../domain/map";
import { fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";
import { PencilIcon } from "../../journal/components/PencilIcon";
import { CategoryIcon } from "../../ledger/components/CategoryIcon";
import { formatLocalDate } from "../../ledger/services/localTimestamp";
import type { MapEntry } from "../services/globeView";
import {
  mapLedgerName,
  type MapExpense,
  type MapLedger,
} from "../services/mapData";
import { ledgerColors } from "./GlobeIndex";

/** 地圖上的日記用牛皮紙小卡，和帳本色的圓點分開 */
export const KRAFT = { fill: "#D8C29E", edge: "#7E5F3A", ink: "#5E4A30" };

/** 地圖上的金額一律換算成新台幣（帳本的基準幣） */
const BASE = "TWD";

/*
 * 地圖上的消費清單（地球的消費卡片、詳細地圖點標記後的卡片）共用的版面：
 * 帳本色的分類圖示、名稱與「地名 · 日期」、右邊原幣金額與約合新台幣。
 */

/** 一筆有地點的消費；selected 時整列塗上帳本淡色 */
export function MapExpenseRow({
  expense,
  ledger,
  selected = false,
  accessibilityHint,
  onPress,
}: {
  expense: MapExpense;
  ledger: MapLedger;
  selected?: boolean;
  accessibilityHint: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const tint = ledgerColors(ledger).tint;
  const date = formatLocalDate(localDateOf(expense));
  const sub = expense.placeName ? `${expense.placeName} · ${date}` : date;
  const amount = `${expense.currency} ${formatMinorAmount(expense.amountMinor, expense.currency)}`;
  const converted =
    expense.currency !== BASE && expense.baseMinor !== null
      ? `≈ ${BASE} ${formatMinorAmount(expense.baseMinor, BASE)}`
      : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${expense.title}，${sub}，${amount}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? tint : "transparent",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <CategoryIcon category={expense.category} size={32} background={tint} />
      <View style={styles.main}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          {expense.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.sub, { color: theme.textMuted }]}
        >
          {sub}
        </Text>
      </View>
      <View style={styles.side}>
        <Text style={[styles.amount, { color: theme.text }]}>{amount}</Text>
        {converted && (
          <Text style={[styles.converted, { color: theme.textMuted }]}>
            {converted}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/** 牛皮紙小卡加鉛筆：地球上的日記標記、清單裡日記的圖示 */
export function KraftCard({
  width,
  height,
  tilt,
  ring,
}: {
  width: number;
  height: number;
  tilt: number;
  /** 標記外面要不要加一圈紙色與描邊（地球上的標記才加） */
  ring?: "plain" | "marked";
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: KRAFT.fill,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 5,
        borderBottomRightRadius: 4,
        borderBottomLeftRadius: 6,
        boxShadow:
          ring === "marked"
            ? `0px 0px 0px 3px ${theme.surface}, 0px 0px 0px 5px ${KRAFT.edge}, 2px 3px 0px rgba(58,51,45,0.22)`
            : ring === "plain"
              ? `0px 0px 0px 2px ${theme.surface}, 0px 0px 0px 3.2px ${KRAFT.edge}, 2px 3px 0px rgba(58,51,45,0.22)`
              : `0px 0px 0px 1.2px ${KRAFT.edge}`,
        transform: [{ rotate: `${tilt}deg` }],
      }}
    >
      <PencilIcon
        color={theme.text}
        size={Math.round(Math.min(width, height) * 0.58)}
        strokeWidth={2}
      />
    </View>
  );
}

/** 一篇有地點的日記：牛皮紙小卡、標題、「日記 · 地點 · 日期」，右邊一個「日記」小章 */
export function MapEntryRow({
  entry,
  selected = false,
  accessibilityHint,
  onPress,
}: {
  entry: MapEntry;
  selected?: boolean;
  accessibilityHint: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const places = [...new Set(entry.pins.map((p) => p.placeName))].join("、");
  const sub = `${places} · ${formatLocalDate(entry.date)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`日記：${entry.title}，${sub}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? "#EFE5D2" : "transparent",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={styles.kraftSlot}>
        <KraftCard width={30} height={32} tilt={-6} />
      </View>
      <View style={styles.main}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          {entry.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.sub, { color: theme.textMuted }]}
        >
          {sub}
        </Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>日記</Text>
      </View>
    </Pressable>
  );
}

/** 好幾本帳本的消費列在一起時，每本前面的小標：帳本色圓點加名稱 */
export function LedgerSectionHeader({ ledger }: { ledger: MapLedger }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHead}>
      <View
        style={[
          styles.sectionDot,
          { backgroundColor: ledgerColors(ledger).deep },
        ]}
      />
      <Text style={[styles.sectionName, { color: theme.textMuted }]}>
        {mapLedgerName(ledger)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 54,
    padding: 6,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 13,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  side: {
    alignItems: "flex-end",
    gap: 1,
  },
  amount: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  converted: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
  kraftSlot: {
    width: 32,
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1.2,
    borderColor: KRAFT.edge,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 8,
  },
  badgeText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: KRAFT.ink,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    paddingHorizontal: 8,
    paddingBottom: 2,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionName: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
});
