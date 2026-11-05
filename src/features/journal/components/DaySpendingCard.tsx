import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { coverFromId, formatMinorAmount } from "../../../domain/ledger";
import { fonts } from "../../../shared/ui/fonts";
import { DashedLine, ReceiptPaper } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { COVER_COLORS } from "../../ledger/components/coverStyles";
import { ExpenseRowView } from "../../ledger/components/ExpenseRows";
import type { DaySpending } from "../services/daySpending";

/**
 * 日記頁最下面的「這天的消費」：一張收據，列出綁定的帳本這天記的消費。
 * 只顯示，點一筆打開消費明細（和其他消費列表一樣），要改到明細再按「編輯」。
 */
export function DaySpendingCard({ spending }: { spending: DaySpending }) {
  const theme = useTheme();
  const { ledger, rows, total } = spending;
  const base = ledger.baseCurrency;
  const color = COVER_COLORS[(ledger.cover ?? coverFromId(ledger.id)).palette];
  return (
    <ReceiptPaper style={styles.paper}>
      <View style={styles.head}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.text }]}
        >
          這天的消費
        </Text>
        <View style={styles.ledger}>
          <View style={[styles.dot, { backgroundColor: color.deep }]} />
          <Text
            numberOfLines={1}
            style={[styles.ledgerName, { color: theme.textMuted }]}
          >
            {ledger.name}
          </Text>
        </View>
      </View>
      <DashedLine opacity={0.3} />
      {rows.length === 0 && (
        <Text style={[styles.empty, { color: theme.textMuted }]}>
          這天在這本帳本沒有消費。
        </Text>
      )}
      {rows.map(({ expense, payerName, baseMinor }) => {
        const amount = `${expense.currency} ${formatMinorAmount(expense.amountMinor, expense.currency)}`;
        // The entry already gives the day, so only the time
        const time = expense.occurredAt.slice(11, 16);
        return (
          <ExpenseRowView
            key={expense.id}
            category={expense.category}
            title={expense.title}
            sub={`${time} · ${payerName} 付款`}
            note={null}
            amount={amount}
            secondary={
              expense.currency !== base && baseMinor !== null
                ? `≈ ${base} ${formatMinorAmount(baseMinor, base)}`
                : undefined
            }
            accessibilityLabel={`${expense.title}，${amount}，${payerName} 付款`}
            accessibilityHint="查看這筆消費的明細"
            onPress={() =>
              router.push({
                pathname: "/expense/[expenseId]",
                params: { expenseId: expense.id },
              })
            }
          />
        );
      })}
      {total && (
        <View style={styles.foot}>
          <Text style={[styles.count, { color: theme.textMuted }]}>
            {rows.length} 筆
          </Text>
          <Text style={[styles.total, { color: theme.text }]}>
            合計 {total.currency}{" "}
            {formatMinorAmount(total.amountMinor, total.currency)}
          </Text>
        </View>
      )}
    </ReceiptPaper>
  );
}

const styles = StyleSheet.create({
  paper: {
    marginLeft: -16,
    marginRight: -6,
    paddingTop: 18,
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
  },
  ledger: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 3.6,
    borderBottomRightRadius: 4.2,
    borderBottomLeftRadius: 3.8,
  },
  ledgerName: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  empty: {
    paddingTop: 10,
    paddingHorizontal: 4,
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  foot: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  total: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
});
