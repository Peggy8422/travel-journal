import { useLocalSearchParams } from "expo-router";

import { AddExpenseScreen } from "../../../features/ledger/components/AddExpenseScreen";

export default function AddExpenseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AddExpenseScreen ledgerId={id} />;
}
