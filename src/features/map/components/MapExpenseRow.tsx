import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatMinorAmount } from "../../../domain/ledger";
import { localDateOf } from "../../../domain/map";
import { fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";
import { CategoryIcon } from "../../ledger/components/CategoryIcon";
import { formatLocalDate } from "../../ledger/services/localTimestamp";
import type { MapExpense, MapLedger } from "../services/mapData";
import { ledgerColors } from "./GlobeIndex";

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
        {ledger.kind === "personal" ? "個人記帳" : ledger.name}
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
