import { useLocalSearchParams } from "expo-router";

import { MapDetailScreen } from "../features/map/components/MapDetailScreen";

export default function MapDetailRoute() {
  // 地球上選取的帳本 id，以逗號分隔
  const { ledgers } = useLocalSearchParams<{ ledgers?: string }>();
  return <MapDetailScreen ledgerIds={ledgers ? ledgers.split(",") : []} />;
}
