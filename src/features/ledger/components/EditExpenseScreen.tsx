import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import {
  expenseMemberIds,
  toAmountInput,
  type ExpenseStatus,
} from "../../../domain/ledger";
import {
  Button,
  ErrorText,
  MessageScreen,
} from "../../../shared/ui/components";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { useLedgerSummary } from "../hooks/useLedgerQueries";
import { deleteExpense, updateExpense } from "../services/ledgerCommands";
import { ExpenseForm } from "./ExpenseForm";
import { describeError } from "./messages";

export function EditExpenseScreen({
  ledgerId,
  expenseId,
}: {
  ledgerId: string;
  expenseId: string;
}) {
  const deps = useLedgerCommandDeps();
  const { data, error } = useLedgerSummary(ledgerId);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (error) return <MessageScreen text="讀取帳本失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;

  const { members, expenses, ledger, expenseStatuses } = data.value;
  const expense = expenses.find((e) => e.id === expenseId);
  if (!expense) return <MessageScreen text="找不到這筆消費，可能已被刪除" />;

  const status = expenseStatuses.get(expense.id);
  const warning = status ? statusWarning(status) : undefined;

  function confirmDelete() {
    Alert.alert(
      "刪除消費",
      [`確定要刪除「${expense?.title}」嗎？`, warning]
        .filter(Boolean)
        .join("\n"),
      [
        { text: "取消", style: "cancel" },
        { text: "刪除", style: "destructive", onPress: remove },
      ],
    );
  }

  async function remove() {
    setDeleteError(null);
    try {
      const result = await deleteExpense(deps, expenseId);
      if (!result.ok) {
        setDeleteError(describeError(result.error));
        return;
      }
      router.back();
    } catch {
      setDeleteError("刪除失敗，請再試一次");
    }
  }

  const deleteSection = (
    <>
      <ErrorText message={deleteError} />
      <Button title="刪除這筆消費" variant="danger" onPress={confirmDelete} />
    </>
  );

  // 可選成員：未封存的成員，加上原本就在這筆消費裡的封存成員
  const involved = expenseMemberIds(expense);
  const selectable = members.filter(
    (m) => m.archivedAt === null || involved.includes(m.id),
  );

  return (
    <ExpenseForm
      baseCurrency={ledger.baseCurrency}
      members={selectable}
      initial={{
        title: expense.title,
        amountText: toAmountInput(expense.amountMinor, expense.currency),
        currency: expense.currency,
        payerId: expense.payerId,
        split: expense.split,
        category: expense.category,
        occurredAt: expense.occurredAt,
        recordedAt: new Date(expense.createdAt),
        fx: expense.fx,
        note: expense.note,
        placeName: expense.placeName,
        location: expense.location,
      }}
      notice={warning}
      onSubmit={async (input) => {
        const result = await updateExpense(deps, expenseId, input);
        return result.ok ? null : describeError(result.error);
      }}
      footer={deleteSection}
    />
  );
}

function statusWarning(status: ExpenseStatus): string {
  const label = status === "settled" ? "已結清" : "已抵銷";
  return `這筆消費${label}，修改或刪除後會重新計算結餘，可能產生新的欠款。`;
}
