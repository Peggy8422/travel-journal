import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

import { savedPlaceNear, type SavedPlaceRecord } from "../../../domain/places";
import { fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";
import { PLACE_COLORS } from "../../map/components/GlobeIndex";
import { PlaceStar } from "../../map/components/MapExpenseRow";
import { prefillParams, type PlacePrefill } from "../services/placeHere";

/**
 * 日記頁、消費明細地點旁邊的小星星：附近（NEARBY_METERS）已經有收藏的地點時是塗色的「已收藏」，
 * 點了打開那個地點；沒有的話是空心的「收藏這裡」，點了打開帶好名稱、座標、類型的收藏表單。
 * places 還沒讀到時不顯示，免得先閃一下「收藏這裡」。
 */
export function SaveHereButton({
  prefill,
  places,
  short = false,
  replace = false,
}: {
  prefill: PlacePrefill;
  places: readonly SavedPlaceRecord[] | undefined;
  /** 窄的地方（日記頁的地點列）只寫「收藏」 */
  short?: boolean;
  /**
   * 打開已收藏的地點時取代目前的畫面：消費明細是 formSheet，
   * 在它上面推一般的頁面會疊在卡片裡
   */
  replace?: boolean;
}) {
  const theme = useTheme();
  if (!places) return null;
  const saved = savedPlaceNear(prefill.location, places);
  const label = saved ? "已收藏" : short ? "收藏" : "收藏這裡";

  function press() {
    if (saved) {
      const target = {
        pathname: "/places/[id]",
        params: { id: saved.id },
      } as const;
      if (replace) router.replace(target);
      else router.push(target);
      return;
    }
    router.push({ pathname: "/places/new", params: prefillParams(prefill) });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        saved
          ? `已收藏「${saved.name}」，打開這個地點`
          : `收藏「${prefill.name}」`
      }
      hitSlop={6}
      onPress={press}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <PlaceStar
        status={saved ? "visited" : "want"}
        color={PLACE_COLORS.deep}
        size={16}
      />
      <Text style={[styles.text, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 34,
    paddingLeft: 8,
    paddingRight: 11,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 15,
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.5)",
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
});
