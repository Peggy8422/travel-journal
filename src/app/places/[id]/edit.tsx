import { useLocalSearchParams } from "expo-router";

import { PlaceFormScreen } from "../../../features/places/components/PlaceFormScreen";

export default function EditPlaceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceFormScreen placeId={id} />;
}
