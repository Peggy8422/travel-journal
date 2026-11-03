import { useLocalSearchParams } from "expo-router";

import { JournalBookScreen } from "../../../features/journal/components/JournalBookScreen";

export default function JournalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <JournalBookScreen journalId={id} />;
}
