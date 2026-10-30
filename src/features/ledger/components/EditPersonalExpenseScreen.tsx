import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { toAmountInput } from "../../../domain/ledger";
import {
  ErrorText,
  MessageScreen,
  TextButton,
} from "../../../shared/ui/components";
import { useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { usePersonalExpense } from "../hooks/usePersonalQueries";
import {
  deletePersonalExpense,
  updatePersonalExpense,
} from "../services/personalCommands";
import { ExpenseForm } from "./ExpenseForm";
import { describeError } from "./messages";

/** 只能編輯在個人分頁新增的消費；分帳消費會顯示找不到 */
export function EditPersonalExpenseScreen({
  expenseId,
}: {
  expenseId: string;
}) {
  const theme = useTheme();
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const { data, error } = usePersonalExpense(expenseId);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (error) return <MessageScreen text="讀取個人消費失敗" />;
  if (!data) return null;
  if (!data.found) {
    return <MessageScreen text="找不到這筆個人消費，可能已被刪除" />;
  }
  const { expense, self } = data.found;

  function confirmDelete() {
    Alert.alert("刪除個人消費", `確定要刪除「${expense.title}」嗎？`, [
      { text: "取消", style: "cancel" },
      { text: "刪除", style: "destructive", onPress: remove },
    ]);
  }

  async function remove() {
    setDeleteError(null);
    try {
      const result = await deletePersonalExpense(deps, expenseId);
      if (!result.ok) {
        setDeleteError(describeError(result.error));
        return;
      }
      router.back();
      toast(`刪掉「${expense.title}」了`);
    } catch {
      setDeleteError("刪除失敗，請再試一次");
    }
  }

  return (
    <ExpenseForm
      baseCurrency="TWD"
      members={[self]}
      receiptTitle="個人記帳"
      hidePeople
      initial={{
        title: expense.title,
        amountText: toAmountInput(expense.amountMinor, expense.currency),
        currency: expense.currency,
        payerId: self.id,
        split: { kind: "equal", participantIds: [self.id] },
        category: expense.category,
        occurredAt: expense.occurredAt,
        recordedAt: new Date(expense.createdAt),
        fx: expense.fx,
        note: expense.note,
        placeName: expense.placeName,
        location: expense.location,
      }}
      onSubmit={async ({ payerId: _payer, split: _split, ...input }) => {
        const result = await updatePersonalExpense(deps, expenseId, input);
        if (!result.ok) return describeError(result.error);
        toast(`改好了「${input.title}」`);
        return null;
      }}
      footer={
        <>
          <ErrorText message={deleteError} />
          <TextButton
            title="刪除這筆個人消費"
            color={theme.negative}
            align="center"
            onPress={confirmDelete}
          />
        </>
      }
    />
  );
}
