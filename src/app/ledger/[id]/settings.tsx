import { useLocalSearchParams } from "expo-router";

import { LedgerSettingsScreen } from "../../../features/ledger/components/LedgerSettingsScreen";

export default function LedgerSettingsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LedgerSettingsScreen ledgerId={id} />;
}
