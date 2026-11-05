import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "../../../shared/ui/fonts";
import {
  InkStamp,
  PaperBackground,
  RuledPaper,
} from "../../../shared/ui/handDrawn";
import { BackButton, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { PlacePinIcon } from "../../journal/components/EntryPlaces";
import {
  PhotoCollage,
  PhotoViewer,
} from "../../journal/components/EntryPhotos";
import { PencilIcon } from "../../journal/components/PencilIcon";
import { describeError } from "../../ledger/components/messages";
import { toLocalIsoString } from "../../ledger/services/localTimestamp";
import { usePlace } from "../hooks/usePlaceQueries";
import type { PlaceDetail } from "../services/placeCommands";
import { PLACE_KIND_STYLES, PLACE_STATUS_LABELS } from "./placeKinds";
import { RatingList, RevisitHeart } from "./PlaceRatings";

const WANT_STAMP = "#3F5F8F";

/**
 * 一個收藏的地點（只能看）：類型、名稱、城市、想去／去過的印章，
 * 去過的話有自己的評分與「還想再去」，下面是心得和照片。右上角「編輯」才進表單。
 * 導覽列隱藏，返回鍵自己畫。
 */
export function PlaceDetailScreen({ placeId }: { placeId: string }) {
  const theme = useTheme();
  const { data, error } = usePlace(placeId);
  if (error) {
    return <PageMessage onBack={router.back} text="讀取地點失敗" />;
  }
  if (!data) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]} />
    );
  }
  if (!data.ok) {
    return (
      <PageMessage onBack={router.back} text={describeError(data.error)} />
    );
  }
  return <Detail detail={data.value} />;
}

function Detail({ detail }: { detail: PlaceDetail }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { place, criteria } = detail;
  const [viewing, setViewing] = useState<number | null>(null);
  const kind = PLACE_KIND_STYLES[place.kind];
  const visited = place.status === "visited";

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
        <BackButton onPress={router.back} />
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/places/[id]/edit",
              params: { id: place.id },
            })
          }
          style={({ pressed }) => [
            styles.edit,
            { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <PencilIcon color={theme.text} size={17} />
          <Text style={[styles.editText, { color: theme.text }]}>編輯</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <RuledPaper marginLine={30} style={styles.page}>
          <View style={styles.head}>
            <View style={styles.headText}>
              <View style={styles.kindRow}>
                <View
                  style={[styles.kindDot, { backgroundColor: kind.color }]}
                />
                <Text style={[styles.kind, { color: theme.textMuted }]}>
                  {kind.label}
                </Text>
              </View>
              <Text
                accessibilityRole="header"
                style={[styles.name, { color: theme.text }]}
              >
                {place.name}
              </Text>
              {place.city !== "" && (
                <View style={styles.cityRow}>
                  <PlacePinIcon size={16} filled />
                  <Text style={[styles.city, { color: theme.text }]}>
                    {place.city}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.stamp}>
              <InkStamp
                size={56}
                label={PLACE_STATUS_LABELS[place.status]}
                color={visited ? theme.primary : WANT_STAMP}
                labelScale={0.36}
              />
            </View>
          </View>

          {visited && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                我的評分
              </Text>
              {place.ratings.length > 0 ? (
                <RatingList ratings={place.ratings} criteria={criteria} />
              ) : (
                <Text style={[styles.muted, { color: theme.textMuted }]}>
                  還沒打分數，按右上角「編輯」打分數。
                </Text>
              )}
              <View style={styles.revisit}>
                <RevisitHeart on={place.revisit} size={20} />
                <Text style={[styles.revisitText, { color: theme.text }]}>
                  {place.revisit ? "還想再去" : "沒有特別想再去"}
                </Text>
              </View>
            </View>
          )}

          {place.note !== "" && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {visited ? "心得" : "想去的理由"}
              </Text>
              <Text selectable style={[styles.note, { color: theme.text }]}>
                {place.note}
              </Text>
            </View>
          )}

          {place.photos.length > 0 && (
            <PhotoCollage
              photos={place.photos}
              tape={kind.color}
              onOpen={setViewing}
            />
          )}

          <Text style={[styles.saved, { color: theme.textMuted }]}>
            {`收藏於 ${toLocalIsoString(new Date(place.createdAt)).slice(0, 10).replace(/-/g, "/")}`}
          </Text>
        </RuledPaper>
      </ScrollView>
      {viewing !== null && (
        <PhotoViewer
          photos={place.photos}
          start={Math.min(viewing, place.photos.length - 1)}
          onClose={() => setViewing(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  edit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 16,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 21,
    borderBottomLeftRadius: 19,
    boxShadow:
      "0px 0px 0px 1.3px rgba(58,51,45,0.55), 1px 2px 0px rgba(58,51,45,0.12)",
  },
  editText: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  page: {
    gap: 22,
    paddingTop: 22,
    paddingRight: 18,
    paddingBottom: 26,
    paddingLeft: 42,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headText: {
    flex: 1,
    gap: 4,
  },
  kindRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kindDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  kind: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 23,
    lineHeight: 31,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  city: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  stamp: {
    marginTop: -4,
    transform: [{ rotate: "-9deg" }],
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
  },
  muted: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  revisit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  revisitText: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 15.5,
    lineHeight: 28,
  },
  saved: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    alignSelf: "flex-end",
  },
});
