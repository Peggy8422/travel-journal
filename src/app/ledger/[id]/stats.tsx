import { useLocalSearchParams } from "expo-router";

import { LedgerStatsScreen } from "../../../features/ledger/components/LedgerStatsScreen";

export default function LedgerStatsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LedgerStatsScreen ledgerId={id} />;
}
