import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import {
  formatMinorAmount,
  type ExpenseRecord,
  type ExpenseStatus,
} from "../../../domain/ledger";
import {
  Chip,
  ChipGroup,
  Label,
  Row,
  Section,
} from "../../../shared/ui/components";
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
import { categoryLabel, orderForChart } from "./categories";

/** 帳本明細的消費列表：上方可依成員、分類篩選，下方依消費當地的日期分組 */
export function ExpenseList({
  ledgerId,
  summary,
}: {
  ledgerId: string;
  summary: LedgerSummary;
}) {
  const [filter, setFilter] = useState<ExpenseFilter>(NO_FILTER);
  const { members, expenses, expenseBaseAmounts } = summary;
  const base = summary.ledger.baseCurrency;
  const money = (minor: number) => `${base} ${formatMinorAmount(minor, base)}`;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  if (expenses.length === 0) {
    return (
      <Section title="消費">
        <Label muted>還沒有消費</Label>
      </Section>
    );
  }

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
    <>
      <Section title="篩選消費">
        <ChipGroup>
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
              onPress={() => setFilter({ ...filter, memberId: m.id })}
            />
          ))}
        </ChipGroup>
        {categories.length > 1 && (
          <ChipGroup>
            <Chip
              label="所有分類"
              selected={filter.category === null}
              onPress={() => setFilter({ ...filter, category: null })}
            />
            {categories.map((category) => (
              <Chip
                key={category ?? "__uncategorized__"}
                label={categoryLabel(category)}
                selected={
                  filter.category !== null &&
                  filter.category.category === category
                }
                onPress={() => setFilter({ ...filter, category: { category } })}
              />
            ))}
          </ChipGroup>
        )}
        {isFiltering(filter) && (
          <Label muted>
            符合 {visible.length} 筆，共 {money(visibleTotal)}
          </Label>
        )}
      </Section>

      {days.length === 0 && <Label muted>沒有符合條件的消費</Label>}
      {days.map((day) => (
        <Section
          key={day.date}
          title={`${formatLocalDate(day.date)} · ${money(day.totalBaseMinor)}`}
        >
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
        </Section>
      ))}
    </>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="編輯或刪除這筆消費"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Row>
        <View style={{ flex: 1 }}>
          <Label>{expense.title}</Label>
          <Label muted>
            {/* 日期已經在分組標題，這裡只顯示時間 */}
            {formatLocalDateTime(expense.occurredAt).split(" ")[1]} ·{" "}
            {payerName} 付款
            {expense.category !== null &&
              ` · ${categoryLabel(expense.category)}`}
          </Label>
          {expense.note !== null && <Label muted>備註：{expense.note}</Label>}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Label>
            {expense.currency}{" "}
            {formatMinorAmount(expense.amountMinor, expense.currency)}
          </Label>
          {expense.currency !== base && (
            <Label muted>
              ≈ {base} {formatMinorAmount(baseAmount, base)}
            </Label>
          )}
          <ExpenseStatusLabel status={status} />
        </View>
      </Row>
    </Pressable>
  );
}

function ExpenseStatusLabel({ status }: { status?: ExpenseStatus }) {
  const theme = useTheme();
  if (status === "settled") return <Label color={theme.positive}>已結清</Label>;
  if (status === "offset") return <Label muted>已抵銷</Label>;
  return null;
}
