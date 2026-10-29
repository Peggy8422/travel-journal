import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  formatMinorAmount,
  type ExpenseRecord,
  type ExpenseStatus,
} from "../../../domain/ledger";
import { Chip } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { DashedLine } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import {
  filterExpenses,
  groupByLocalDay,
  isFiltering,
  NO_FILTER,
  type ExpenseFilter,
} from "../services/expenseListView";
import type { LedgerSummary } from "../services/ledgerSummary";
import {
  formatLocalDate,
  formatLocalDateTime,
} from "../services/localTimestamp";
import { SettledTag } from "./badges";
import { categoryColor, categoryLabel, orderForChart } from "./categories";
import { DayHeader, ExpenseRowView } from "./ExpenseRows";

/**
 * 帳本內頁的「消費」索引籤：上方固定成員、分類篩選，下方依消費當地的日期分組捲動。
 * 再點一次選中的篩選會取消。
 */
export function ExpenseList({
  ledgerId,
  summary,
  bottomInset,
}: {
  ledgerId: string;
  summary: LedgerSummary;
  /** 底部安全區域，列表最後要留空間給右下角的「新增消費」 */
  bottomInset: number;
}) {
  const theme = useTheme();
  const [filter, setFilter] = useState<ExpenseFilter>(NO_FILTER);
  const { members, expenses, expenseBaseAmounts } = summary;
  const base = summary.ledger.baseCurrency;
  const money = (minor: number) => `${base} ${formatMinorAmount(minor, base)}`;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  // 只列出這本帳本用得到的分類，順序與統計圖一致
  const categories = orderForChart(
    [...new Set(expenses.map((e) => e.category))].map((category) => ({
      category,
    })),
  ).map((c) => c.category);
  const visible = filterExpenses(expenses, filter);
  const days = groupByLocalDay(visible, expenseBaseAmounts);
  const visibleTotal = visible.reduce(
    (sum, e) => sum + (expenseBaseAmounts.get(e.id) ?? 0),
    0,
  );

  return (
    <View style={styles.fill}>
      {expenses.length > 0 && (
        <View style={styles.filters}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityLabel="依成員篩選"
            contentContainerStyle={styles.chipRow}
          >
            <Chip
              label="所有成員"
              selected={filter.memberId === null}
              onPress={() => setFilter({ ...filter, memberId: null })}
            />
            {members.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                selected={filter.memberId === m.id}
                onPress={() =>
                  setFilter({
                    ...filter,
                    memberId: filter.memberId === m.id ? null : m.id,
                  })
                }
              />
            ))}
          </ScrollView>
          {categories.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityLabel="依分類篩選"
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label="所有分類"
                selected={filter.category === null}
                onPress={() => setFilter({ ...filter, category: null })}
              />
              {categories.map((category) => {
                const selected =
                  filter.category !== null &&
                  filter.category.category === category;
                return (
                  <Chip
                    key={category ?? "__uncategorized__"}
                    label={categoryLabel(category)}
                    dot={categoryColor(category, theme)}
                    selected={selected}
                    onPress={() =>
                      setFilter({
                        ...filter,
                        category: selected ? null : { category },
                      })
                    }
                  />
                );
              })}
            </ScrollView>
          )}
          {isFiltering(filter) && (
            <Text style={[styles.summary, { color: theme.textMuted }]}>
              符合 {visible.length} 筆，共 {money(visibleTotal)}
            </Text>
          )}
          <View style={styles.filterRule}>
            <DashedLine />
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomInset + 110 },
        ]}
      >
        {days.length === 0 && (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            {expenses.length > 0
              ? "沒有符合條件的消費。"
              : "還沒有消費，按右下角「新增消費」記下第一筆。"}
          </Text>
        )}
        {days.map((day) => (
          <View key={day.date}>
            <DayHeader
              label={formatLocalDate(day.date)}
              total={money(day.totalBaseMinor)}
            />
            {day.expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                base={base}
                baseAmount={expenseBaseAmounts.get(expense.id) ?? 0}
                payerName={nameOf(expense.payerId)}
                status={summary.expenseStatuses.get(expense.id)}
                onPress={() =>
                  router.push({
                    pathname: "/ledger/[id]/expense/[expenseId]",
                    params: { id: ledgerId, expenseId: expense.id },
                  })
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function ExpenseRow({
  expense,
  base,
  baseAmount,
  payerName,
  status,
  onPress,
}: {
  expense: ExpenseRecord;
  base: string;
  baseAmount: number;
  payerName: string;
  status: ExpenseStatus | undefined;
  onPress: () => void;
}) {
  const theme = useTheme();
  const amount = `${expense.currency} ${formatMinorAmount(expense.amountMinor, expense.currency)}`;
  // 日期已經在分組標題，這裡只顯示時間
  const time = formatLocalDateTime(expense.occurredAt).split(" ")[1];
  const sub = [
    time,
    `${payerName} 付款`,
    ...(expense.category !== null ? [categoryLabel(expense.category)] : []),
  ].join(" · ");
  return (
    <ExpenseRowView
      category={expense.category}
      title={expense.title}
      sub={sub}
      note={expense.note}
      amount={amount}
      secondary={
        expense.currency !== base
          ? `≈ ${base} ${formatMinorAmount(baseAmount, base)}`
          : undefined
      }
      badge={
        status === "settled" ? (
          <SettledTag />
        ) : status === "offset" ? (
          <Text style={[styles.offset, { color: theme.textMuted }]}>
            已抵銷
          </Text>
        ) : undefined
      }
      accessibilityLabel={`${expense.title}，${amount}，${payerName} 付款`}
      accessibilityHint="編輯或刪除這筆消費"
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  offset: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
  fill: {
    flex: 1,
  },
  filters: {
    gap: 6,
    paddingTop: 12,
  },
  chipRow: {
    gap: 6,
    paddingHorizontal: 10,
  },
  summary: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    paddingHorizontal: 10,
  },
  filterRule: {
    paddingTop: 2,
  },
  list: {
    paddingHorizontal: 10,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 24,
    marginVertical: 24,
    marginHorizontal: 6,
  },
});
