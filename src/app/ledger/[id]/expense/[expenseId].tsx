import { useLocalSearchParams } from "expo-router";

import { EditExpenseScreen } from "../../../../features/ledger/components/EditExpenseScreen";

export default function EditExpenseRoute() {
  const { id, expenseId } = useLocalSearchParams<{
    id: string;
    expenseId: string;
  }>();
  return <EditExpenseScreen ledgerId={id} expenseId={expenseId} />;
}
