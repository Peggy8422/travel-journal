import { useLocalSearchParams } from "expo-router";

import { ExpenseDetailScreen } from "../../features/ledger/components/ExpenseDetailScreen";

export default function ExpenseDetailRoute() {
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>();
  return <ExpenseDetailScreen expenseId={expenseId} />;
}
