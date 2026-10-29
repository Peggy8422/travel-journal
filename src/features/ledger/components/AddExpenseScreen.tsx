import { MessageScreen } from "../../../shared/ui/components";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { useLedgerSummary } from "../hooks/useLedgerQueries";
import { addExpense } from "../services/ledgerCommands";
import { ExpenseForm } from "./ExpenseForm";
import { describeError } from "./messages";

export function AddExpenseScreen({ ledgerId }: { ledgerId: string }) {
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const { data, error } = useLedgerSummary(ledgerId);

  if (error) return <MessageScreen text="讀取帳本失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;

  const { members, expenses, ledger } = data.value;
  const active = members.filter((m) => m.archivedAt === null);

  return (
    <ExpenseForm
      baseCurrency={ledger.baseCurrency}
      members={active}
      receiptTitle={ledger.name}
      initial={{
        title: "",
        amountText: "",
        // 預設沿用上一筆消費的幣別，出國時通常連續記同一種外幣
        currency: expenses.at(-1)?.currency ?? ledger.baseCurrency,
        payerId: active[0]?.id,
        split: { kind: "equal", participantIds: active.map((m) => m.id) },
        category: null,
        note: null,
        placeName: null,
        location: null,
      }}
      onSubmit={async (input) => {
        const result = await addExpense(deps, ledgerId, input);
        if (!result.ok) return describeError(result.error);
        toast(`記下「${input.title}」`);
        return null;
      }}
    />
  );
}
