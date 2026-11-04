import { useLocalSearchParams } from "expo-router";

import { EntryFormScreen } from "../../../features/journal/components/EntryFormScreen";

export default function WriteEntryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EntryFormScreen journalId={id} entryId={null} />;
}
