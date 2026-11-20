import { useLocalSearchParams } from "expo-router";

import { SharePlaceScreen } from "../../../features/places/components/SharePlaceScreen";

export default function SharePlaceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SharePlaceScreen placeId={id} />;
}
