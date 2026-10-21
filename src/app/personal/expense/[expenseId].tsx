import { useLocalSearchParams } from "expo-router";

import { EditPersonalExpenseScreen } from "../../../features/ledger/components/EditPersonalExpenseScreen";

export default function EditPersonalExpenseRoute() {
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  return <EditPersonalExpenseScreen expenseId={expenseId} />;
}
