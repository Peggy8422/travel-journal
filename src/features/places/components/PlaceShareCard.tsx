import { Image } from "expo-image";
import type { Ref } from "react";
import { StyleSheet, Text, View } from "react-native";

import type {
  RatingCriterionRecord,
  SavedPlaceRecord,
} from "../../../domain/places";
import { fonts } from "../../../shared/ui/fonts";
import { InkStamp, WashiTape } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { PlacePinIcon } from "../../journal/components/EntryPlaces";
import { coverPhotoUri } from "../../ledger/services/appCoverPhotos";
import { toLocalIsoString } from "../../ledger/services/localTimestamp";
import {
  POLAROID,
  POLAROID_SHADOW,
  ShareCardFrame,
  type ShareCardView,
} from "../../share/components/ShareCardFrame";
import {
  SHARE_CARD_WIDTH,
  shareCardSize,
} from "../../share/services/shareFormat";
import { shareRatings } from "../services/placeShare";
import { PLACE_KIND_STYLES, PLACE_STATUS_LABELS } from "./placeKinds";
import { RevisitHeart, ScoreDots } from "./PlaceRatings";

const WANT_STAMP = "#3F5F8F";
/** 照片框的寬度（卡片左右各留 24） */
const PHOTO_WIDTH = SHARE_CARD_WIDTH - 48;
/** 照片 2:1；分數多或名稱長時壓扁一點，免得蓋到頁尾 */
const PHOTO_HEIGHT = 150;
const RATING_ROW = 24;

/**
 * 收藏地點卡（4:5）：類型、名稱、城市、想去／去過的印章、第一張照片，
 * 去過的話列出分數和「還想再去」，想去的話寫想去的理由。
 */
export function PlaceShareCard({
  ref,
  place,
  criteria,
  onPhotoReady,
}: {
  ref?: Ref<ShareCardView>;
  place: SavedPlaceRecord;
  criteria: readonly RatingCriterionRecord[];
  onPhotoReady?: (index: number) => void;
}) {
  const theme = useTheme();
  const kind = PLACE_KIND_STYLES[place.kind];
  const visited = place.status === "visited";
  const ratings = visited ? shareRatings(place, criteria) : [];
  const photo = place.photos[0];
  // About ten characters fit on a line next to the stamp
  const longName = place.name.length > 10;
  const photoHeight =
    PHOTO_HEIGHT -
    RATING_ROW * Math.max(0, ratings.length - 3) -
    (longName ? 30 : 0);
  const note = place.note.trim();

  return (
    <ShareCardFrame
      ref={ref}
      height={shareCardSize("post").height}
      swatch={kind.color}
      footerName="我的收藏"
      footerDate={toLocalIsoString(new Date(place.createdAt))
        .slice(0, 10)
        .replace(/-/g, ".")}
    >
      <View style={styles.body}>
        <View style={styles.kindRow}>
          <View style={[styles.kindDot, { backgroundColor: kind.color }]} />
          <Text style={[styles.kind, { color: theme.textMuted }]}>
            {kind.label}
          </Text>
        </View>
        <Text numberOfLines={2} style={[styles.name, { color: theme.text }]}>
          {place.name}
        </Text>
        {place.city !== "" && (
          <View style={styles.cityRow}>
            <PlacePinIcon size={15} filled />
            <Text style={[styles.city, { color: theme.text }]}>
              {place.city}
            </Text>
          </View>
        )}

        {photo !== undefined ? (
          <View style={styles.polaroid}>
            <Image
              source={{ uri: coverPhotoUri(photo) }}
              contentFit="cover"
              style={{ width: "100%", height: photoHeight }}
              onLoad={() => onPhotoReady?.(0)}
              onError={() => onPhotoReady?.(0)}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.tape}>
              <WashiTape color={kind.color} opacity={0.8} />
            </View>
          </View>
        ) : (
          note !== "" && (
            // No photo: the note sits where the photo would
            <View style={styles.polaroid}>
              <Text
                numberOfLines={ratings.length > 0 ? 4 : 7}
                style={[styles.noteSlip, { color: theme.text }]}
              >
                {note}
              </Text>
              <View style={styles.tape}>
                <WashiTape color={kind.color} opacity={0.8} />
              </View>
            </View>
          )
        )}

        {ratings.length > 0 && (
          <View style={styles.ratings}>
            {ratings.map((rating) => (
              <View key={rating.label} style={styles.ratingRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.ratingLabel, { color: theme.text }]}
                >
                  {rating.label}
                </Text>
                <ScoreDots
                  score={rating.score}
                  label={rating.label}
                  size={16}
                />
              </View>
            ))}
          </View>
        )}
        {visited && place.revisit && (
          <View style={styles.revisit}>
            <RevisitHeart on size={18} />
            <Text style={[styles.revisitText, { color: theme.text }]}>
              還想再去
            </Text>
          </View>
        )}
        {photo !== undefined && ratings.length === 0 && note !== "" && (
          <Text
            numberOfLines={visited && place.revisit ? 3 : 4}
            style={[styles.note, { color: theme.text }]}
          >
            {note}
          </Text>
        )}
      </View>
      <View style={styles.stamp}>
        <InkStamp
          size={58}
          label={PLACE_STATUS_LABELS[place.status]}
          color={visited ? theme.primary : WANT_STAMP}
          labelScale={0.34}
        />
      </View>
    </ShareCardFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: 22,
    paddingHorizontal: 24,
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
    fontSize: 13,
  },
  name: {
    marginTop: 4,
    paddingRight: 76,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 30,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  city: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  stamp: {
    position: "absolute",
    right: 22,
    top: 22,
    transform: [{ rotate: "-9deg" }],
  },
  polaroid: {
    width: PHOTO_WIDTH,
    marginTop: 16,
    padding: 7,
    backgroundColor: POLAROID,
    boxShadow: POLAROID_SHADOW,
    transform: [{ rotate: "1deg" }],
  },
  tape: {
    position: "absolute",
    left: 22,
    top: -9,
    width: 58,
    height: 17,
    transform: [{ rotate: "-4deg" }],
  },
  noteSlip: {
    paddingTop: 12,
    paddingHorizontal: 10,
    paddingBottom: 8,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 24,
  },
  ratings: {
    marginTop: 14,
    gap: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: RATING_ROW - 4,
  },
  ratingLabel: {
    width: 56,
    fontFamily: fonts.regular,
    fontSize: 14.5,
  },
  revisit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
  },
  revisitText: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  note: {
    marginTop: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 23,
  },
});
