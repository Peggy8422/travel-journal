import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  formatMinorAmount,
  summarizePersonalMonth,
  type PersonalEntry,
} from "../../../domain/ledger";
import { FloatingAddButton } from "../../../shared/ui/components";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import {
  DashedLine,
  PaperBackground,
  RuledPaper,
  WashiTape,
} from "../../../shared/ui/handDrawn";
import { MonthSwitcher } from "../../../shared/ui/MonthPicker";
import { BackButton, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { usePersonalSpending } from "../hooks/usePersonalQueries";
import { groupByLocalDay } from "../services/expenseListView";
import {
  formatLocalDate,
  formatLocalDateTime,
  toLocalIsoString,
} from "../services/localTimestamp";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { categoryLabel } from "./categories";
import { DayHeader, ExpenseRowView } from "./ExpenseRows";
import { describeError } from "./messages";
import { PersonalSplit } from "./PersonalSplit";

/** 個人花費一律以新台幣計算（所有帳本的基準幣） */
const BASE = "TWD";

/**
 * 個人記帳：「我」在個人消費與各分帳帳本裡實際負擔的花費，依月份查看。
 * 個人消費點了可以編輯；分帳消費點了回到那本帳本（只能在帳本裡修改）。
 */
export function PersonalSpendingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = usePersonalSpending();
  const [month, setMonth] = useState(() =>
    toLocalIsoString(new Date()).slice(0, 7),
  );

  if (error) {
    return (
      <PageMessage
        backLabel="個人"
        onBack={router.back}
        text="讀取個人花費失敗"
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
        backLabel="個人"
        onBack={router.back}
        text={describeError(data.error)}
      />
    );
  }

  const { entries, ledgersWithoutSelf } = data.value;
  const summary = summarizePersonalMonth(entries, month);
  const money = (minor: number) => `${BASE} ${formatMinorAmount(minor, BASE)}`;
  const entryById = new Map(summary.entries.map((e) => [e.expense.id, e]));
  const days = groupByLocalDay(
    summary.entries.map((e) => e.expense),
    new Map(summary.entries.map((e) => [e.expense.id, e.myShareMinor])),
  );

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <BackButton label="個人" onPress={router.back} />
          <View style={styles.titleBlock}>
            <Text style={[styles.kicker, { color: theme.textMuted }]}>
              Personal Ledger
            </Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: theme.text }]}
            >
              個人記帳
            </Text>
          </View>
        </View>
        <MonthSwitcher
          value={month}
          onChange={setMonth}
          label="查看月份"
          pickerTitle="選擇要查看的月份"
        />
        <View style={styles.headerRule}>
          <DashedLine />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 110 },
        ]}
      >
        <RuledPaper marginLine={30} style={styles.summary}>
          <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>
            本月花費
          </Text>
          <Text style={[styles.total, { color: theme.text }]}>
            {money(summary.totalMinor)}
          </Text>
          <PersonalSplit
            personalMinor={summary.personalMinor}
            sharedMinor={summary.sharedMinor}
          />
        </RuledPaper>

        {ledgersWithoutSelf.length > 0 && (
          <View style={styles.note}>
            <View style={styles.noteTape}>
              <WashiTape color="#FBF8F1" tilt={-3} opacity={0.75} />
            </View>
            <Text style={[styles.noteText, { color: theme.text }]}>
              有 {ledgersWithoutSelf.length} 本帳本還沒指定「我是誰」（
              {ledgersWithoutSelf.map((l) => l.name).join("、")}
              ），這些帳本的消費不會算進個人花費。可以到帳本設定指定。
            </Text>
          </View>
        )}

        {summary.totalMinor > 0 && (
          <CategoryBreakdown
            categories={summary.categories}
            totalMinor={summary.totalMinor}
            currency={BASE}
            centerLabel="本月花費"
          />
        )}

        <View>
          {days.length === 0 && (
            <Text style={[styles.empty, { color: theme.textMuted }]}>
              這個月還沒有花費。
            </Text>
          )}
          {days.map((day) => (
            <View key={day.date}>
              <DayHeader
                label={formatLocalDate(day.date)}
                total={money(day.totalBaseMinor)}
              />
              {day.expenses.map((expense) => {
                const entry = entryById.get(expense.id);
                return entry ? (
                  <PersonalRow key={expense.id} entry={entry} money={money} />
                ) : null;
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <FloatingAddButton
        title="記一筆"
        bottom={insets.bottom + 18}
        onPress={() => router.push("/personal/add-expense")}
      />
    </View>
  );
}

function PersonalRow({
  entry,
  money,
}: {
  entry: PersonalEntry;
  money: (minor: number) => string;
}) {
  const { expense, ledger } = entry;
  const personal = entry.source === "personal";
  // 日期已經在分組標題，這裡只顯示時間
  const time = formatLocalDateTime(expense.occurredAt).split(" ")[1];
  const sub = [
    time,
    personal ? "個人" : `${ledger.name}（分帳）`,
    ...(expense.category !== null ? [categoryLabel(expense.category)] : []),
  ].join(" · ");
  const amount = money(entry.myShareMinor);
  return (
    <ExpenseRowView
      category={expense.category}
      title={expense.title}
      sub={sub}
      note={expense.note}
      amount={amount}
      secondary={
        !personal
          ? "我的負擔"
          : expense.currency !== BASE
            ? `${expense.currency} ${formatMinorAmount(expense.amountMinor, expense.currency)}`
            : undefined
      }
      accessibilityLabel={`${expense.title}，${amount}`}
      accessibilityHint={
        personal ? "編輯或刪除這筆個人消費" : `到「${ledger.name}」查看`
      }
      onPress={() =>
        personal
          ? router.push({
              pathname: "/personal/expense/[expenseId]",
              params: { expenseId: expense.id },
            })
          : // 分帳消費只能在帳本裡修改，帶到那本帳本
            router.push({ pathname: "/ledger/[id]", params: { id: ledger.id } })
      }
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleBlock: {
    alignItems: "flex-end",
  },
  kicker: {
    fontFamily: fonts.accent,
    fontSize: 18,
    lineHeight: 20,
    paddingRight: accentOverhang(18),
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 29,
  },
  headerRule: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    gap: 16,
    paddingTop: 16,
    paddingHorizontal: 14,
  },
  summary: {
    gap: 10,
    paddingTop: 18,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 44,
  },
  summaryLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  total: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 38,
  },
  note: {
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: "#F6E7A8",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 3,
    borderBottomLeftRadius: 5,
    boxShadow: "1px 3px 0px rgba(58,51,45,0.12)",
    transform: [{ rotate: "0.6deg" }],
  },
  noteTape: {
    position: "absolute",
    left: "50%",
    top: -8,
    width: 52,
    height: 16,
    marginLeft: -26,
  },
  noteText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 23,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 24,
    marginVertical: 18,
    marginHorizontal: 6,
  },
});
