import { MessageScreen } from "../../../shared/ui/components";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { usePersonalSelf } from "../hooks/usePersonalQueries";
import { addPersonalExpense } from "../services/personalCommands";
import { ExpenseForm } from "./ExpenseForm";
import { describeError } from "./messages";

export function AddPersonalExpenseScreen() {
  const deps = useLedgerCommandDeps();
  const { self, error } = usePersonalSelf();

  if (error) return <MessageScreen text="讀取個人帳本失敗" />;
  if (!self) return null;

  return (
    <ExpenseForm
      baseCurrency="TWD"
      members={[self]}
      hidePeople
      initial={{
        title: "",
        amountText: "",
        currency: "TWD",
        payerId: self.id,
        split: { kind: "equal", participantIds: [self.id] },
        category: null,
        note: null,
        extras: { placeName: null, location: null },
      }}
      onSubmit={async ({ payerId: _payer, split: _split, ...input }) => {
        const result = await addPersonalExpense(deps, input);
        return result.ok ? null : describeError(result.error);
      }}
    />
  );
}
