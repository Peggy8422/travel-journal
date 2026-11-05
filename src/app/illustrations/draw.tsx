import { useLocalSearchParams } from "expo-router";

import { DrawingScreen } from "../../features/journal/components/DrawingScreen";

/** 沒有 id 是畫新的插圖，有 id 是改畫那一張 */
export default function DrawIllustrationRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <DrawingScreen illustrationId={id ?? null} />;
}
