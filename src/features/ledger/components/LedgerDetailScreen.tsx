import { router, Stack } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import {
  formatMinorAmount,
  type ExpenseStatus,
  type Transfer,
} from "../../../domain/ledger";
import {
  Button,
  ErrorText,
  Label,
  MessageScreen,
  Row,
  Screen,
  Section,
} from "../../../shared/ui/components";
import { useTheme } from "../../../shared/ui/theme";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { useLedgerSummary } from "../hooks/useLedgerQueries";
import { addSettlement } from "../services/ledgerCommands";
import {
  formatLocalDateTime,
  toLocalIsoString,
} from "../services/localTimestamp";
import { describeError } from "./messages";

export function LedgerDetailScreen({ ledgerId }: { ledgerId: string }) {
  const theme = useTheme();
  const deps = useLedgerCommandDeps();
  const { data, error, reload } = useLedgerSummary(ledgerId);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <MessageScreen text="讀取帳本失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;

  const summary = data.value;
  const base = summary.ledger.baseCurrency;
  const nameOf = (id: string) =>
    summary.members.find((m) => m.id === id)?.name ?? "?";

  function confirmSettlement(transfer: Transfer) {
    const amount = `${base} ${formatMinorAmount(transfer.amountMinor, base)}`;
    Alert.alert(
      "記錄還款",
      `${nameOf(transfer.fromId)} 已還給 ${nameOf(transfer.toId)} ${amount}？`,
      [
        { text: "取消", style: "cancel" },
        { text: "記錄", onPress: () => recordSettlement(transfer) },
      ],
    );
  }

  async function recordSettlement(transfer: Transfer) {
    setActionError(null);
    try {
      const result = await addSettlement(deps, ledgerId, {
        ...transfer,
        settledAt: toLocalIsoString(new Date()),
      });
      if (!result.ok) setActionError(describeError(result.error));
      reload();
    } catch {
      setActionError("記錄失敗，請再試一次");
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: summary.ledger.name }} />

      <Button
        title="新增消費"
        onPress={() =>
          router.push({
            pathname: "/ledger/[id]/add-expense",
            params: { id: ledgerId },
          })
        }
      />
      <ErrorText message={actionError} />

      <Section title="結餘（正數代表別人欠他）">
        {summary.members.map((member) => {
          const balance = summary.balances.get(member.id) ?? 0;
          const color =
            balance > 0
              ? theme.positive
              : balance < 0
                ? theme.negative
                : theme.textMuted;
          return (
            <Row key={member.id}>
              <Label>
                {member.name}
                {member.archivedAt && "（已封存）"}
              </Label>
              <Label color={color}>
                {balance > 0 ? "+" : ""}
                {formatMinorAmount(balance, base)}
              </Label>
            </Row>
          );
        })}
      </Section>

      <Section title="還款建議">
        {summary.transfers.length === 0 && <Label muted>目前沒有欠款</Label>}
        {summary.transfers.map((transfer) => (
          <Row key={`${transfer.fromId}-${transfer.toId}`}>
            <View style={{ flex: 1 }}>
              <Label>
                {nameOf(transfer.fromId)} → {nameOf(transfer.toId)}
              </Label>
              <Label muted>
                {base} {formatMinorAmount(transfer.amountMinor, base)}
              </Label>
            </View>
            <Button
              title="記錄還款"
              variant="secondary"
              onPress={() => confirmSettlement(transfer)}
            />
          </Row>
        ))}
      </Section>

      {summary.settlements.length > 0 && (
        <Section title="還款紀錄">
          {[...summary.settlements].reverse().map((settlement) => (
            <Row key={settlement.id}>
              <View style={{ flex: 1 }}>
                <Label>
                  {nameOf(settlement.fromId)} → {nameOf(settlement.toId)}
                </Label>
                <Label muted>{formatLocalDateTime(settlement.settledAt)}</Label>
              </View>
              <Label>
                {base} {formatMinorAmount(settlement.amountMinor, base)}
              </Label>
            </Row>
          ))}
        </Section>
      )}

      <Section title="消費">
        {summary.expenses.length === 0 && <Label muted>還沒有消費</Label>}
        {[...summary.expenses].reverse().map((expense) => (
          <Row key={expense.id}>
            <View style={{ flex: 1 }}>
              <Label>{expense.title}</Label>
              <Label muted>
                {formatLocalDateTime(expense.occurredAt)} ·{" "}
                {nameOf(expense.payerId)} 付款
              </Label>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Label>
                {expense.currency}{" "}
                {formatMinorAmount(expense.amountMinor, expense.currency)}
              </Label>
              <ExpenseStatusLabel
                status={summary.expenseStatuses.get(expense.id)}
              />
            </View>
          </Row>
        ))}
      </Section>
    </Screen>
  );
}

function ExpenseStatusLabel({ status }: { status?: ExpenseStatus }) {
  const theme = useTheme();
  if (status === "settled") return <Label color={theme.positive}>已結清</Label>;
  if (status === "offset") return <Label muted>已抵銷</Label>;
  return null;
}
