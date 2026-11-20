import { useLocalSearchParams } from "expo-router";

import { ShareEntryScreen } from "../../../../../features/journal/components/ShareEntryScreen";

export default function ShareEntryRoute() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  return <ShareEntryScreen entryId={entryId} />;
}
