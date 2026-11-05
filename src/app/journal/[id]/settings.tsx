import { useLocalSearchParams } from "expo-router";

import { JournalSettingsScreen } from "../../../features/journal/components/JournalSettingsScreen";

export default function JournalSettingsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <JournalSettingsScreen journalId={id} />;
}
