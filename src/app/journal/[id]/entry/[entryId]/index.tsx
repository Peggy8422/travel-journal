import { useLocalSearchParams } from "expo-router";

import { JournalEntryScreen } from "../../../../../features/journal/components/JournalEntryScreen";

export default function JournalEntryRoute() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return <JournalEntryScreen entryId={entryId} />;
}
