import { useLocalSearchParams } from "expo-router";

import { PlaceDetailScreen } from "../../../features/places/components/PlaceDetailScreen";

export default function PlaceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceDetailScreen placeId={id} />;
}
