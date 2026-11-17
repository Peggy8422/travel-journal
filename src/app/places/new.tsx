import { useLocalSearchParams } from "expo-router";

import { PlaceFormScreen } from "../../features/places/components/PlaceFormScreen";
import {
  parsePrefill,
  type PrefillParams,
} from "../../features/places/services/placeHere";

export default function NewPlaceRoute() {
  // 從日記、消費「收藏這裡」打開時帶著名稱、座標與類型
  const params = useLocalSearchParams<Partial<PrefillParams>>();
  return <PlaceFormScreen placeId={null} prefill={parsePrefill(params)} />;
}
