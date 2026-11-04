import { useLocalSearchParams } from "expo-router";

import { EntryFormScreen } from "../../../../../features/journal/components/EntryFormScreen";

export default function EditEntryRoute() {
  const { id, entryId } = useLocalSearchParams<{
    id: string;
    entryId: string;
  }>();
  return <EntryFormScreen journalId={id} entryId={entryId} />;
}
