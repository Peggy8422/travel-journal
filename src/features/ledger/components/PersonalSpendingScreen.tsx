import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import {
  formatMinorAmount,
  shiftMonth,
  summarizePersonalMonth,
  type PersonalEntry,
} from "../../../domain/ledger";
import {
  Button,
  Label,
  MessageScreen,
  Row,
  Screen,
  Section,
} from "../../../shared/ui/components";
import { usePersonalSpending } from "../hooks/usePersonalQueries";
import { groupByLocalDay } from "../services/expenseListView";
import {
  formatLocalDate,
  formatLocalDateTime,
  toLocalIsoString,
} from "../services/localTimestamp";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { categoryLabel } from "./categories";
import { describeError } from "./messages";

/** 個人花費一律以新台幣計算（所有帳本的基準幣） */
const BASE = "TWD";

/**
 * 個人記帳：「我」在個人消費與各分帳帳本裡實際負擔的花費，依月份查看。
 * 只能編輯在這裡新增的個人消費；分帳消費要回原本的帳本修改。
 */
export function PersonalSpendingScreen() {
  const { data, error } = usePersonalSpending();
  const [month, setMonth] = useState(() =>
    toLocalIsoString(new Date()).slice(0, 7),
  );

  if (error) return <MessageScreen text="讀取個人花費失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;

  const { entries, ledgersWithoutSelf } = data.value;
  const summary = summarizePersonalMonth(entries, month);
  const money = (minor: number) => `${BASE} ${formatMinorAmount(minor, BASE)}`;
  const entryById = new Map(summary.entries.map((e) => [e.expense.id, e]));
  const days = groupByLocalDay(
    summary.entries.map((e) => e.expense),
    new Map(summary.entries.map((e) => [e.expense.id, e.myShareMinor])),
  );

  return (
    <Screen>
      <Row>
        <Button
          title="‹"
          variant="secondary"
          onPress={() => setMonth(shiftMonth(month, -1))}
        />
        <Label>
          {month.slice(0, 4)} 年 {Number(month.slice(5, 7))} 月
        </Label>
        <Button
          title="›"
          variant="secondary"
          onPress={() => setMonth(shiftMonth(month, 1))}
        />
      </Row>

      <Section title="本月花費">
        <Label>{money(summary.totalMinor)}</Label>
        <Label muted>
          個人 {money(summary.personalMinor)} · 分帳負擔{" "}
          {money(summary.sharedMinor)}
        </Label>
      </Section>

      <Button
        title="新增個人消費"
        onPress={() => router.push("/personal/add-expense")}
      />

      {ledgersWithoutSelf.length > 0 && (
        <Label muted>
          有 {ledgersWithoutSelf.length} 本帳本還沒指定「我是誰」（
          {ledgersWithoutSelf.map((l) => l.name).join("、")}
          ），這些帳本的消費不會算進個人花費。可以到帳本設定指定。
        </Label>
      )}

      {summary.totalMinor > 0 && (
        <CategoryBreakdown
          categories={summary.categories}
          totalMinor={summary.totalMinor}
          currency={BASE}
          centerLabel="本月花費"
        />
      )}

      {days.length === 0 && <Label muted>這個月還沒有花費</Label>}
      {days.map((day) => (
        <Section
          key={day.date}
          title={`${formatLocalDate(day.date)} · ${money(day.totalBaseMinor)}`}
        >
          {day.expenses.map((expense) => {
            const entry = entryById.get(expense.id);
            return entry ? (
              <PersonalRow key={expense.id} entry={entry} money={money} />
            ) : null;
          })}
        </Section>
      ))}
    </Screen>
  );
}

function PersonalRow({
  entry,
  money,
}: {
  entry: PersonalEntry;
  money: (minor: number) => string;
}) {
  const { expense } = entry;
  const editable = entry.source === "personal";
  const source = editable ? "個人" : `${entry.ledger.name}（分帳）`;

  const content = (
    <Row>
      <View style={{ flex: 1 }}>
        <Label>{expense.title}</Label>
        <Label muted>
          {formatLocalDateTime(expense.occurredAt).split(" ")[1]} · {source}
          {expense.category !== null && ` · ${categoryLabel(expense.category)}`}
        </Label>
        {expense.note !== null && <Label muted>備註：{expense.note}</Label>}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Label>{money(entry.myShareMinor)}</Label>
        {editable && expense.currency !== BASE && (
          <Label muted>
            {expense.currency}{" "}
            {formatMinorAmount(expense.amountMinor, expense.currency)}
          </Label>
        )}
        {!editable && <Label muted>我的負擔</Label>}
      </View>
    </Row>
  );

  // 分帳消費不能在個人分頁修改
  if (!editable) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="編輯或刪除這筆個人消費"
      onPress={() =>
        router.push({
          pathname: "/personal/expense/[expenseId]",
          params: { expenseId: expense.id },
        })
      }
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      {content}
    </Pressable>
  );
}
