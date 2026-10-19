import { useLocalSearchParams } from "expo-router";

import { LedgerDetailScreen } from "../../../features/ledger/components/LedgerDetailScreen";

export default function LedgerDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LedgerDetailScreen ledgerId={id} />;
}
