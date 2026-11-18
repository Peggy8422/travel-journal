import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatMinorAmount } from "../../../domain/ledger";
import { fonts } from "../../../shared/ui/fonts";
import { DashedLine } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { CategoryIcon } from "../../ledger/components/CategoryIcon";
import { formatLocalDate } from "../../ledger/services/localTimestamp";
import { KraftCard } from "../../map/components/MapExpenseRow";
import type { HereItem } from "../services/placeHere";

/**
 * 地點頁的「在這裡的日記與消費」：用距離找出來的，不另外存關聯。
 * 日記點了打開日記頁，消費點了打開消費明細。
 */
export function PlaceHere({ items }: { items: readonly HereItem[] }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.text }]}
      >
        在這裡的日記與消費
      </Text>
      <DashedLine opacity={0.4} />
      {items.map((item) =>
        item.kind === "entry" ? (
          <Row
            key={`entry:${item.id}`}
            icon={
              <View style={styles.kraftSlot}>
                <KraftCard width={26} height={28} tilt={-6} />
              </View>
            }
            title={item.title}
            sub={`${item.journalName} · ${formatLocalDate(item.date)}`}
            label="日記"
            onPress={() =>
              router.push({
                pathname: "/journal/[id]/entry/[entryId]",
                params: { id: item.journalId, entryId: item.id },
              })
            }
          />
        ) : (
          <Row
            key={`expense:${item.id}`}
            icon={<CategoryIcon category={item.category} size={30} />}
            title={item.title}
            sub={`${item.ledgerName ?? "個人記帳"} · ${formatLocalDate(item.date)}`}
            side={`${item.currency} ${formatMinorAmount(item.amountMinor, item.currency)}`}
            label="消費"
            onPress={() =>
              router.push({
                pathname: "/expense/[expenseId]",
                params: { expenseId: item.id },
              })
            }
          />
        ),
      )}
    </View>
  );
}

function Row({
  icon,
  title,
  sub,
  side,
  label,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  side?: string;
  /** 讀螢幕用：這一列是日記還是消費 */
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}：${title}，${sub}${side ? `，${side}` : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
    >
      {icon}
      <View style={styles.main}>
        <Text
          numberOfLines={1}
          style={[styles.rowTitle, { color: theme.text }]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.sub, { color: theme.textMuted }]}
        >
          {sub}
        </Text>
      </View>
      {side !== undefined && (
        <Text style={[styles.side, { color: theme.text }]}>{side}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 6,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
  },
  kraftSlot: {
    width: 30,
    alignItems: "center",
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  side: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
