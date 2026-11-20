import { useLocalSearchParams } from "expo-router";

import { ShareJournalScreen } from "../../../features/journal/components/ShareJournalScreen";

export default function ShareJournalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShareJournalScreen journalId={id} />;
}
