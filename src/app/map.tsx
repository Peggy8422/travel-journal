import { useLocalSearchParams } from "expo-router";

import { MapDetailScreen } from "../features/map/components/MapDetailScreen";

export default function MapDetailRoute() {
  // 地球上選取的帳本 id，以逗號分隔；date 是一打開就只看的那一天（YYYY-MM-DD）
  const { ledgers, date } = useLocalSearchParams<{
    ledgers?: string;
    date?: string;
  }>();
  return (
    <MapDetailScreen
      ledgerIds={ledgers ? ledgers.split(",") : []}
      initialDate={date}
    />
  );
}
