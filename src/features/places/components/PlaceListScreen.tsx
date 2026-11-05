import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PLACE_KINDS,
  type PlaceKind,
  type PlaceStatus,
  type RatingCriterionRecord,
  type SavedPlaceRecord,
} from "../../../domain/places";
import {
  Button,
  Chip,
  FloatingAddButton,
  Screen,
  SmallButton,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { DashedLine, RuledPaper } from "../../../shared/ui/handDrawn";
import { PageHeader, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { PlacePinIcon } from "../../journal/components/EntryPlaces";
import { DeletedFold } from "../../ledger/components/DeletedExpenses";
import { coverPhotoUri } from "../../ledger/services/appCoverPhotos";
import { usePlaceList } from "../hooks/usePlaceQueries";
import { groupByCity, restorePlace } from "../services/placeCommands";
import { PLACE_KIND_STYLES, PLACE_STATUS_LABELS } from "./placeKinds";
import { ratingSummary, RevisitHeart } from "./PlaceRatings";

type StatusFilter = PlaceStatus | "all";

/**
 * 收藏清單：想去、去過的地點依城市分組，上面可以用狀態和類型篩選，
 * 最下面是「最近刪除」，右下角收藏新的地點。導覽列隱藏，頁首自己畫。
 */
export function PlaceListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = usePlaceList();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<PlaceKind | null>(null);

  if (error) {
    return <PageMessage onBack={router.back} text="讀取收藏清單失敗" />;
  }
  const header = (
    <PageHeader onBack={router.back} kicker="Saved Places" title="收藏清單" />
  );
  const add = () => router.push("/places/new");
  const places = data?.places ?? [];
  const kinds = PLACE_KINDS.filter((k) => places.some((p) => p.kind === k));
  const shown = places.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      (kind === null || p.kind === kind),
  );
  const count = (s: PlaceStatus) => places.filter((p) => p.status === s).length;

  return (
    <View style={styles.fill}>
      <Screen
        header={header}
        contentStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
      >
        {data && places.length === 0 && (
          <RuledPaper style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.text }]}>
              想吃的拉麵、朋友推薦的咖啡廳、下次一定要去的景點……收藏起來，去過之後用自己的標準打分數。
            </Text>
            <Button title="收藏第一個地點" onPress={add} />
          </RuledPaper>
        )}

        {places.length > 0 && (
          <View style={styles.filters}>
            <View style={styles.filterRow}>
              <Chip
                label={`全部 ${places.length}`}
                selected={status === "all"}
                onPress={() => setStatus("all")}
              />
              {(["want", "visited"] as const).map((s) => (
                <Chip
                  key={s}
                  label={`${PLACE_STATUS_LABELS[s]} ${count(s)}`}
                  selected={status === s}
                  onPress={() => setStatus(s)}
                />
              ))}
              <View style={styles.spacer} />
              <SmallButton
                title="評分項目"
                onPress={() => router.push("/places/criteria")}
              />
            </View>
            {kinds.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                <Chip
                  label="全部類型"
                  selected={kind === null}
                  onPress={() => setKind(null)}
                />
                {kinds.map((k) => (
                  <Chip
                    key={k}
                    label={PLACE_KIND_STYLES[k].label}
                    dot={PLACE_KIND_STYLES[k].color}
                    selected={kind === k}
                    onPress={() => setKind(kind === k ? null : k)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {places.length > 0 && shown.length === 0 && (
          <Text style={[styles.none, { color: theme.textMuted }]}>
            沒有符合的地點
          </Text>
        )}

        {groupByCity(shown).map((group) => (
          <View key={group.city} style={styles.group}>
            <View style={styles.cityHead}>
              <PlacePinIcon size={16} color={theme.textMuted} />
              <Text
                accessibilityRole="header"
                style={[styles.city, { color: theme.text }]}
              >
                {group.city || "沒填城市"}
              </Text>
              <Text style={[styles.cityCount, { color: theme.textMuted }]}>
                {group.places.length}
              </Text>
            </View>
            <DashedLine />
            {group.places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                criteria={data?.criteria ?? []}
              />
            ))}
          </View>
        ))}

        <DeletedPlaces deleted={data?.deleted} />
      </Screen>
      {places.length > 0 && (
        <FloatingAddButton
          title="收藏地點"
          bottom={insets.bottom + 18}
          onPress={add}
        />
      )}
    </View>
  );
}

function PlaceCard({
  place,
  criteria,
}: {
  place: SavedPlaceRecord;
  criteria: readonly RatingCriterionRecord[];
}) {
  const theme = useTheme();
  const kind = PLACE_KIND_STYLES[place.kind];
  const visited = place.status === "visited";
  const summary = visited ? ratingSummary(place.ratings, criteria) : null;
  const line = summary ?? (place.note.split("\n")[0] || null);
  const photo = place.photos[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${place.name}，${kind.label}，${PLACE_STATUS_LABELS[place.status]}`}
      onPress={() =>
        router.push({ pathname: "/places/[id]", params: { id: place.id } })
      }
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={styles.cardBody}>
        <View style={styles.meta}>
          <View style={[styles.kindDot, { backgroundColor: kind.color }]} />
          <Text style={[styles.kind, { color: theme.textMuted }]}>
            {kind.label}
          </Text>
          <View
            style={[
              styles.status,
              visited
                ? { backgroundColor: theme.primary }
                : { borderColor: theme.pencil, borderWidth: 1 },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: visited ? theme.onPrimary : theme.textMuted },
              ]}
            >
              {PLACE_STATUS_LABELS[place.status]}
            </Text>
          </View>
          {visited && place.revisit && <RevisitHeart on size={15} />}
        </View>
        <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
          {place.name}
        </Text>
        {line && (
          <Text
            numberOfLines={1}
            style={[styles.line, { color: theme.textMuted }]}
          >
            {line}
          </Text>
        )}
      </View>
      {photo && (
        <Image
          source={{ uri: coverPhotoUri(photo) }}
          contentFit="cover"
          style={styles.thumb}
          accessibilityIgnoresInvertColors
        />
      )}
    </Pressable>
  );
}

function DeletedPlaces({
  deleted,
}: {
  deleted: readonly SavedPlaceRecord[] | undefined;
}) {
  const deps = useLedgerCommandDeps();
  return (
    <DeletedFold
      items={deleted?.map((place) => ({
        id: place.id,
        title: place.name,
        detail: place.city || null,
        deletedAt: place.deletedAt,
      }))}
      unit="個"
      hint="還原後會放回收藏清單"
      restore={(id) => restorePlace(deps, id)}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    gap: 22,
  },
  empty: {
    gap: 16,
    padding: 20,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 26,
  },
  filters: {
    gap: 10,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  spacer: {
    flex: 1,
  },
  none: {
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: "center",
  },
  group: {
    gap: 10,
  },
  cityHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  city: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  cityCount: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 17,
    boxShadow:
      "0px 0px 0px 1.2px rgba(58,51,45,0.22), 1px 2px 0px rgba(58,51,45,0.08)",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kindDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kind: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  status: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  statusText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  line: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 6,
  },
});
