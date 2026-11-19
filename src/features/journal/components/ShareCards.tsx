import { Image } from "expo-image";
import type { ComponentRef, ReactNode, Ref } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Pattern,
  Rect,
} from "react-native-svg";

import type { JournalTape } from "../../../domain/journal";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import {
  DashedLine,
  PaperBackground,
  RuledPaper,
  WashiTape,
} from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { coverPhotoUri } from "../../ledger/services/appCoverPhotos";
import type { EntryDetail } from "../services/entryCommands";
import { entryHeading, weekdayOf } from "../services/journalDates";
import {
  dottedDate,
  photoCaption,
  scaleBar,
  shareStickerIds,
  sketchPoints,
  type ShareFormat,
  type SharePage,
} from "../services/shareEntry";
import { PlacePinIcon } from "./EntryPlaces";
import { aspectOf, IllustrationArt } from "./IllustrationArt";
import { JournalStamp } from "./JournalStamp";
import { KRAFT, TAPE_COLORS } from "./tapes";

/*
 * 分享到 IG 的卡片（設計稿的「分享卡」）。貼文用 360×450、限動用 360×640 的版面畫，
 * 存成圖片時放大成 1080 寬，所以這裡的尺寸都是固定值，不跟著螢幕寬度變。
 */

/** 卡片版面的寬度；高度依格式（shareCardSize） */
export const SHARE_CARD_WIDTH = 360;
/** 存成圖片的像素寬度 */
export const SHARE_IMAGE_WIDTH = 1080;

/** 卡片版面的高度與存成圖片的像素高度：貼文 4:5、限動 9:16 */
export function shareCardSize(format: ShareFormat): {
  height: number;
  pixelHeight: number;
} {
  return format === "story"
    ? { height: 640, pixelHeight: 1920 }
    : { height: 450, pixelHeight: 1350 };
}

/** 要存成圖片的那個 View */
export type ShareCardView = ComponentRef<typeof View>;

const POLAROID = "#FFFDF8";
const FOOTER_INK = "#6E645A";
const POLAROID_SHADOW =
  "0px 0px 0px 0.8px rgba(58,51,45,0.16), 2px 6px 14px rgba(58,51,45,0.2)";

/**
 * 一頁分享卡。ref 指到要存成圖片的那個 View。
 * onPhotoReady 在卡片上第幾張照片（sharePagePhotos 的順序）載入完或載入失敗時呼叫，
 * 照片都載入完才存得到。
 */
export function ShareCard({
  ref,
  detail,
  page,
  onPhotoReady,
}: {
  ref?: Ref<ShareCardView>;
  detail: EntryDetail;
  page: SharePage;
  onPhotoReady?: (index: number) => void;
}) {
  const { journal, entry } = detail;
  const story = page.kind === "story";
  return (
    <CardFrame
      ref={ref}
      height={shareCardSize(story ? "story" : "post").height}
      tape={journal.cover.tape}
      footerName={journal.name}
      // The story keeps the bottom quiet for IG's reply bar
      footerDate={story ? null : dottedDate(entry.date)}
    >
      {page.kind === "cover" ? (
        <CoverPage detail={detail} onReady={() => onPhotoReady?.(0)} />
      ) : page.kind === "photo" ? (
        <PhotoPage
          detail={detail}
          photo={page.photo}
          index={page.index}
          onReady={() => onPhotoReady?.(0)}
        />
      ) : page.kind === "text" ? (
        <TextPage detail={detail} />
      ) : page.kind === "places" ? (
        <PlacesPage detail={detail} />
      ) : (
        <StoryPage detail={detail} onPhotoReady={onPhotoReady} />
      )}
    </CardFrame>
  );
}

/** 方眼和紙底，頁尾寫手帳名稱和日期（沒有日期時名稱置中） */
function CardFrame({
  ref,
  height,
  tape,
  footerName,
  footerDate,
  children,
}: {
  ref?: Ref<ShareCardView>;
  height: number;
  tape: JournalTape;
  footerName: string;
  footerDate: string | null;
  children: ReactNode;
}) {
  const theme = useTheme();
  const swatch = (
    <View
      style={[styles.footerTape, { backgroundColor: TAPE_COLORS[tape].color }]}
    />
  );
  return (
    <View
      ref={ref}
      // Android drops views that only lay out children; captureRef needs a real one
      collapsable={false}
      style={[styles.card, { height, backgroundColor: theme.background }]}
    >
      <PaperBackground />
      {children}
      {footerDate !== null ? (
        <View style={styles.footer}>
          <View style={styles.footerName}>
            {swatch}
            <Text numberOfLines={1} style={styles.footerText}>
              {footerName}
            </Text>
          </View>
          <Text style={styles.footerDate}>{footerDate}</Text>
        </View>
      ) : (
        <View style={[styles.footer, styles.storyFooter]}>
          {swatch}
          <Text numberOfLines={1} style={[styles.footerText, styles.storyName]}>
            {footerName}
          </Text>
        </View>
      )}
    </View>
  );
}

/** ① 封面：Day、日期、印章、第一張照片、標題與去過的地方 */
function CoverPage({
  detail,
  onReady,
}: {
  detail: EntryDetail;
  onReady?: () => void;
}) {
  const theme = useTheme();
  const { journal, entry, dayNumber } = detail;
  const photo = entry.photos[0];
  const places = entry.places.map((place) => place.name).join("、");
  return (
    <View style={styles.cover}>
      <View style={styles.coverHead}>
        <View style={styles.coverDate}>
          <Text style={[styles.dayN, { color: theme.primary }]}>
            Day {dayNumber}
          </Text>
          <Text style={[styles.dateLabel, { color: theme.text }]}>
            {longDate(entry.date)}
          </Text>
        </View>
        <View style={styles.stamps}>
          {entry.weather && (
            <JournalStamp code={entry.weather} size={50} tilt={-8} />
          )}
          {entry.mood && <JournalStamp code={entry.mood} size={50} tilt={6} />}
        </View>
      </View>

      {photo !== undefined ? (
        <View style={styles.coverPhotoArea}>
          <View style={styles.coverPolaroid}>
            <Image
              source={{ uri: coverPhotoUri(photo) }}
              contentFit="cover"
              style={styles.coverImage}
              onLoad={onReady}
              onError={onReady}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.coverTape}>
              <WashiTape color={TAPE_COLORS[journal.cover.tape].color} />
            </View>
          </View>
        </View>
      ) : entry.body !== "" ? (
        // No photo: a slip of the diary text takes the photo's place
        <View style={styles.coverPhotoArea}>
          <View style={styles.coverNote}>
            <Text
              numberOfLines={7}
              style={[styles.coverNoteText, { color: theme.text }]}
            >
              {entry.body}
            </Text>
            <View style={styles.coverTape}>
              <WashiTape color={TAPE_COLORS[journal.cover.tape].color} />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.coverSpacer} />
      )}

      <Text
        numberOfLines={2}
        style={[styles.coverTitle, { color: theme.text }]}
      >
        {entryHeading(entry)}
      </Text>
      {places !== "" && (
        <View style={styles.coverPlaces}>
          <PlacePinIcon size={15} filled />
          <Text
            numberOfLines={1}
            style={[styles.coverPlacesText, { color: theme.textMuted }]}
          >
            {places}
          </Text>
        </View>
      )}
    </View>
  );
}

/** ② 照片頁：一張照片一頁，拍立得框對角貼兩條紙膠帶 */
function PhotoPage({
  detail,
  photo,
  index,
  onReady,
}: {
  detail: EntryDetail;
  photo: string;
  index: number;
  onReady?: () => void;
}) {
  const theme = useTheme();
  const { journal, entry, dayNumber } = detail;
  const tape = journal.cover.tape;
  // The second strip contrasts with the journal's own tape
  const other = tape === "yamabuki" ? "sakura" : "yamabuki";
  return (
    <View
      style={[
        styles.photoPolaroid,
        // Alternate the tilt so a carousel does not look stamped out
        { transform: [{ rotate: index % 2 ? "-1.6deg" : "1.8deg" }] },
      ]}
    >
      <Image
        source={{ uri: coverPhotoUri(photo) }}
        contentFit="cover"
        style={styles.photoImage}
        onLoad={onReady}
        onError={onReady}
        accessibilityIgnoresInvertColors
      />
      <Text style={[styles.photoCaption, { color: theme.textMuted }]}>
        {photoCaption(dayNumber, entry.date)}
      </Text>
      <View style={[styles.cornerTape, styles.cornerTapeTop]}>
        <WashiTape color={TAPE_COLORS[tape].color} />
      </View>
      <View style={[styles.cornerTape, styles.cornerTapeBottom]}>
        <WashiTape color={TAPE_COLORS[other].color} />
      </View>
    </View>
  );
}

/** ③ 文字頁：橫線紙上寫日記內文，角落放日記上貼的插圖 */
function TextPage({ detail }: { detail: EntryDetail }) {
  const theme = useTheme();
  const { entry, dayNumber, illustrations } = detail;
  const stickers = shareStickerIds(entry.stickers, illustrations);
  return (
    <RuledPaper marginLine={28} style={styles.textSheet}>
      <Text style={[styles.textDay, { color: theme.primary }]}>
        {photoCaption(dayNumber, entry.date)}
      </Text>
      <Text numberOfLines={2} style={[styles.textTitle, { color: theme.text }]}>
        {entryHeading(entry)}
      </Text>
      <Text
        // Leave the corner to the stickers
        numberOfLines={stickers.length > 0 ? 8 : 10}
        style={[styles.textBody, { color: theme.text }]}
      >
        {entry.body}
      </Text>
      {stickers.map((id, i) => {
        const spot = TEXT_STICKER_SPOTS[i]!;
        const aspect = aspectOf(illustrations[id]!.strokes);
        const width = aspect > 1 ? spot.size / aspect : spot.size;
        const height = aspect > 1 ? spot.size : spot.size * aspect;
        return (
          <View
            key={id}
            style={[
              styles.textSticker,
              {
                right: spot.right,
                bottom: spot.bottom,
                transform: [{ rotate: `${spot.tilt}deg` }],
              },
            ]}
          >
            <IllustrationArt
              strokes={illustrations[id]!.strokes}
              width={width}
              height={height}
              paper={POLAROID}
            />
          </View>
        );
      })}
    </RuledPaper>
  );
}

/** 文字頁插圖的位置：最上面那張大一點放在右下角，下一張在它左邊 */
const TEXT_STICKER_SPOTS = [
  { right: 14, bottom: 12, size: 88, tilt: 10 },
  { right: 108, bottom: 16, size: 64, tilt: -6 },
] as const;

/** 地點頁草圖的大小 */
const SKETCH_WIDTH = SHARE_CARD_WIDTH - 44;
const SKETCH_HEIGHT = 210;
/** 地點頁最多列幾個地點，再多就寫「還有 N 個地方」 */
const PLACE_ROWS = 3;

/** 地點頁最多幾個地點時在圖釘旁寫地名，再多就只標號碼（地名看下面的清單） */
const LABELED_PLACES = 4;
/** 地名標籤最寬多少，靠右邊的圖釘把標籤放在左邊 */
const LABEL_WIDTH = 104;
const MAP_PAPER = "#F5ECD9";

/**
 * ④ 地點頁：摺過的手繪地圖紙上，照經緯度畫出路線、標上號碼和地名，
 * 左下角是照實際距離算的比例尺；下面列出地名。
 * 不畫河流、街道：那些是設計稿的示意，實際的地點附近不一定有。
 */
function PlacesPage({ detail }: { detail: EntryDetail }) {
  const theme = useTheme();
  const { journal, entry, dayNumber } = detail;
  const { points, metersPerUnit } = sketchPoints(
    entry.places.map((place) => place.location),
    { width: SKETCH_WIDTH, height: SKETCH_HEIGHT, padding: 34 },
  );
  const scale = scaleBar(metersPerUnit, 80);
  const wash = TAPE_COLORS[journal.cover.tape].color;
  const route = routePath(points);
  const rows =
    entry.places.length > PLACE_ROWS
      ? entry.places.slice(0, PLACE_ROWS - 1)
      : entry.places;
  const more = entry.places.length - rows.length;
  return (
    <View style={styles.places}>
      <View style={styles.placesHead}>
        <Text style={[styles.placesTitle, { color: theme.text }]}>
          去過的地方
        </Text>
        <Text style={[styles.placesDay, { color: theme.primary }]}>
          {photoCaption(dayNumber, entry.date)}
        </Text>
      </View>
      <View style={styles.sketch}>
        {/* Clip only the drawing: overflow hidden on the box would also clip its shadow */}
        <View style={styles.sketchClip}>
          <Svg width={SKETCH_WIDTH} height={SKETCH_HEIGHT}>
            <MapPaper />
            {/* Watercolour wash under the route; one group so overlaps stay even */}
            <G opacity={0.24}>
              <Path
                d={route}
                fill="none"
                stroke={wash}
                strokeWidth={24}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((point, i) => (
                <Circle key={i} cx={point.x} cy={point.y} r={21} fill={wash} />
              ))}
            </G>
            <Path
              d={route}
              fill="none"
              stroke={KRAFT.band}
              strokeWidth={2}
              strokeDasharray="1 7"
              strokeLinecap="round"
            />
            <Circle
              cx={SKETCH_WIDTH - 34}
              cy={34}
              r={15}
              fill={MAP_PAPER}
              stroke="rgba(58,51,45,0.6)"
              strokeWidth={1.2}
            />
            <Path
              d={`M${SKETCH_WIDTH - 34} 22 L${SKETCH_WIDTH - 30} 34 L${SKETCH_WIDTH - 34} 46 L${SKETCH_WIDTH - 38} 34 Z`}
              fill="rgba(58,51,45,0.55)"
            />
            {scale && (
              <Path
                d={`M14 ${SKETCH_HEIGHT - 20} v6 h${scale.length} v-6`}
                fill="none"
                stroke="rgba(58,51,45,0.7)"
                strokeWidth={1.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        </View>
        <Text style={[styles.north, { left: SKETCH_WIDTH - 34 - 4 }]}>N</Text>
        {scale && (
          <Text
            style={[
              styles.scaleLabel,
              { left: 14 + scale.length + 6, color: theme.textMuted },
            ]}
          >
            {scale.label}
          </Text>
        )}
        {entry.places.length <= LABELED_PLACES &&
          points.map((point, i) => {
            const onLeft = point.x > SKETCH_WIDTH - LABEL_WIDTH - 24;
            return (
              <Text
                key={`label-${i}`}
                numberOfLines={1}
                style={[
                  styles.pinLabel,
                  { top: point.y - 9, color: theme.text },
                  onLeft
                    ? { right: SKETCH_WIDTH - point.x + 18, textAlign: "right" }
                    : { left: point.x + 18 },
                ]}
              >
                {entry.places[i]!.name}
              </Text>
            );
          })}
        {points.map((point, i) => (
          <View
            key={i}
            style={[styles.pin, { left: point.x - 14, top: point.y - 14 }]}
          >
            <Text style={styles.pinNumber}>{i + 1}</Text>
          </View>
        ))}
      </View>
      <View style={styles.placeList}>
        {rows.map((place, i) => (
          <View key={i}>
            <View style={styles.placeRow}>
              <View style={styles.placeBadge}>
                <Text style={styles.placeBadgeText}>{i + 1}</Text>
              </View>
              <Text
                numberOfLines={1}
                style={[styles.placeName, { color: theme.text }]}
              >
                {place.name}
              </Text>
            </View>
            <DashedLine dotted opacity={0.3} />
          </View>
        ))}
        {more > 0 && (
          <Text style={[styles.placeMore, { color: theme.textMuted }]}>
            還有 {more} 個地方
          </Text>
        )}
      </View>
    </View>
  );
}

/** 摺過的地圖紙：淡淡的方格，直的兩道、橫的一道摺痕，摺出來的一格稍微暗一點 */
function MapPaper() {
  const folds = [SKETCH_WIDTH / 3, (SKETCH_WIDTH * 2) / 3];
  const middle = SKETCH_HEIGHT / 2;
  return (
    <>
      <Defs>
        <Pattern
          id="mapGrid"
          patternUnits="userSpaceOnUse"
          width={22}
          height={22}
        >
          <Rect width={22} height={1} fill="rgba(110,90,70,0.09)" />
          <Rect width={1} height={22} fill="rgba(110,90,70,0.09)" />
        </Pattern>
      </Defs>
      <Rect width={SKETCH_WIDTH} height={SKETCH_HEIGHT} fill="url(#mapGrid)" />
      <Rect
        x={folds[0]}
        width={folds[1]! - folds[0]!}
        height={middle}
        fill="rgba(58,51,45,0.035)"
      />
      <Rect
        x={folds[1]}
        y={middle}
        width={SKETCH_WIDTH - folds[1]!}
        height={middle}
        fill="rgba(58,51,45,0.035)"
      />
      {folds.map((x) => (
        <G key={x}>
          <Line
            x1={x}
            y1={0}
            x2={x}
            y2={SKETCH_HEIGHT}
            stroke="rgba(58,51,45,0.1)"
          />
          <Line
            x1={x + 1}
            y1={0}
            x2={x + 1}
            y2={SKETCH_HEIGHT}
            stroke="rgba(255,255,255,0.7)"
          />
        </G>
      ))}
      <Line
        x1={0}
        y1={middle}
        x2={SKETCH_WIDTH}
        y2={middle}
        stroke="rgba(58,51,45,0.1)"
      />
      <Line
        x1={0}
        y1={middle + 1}
        x2={SKETCH_WIDTH}
        y2={middle + 1}
        stroke="rgba(255,255,255,0.7)"
      />
    </>
  );
}

/** 依順序連起地點的虛線，每段稍微彎一點，左右交替 */
function routePath(points: readonly { x: number; y: number }[]): string {
  return points
    .map((p, i) => {
      if (i === 0) return `M${p.x} ${p.y}`;
      const prev = points[i - 1]!;
      const bend = i % 2 ? 0.18 : -0.18;
      const cx = (prev.x + p.x) / 2 - (p.y - prev.y) * bend;
      const cy = (prev.y + p.y) / 2 + (p.x - prev.x) * bend;
      return `Q${cx.toFixed(1)} ${cy.toFixed(1)} ${p.x} ${p.y}`;
    })
    .join(" ");
}

/**
 * 限動拼貼的照片位置（依照片張數）。IG 限動上下各約 83pt 會被頭像列和回覆列蓋住，
 * 照片和文字都排在中間。
 */
const STORY_SPOTS = {
  1: [{ left: 60, top: 180, width: 240, height: 226, tilt: -3 }],
  2: [
    { left: 22, top: 176, width: 214, height: 200, tilt: -4 },
    { left: 196, top: 262, width: 146, height: 100, tilt: 5 },
  ],
  3: [
    { left: 22, top: 176, width: 214, height: 200, tilt: -4 },
    { left: 196, top: 190, width: 146, height: 100, tilt: 5 },
    { left: 196, top: 318, width: 134, height: 92, tilt: -3 },
  ],
} as const;

/** 限時動態 9:16：頁首、最多三張照片的拼貼、標題與一段內文 */
function StoryPage({
  detail,
  onPhotoReady,
}: {
  detail: EntryDetail;
  onPhotoReady?: (index: number) => void;
}) {
  const theme = useTheme();
  const { journal, entry, dayNumber } = detail;
  const tape = TAPE_COLORS[journal.cover.tape].color;
  const photos = entry.photos.slice(0, 3);
  const places = entry.places.map((place) => place.name).join("、");
  return (
    <>
      <View style={styles.storyStrip}>
        <WashiTape color={tape} opacity={0.75} />
      </View>
      <View style={styles.storyHead}>
        <View style={styles.storyDate}>
          <Text style={[styles.storyDay, { color: theme.primary }]}>
            Day {dayNumber}
          </Text>
          <Text style={[styles.storyDateLabel, { color: theme.text }]}>
            {longDate(entry.date)}
          </Text>
          {places !== "" && (
            <View style={styles.storyPlaces}>
              <PlacePinIcon size={13} filled />
              <Text
                numberOfLines={1}
                style={[styles.storyPlacesText, { color: theme.textMuted }]}
              >
                {places}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.stamps}>
          {entry.weather && (
            <JournalStamp code={entry.weather} size={48} tilt={-8} />
          )}
          {entry.mood && <JournalStamp code={entry.mood} size={48} tilt={6} />}
        </View>
      </View>

      {photos.length > 0
        ? photos.map((photo, i) => {
            const spot = STORY_SPOTS[photos.length as 1 | 2 | 3][i]!;
            return (
              <View
                key={`${photo}-${i}`}
                style={[
                  styles.storyPolaroid,
                  {
                    left: spot.left,
                    top: spot.top,
                    width: spot.width,
                    transform: [{ rotate: `${spot.tilt}deg` }],
                  },
                ]}
              >
                <Image
                  source={{ uri: coverPhotoUri(photo) }}
                  contentFit="cover"
                  style={{ width: "100%", height: spot.height }}
                  onLoad={() => onPhotoReady?.(i)}
                  onError={() => onPhotoReady?.(i)}
                  accessibilityIgnoresInvertColors
                />
                {i < 2 && (
                  <View
                    style={
                      i === 0 ? styles.storyTapeTop : styles.storyTapeCorner
                    }
                  >
                    <WashiTape
                      color={i === 0 ? tape : TAPE_COLORS.yamabuki.color}
                    />
                  </View>
                )}
              </View>
            );
          })
        : entry.body !== "" && (
            // No photos: the diary text takes the collage's place
            <View style={styles.storyNote}>
              <Text
                numberOfLines={9}
                style={[styles.storyNoteText, { color: theme.text }]}
              >
                {entry.body}
              </Text>
              <View style={styles.storyTapeTop}>
                <WashiTape color={tape} />
              </View>
            </View>
          )}

      <View style={styles.storyText}>
        <Text
          numberOfLines={2}
          style={[styles.storyTitle, { color: theme.text }]}
        >
          {entryHeading(entry)}
        </Text>
        {photos.length > 0 && entry.body !== "" && (
          <Text
            numberOfLines={3}
            style={[styles.storyBody, { color: theme.text }]}
          >
            {entry.body}
          </Text>
        )}
      </View>
    </>
  );
}

/** 「2025 年 11 月 22 日（六）」 */
function longDate(date: string): string {
  return `${date.slice(0, 4)} 年 ${Number(date.slice(5, 7))} 月 ${Number(date.slice(8, 10))} 日（${weekdayOf(date)}）`;
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    overflow: "hidden",
  },
  footer: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  footerName: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerTape: {
    width: 14,
    height: 6,
    transform: [{ rotate: "-6deg" }],
  },
  footerText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: FOOTER_INK,
  },
  storyFooter: {
    bottom: 34,
    justifyContent: "center",
    gap: 6,
  },
  storyName: {
    flexShrink: 1,
    fontSize: 12,
  },
  footerDate: {
    fontFamily: fonts.accent,
    fontSize: 15,
    lineHeight: 18,
    paddingRight: accentOverhang(15),
    color: FOOTER_INK,
  },
  cover: {
    flex: 1,
    paddingTop: 22,
    paddingHorizontal: 22,
  },
  coverHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  coverDate: {
    gap: 3,
  },
  dayN: {
    fontFamily: fonts.accent,
    fontSize: 32,
    lineHeight: 34,
    paddingRight: accentOverhang(32),
  },
  dateLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  stamps: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: -2,
  },
  coverPhotoArea: {
    height: 222,
    marginTop: 14,
  },
  coverSpacer: {
    height: 24,
  },
  coverPolaroid: {
    position: "absolute",
    left: 22,
    top: 6,
    width: 272,
    padding: 8,
    paddingBottom: 24,
    backgroundColor: POLAROID,
    boxShadow:
      "0px 0px 0px 0.8px rgba(58,51,45,0.16), 2px 6px 14px rgba(58,51,45,0.18)",
    transform: [{ rotate: "-2.5deg" }],
  },
  coverImage: {
    width: "100%",
    height: 178,
  },
  coverNote: {
    position: "absolute",
    left: 18,
    top: 10,
    right: 18,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    backgroundColor: POLAROID,
    boxShadow:
      "0px 0px 0px 0.8px rgba(58,51,45,0.16), 2px 6px 14px rgba(58,51,45,0.18)",
    transform: [{ rotate: "-1.5deg" }],
  },
  coverNoteText: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 24,
  },
  coverTape: {
    position: "absolute",
    left: "50%",
    top: -9,
    width: 70,
    height: 18,
    marginLeft: -35,
    transform: [{ rotate: "3deg" }],
  },
  coverTitle: {
    marginTop: 10,
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 29,
  },
  coverPlaces: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  coverPlacesText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  photoPolaroid: {
    position: "absolute",
    left: 34,
    top: 46,
    width: 292,
    padding: 10,
    paddingBottom: 40,
    backgroundColor: POLAROID,
    boxShadow:
      "0px 0px 0px 0.8px rgba(58,51,45,0.16), 3px 8px 18px rgba(58,51,45,0.2)",
  },
  photoImage: {
    width: "100%",
    aspectRatio: 1,
  },
  photoCaption: {
    position: "absolute",
    left: 14,
    bottom: 9,
    fontFamily: fonts.accent,
    fontSize: 19,
    lineHeight: 22,
    paddingRight: accentOverhang(19),
  },
  cornerTape: {
    position: "absolute",
    width: 64,
    height: 18,
    transform: [{ rotate: "-38deg" }],
  },
  cornerTapeTop: {
    left: -16,
    top: 6,
  },
  cornerTapeBottom: {
    right: -16,
    bottom: 14,
  },
  textSheet: {
    position: "absolute",
    left: 16,
    top: 18,
    right: 16,
    bottom: 44,
    gap: 4,
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 40,
  },
  textDay: {
    fontFamily: fonts.accent,
    fontSize: 18,
    lineHeight: 22,
    paddingRight: accentOverhang(18),
  },
  textTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 28,
  },
  textBody: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 28,
  },
  textSticker: {
    position: "absolute",
  },
  places: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 22,
  },
  placesHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  placesTitle: {
    fontFamily: fonts.bold,
    fontSize: 19,
  },
  placesDay: {
    fontFamily: fonts.accent,
    fontSize: 19,
    lineHeight: 22,
    paddingRight: accentOverhang(19),
  },
  sketch: {
    width: SKETCH_WIDTH,
    height: SKETCH_HEIGHT,
    marginTop: 14,
    backgroundColor: MAP_PAPER,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 16,
    boxShadow:
      "0px 0px 0px 1.2px rgba(58,51,45,0.2), 1px 3px 0px rgba(58,51,45,0.07)",
  },
  sketchClip: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 16,
  },
  north: {
    position: "absolute",
    top: 2,
    width: 8,
    textAlign: "center",
    fontFamily: fonts.accent,
    fontSize: 13,
    lineHeight: 15,
    color: "#5E554C",
  },
  scaleLabel: {
    position: "absolute",
    top: SKETCH_HEIGHT - 26,
    fontFamily: fonts.accent,
    fontSize: 14,
    lineHeight: 16,
    paddingRight: accentOverhang(14),
  },
  pinLabel: {
    position: "absolute",
    maxWidth: LABEL_WIDTH,
    paddingHorizontal: 3,
    backgroundColor: "rgba(245,236,217,0.85)",
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 18,
  },
  pin: {
    position: "absolute",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: KRAFT.paper,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 14,
    boxShadow: `0px 0px 0px 2px #FBF8F1, 0px 0px 0px 3.2px ${KRAFT.band}`,
  },
  pinNumber: {
    fontFamily: fonts.accent,
    fontSize: 18,
    lineHeight: 20,
    color: "#3A332D",
  },
  placeList: {
    marginTop: 10,
  },
  placeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 40,
  },
  placeBadge: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: KRAFT.paper,
    borderRadius: 11,
    boxShadow: `0px 0px 0px 1.2px ${KRAFT.band}`,
  },
  placeBadgeText: {
    fontFamily: fonts.accent,
    fontSize: 15,
    lineHeight: 17,
    color: "#3A332D",
  },
  placeName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  placeMore: {
    marginTop: 8,
    paddingLeft: 32,
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  storyStrip: {
    position: "absolute",
    left: -10,
    right: -10,
    top: 28,
    height: 22,
    transform: [{ rotate: "-2deg" }],
  },
  storyHead: {
    position: "absolute",
    left: 24,
    right: 22,
    top: 84,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  storyDate: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  storyDay: {
    fontFamily: fonts.accent,
    fontSize: 36,
    lineHeight: 38,
    paddingRight: accentOverhang(36),
  },
  storyDateLabel: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
  },
  storyPlaces: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  storyPlacesText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  storyPolaroid: {
    position: "absolute",
    padding: 7,
    paddingBottom: 20,
    backgroundColor: POLAROID,
    boxShadow: POLAROID_SHADOW,
  },
  storyTapeTop: {
    position: "absolute",
    left: "50%",
    top: -9,
    width: 60,
    height: 17,
    marginLeft: -30,
    transform: [{ rotate: "4deg" }],
  },
  storyTapeCorner: {
    position: "absolute",
    right: -10,
    top: -6,
    width: 46,
    height: 15,
    transform: [{ rotate: "30deg" }],
  },
  storyNote: {
    position: "absolute",
    left: 30,
    right: 30,
    top: 184,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: POLAROID,
    boxShadow: POLAROID_SHADOW,
    transform: [{ rotate: "-1.5deg" }],
  },
  storyNoteText: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 24,
  },
  storyText: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 444,
    gap: 6,
  },
  storyTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    lineHeight: 28,
  },
  storyBody: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 22,
  },
});
