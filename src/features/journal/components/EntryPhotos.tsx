import { Image } from "expo-image";
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { pickEntryPhotos } from "../../../data/files/coverPhotoStore";
import { ENTRY_PHOTO_LIMIT } from "../../../domain/journal";
import { ErrorText } from "../../../shared/ui/components";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { WashiTape } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import {
  appCoverPhotos,
  coverPhotoUri,
} from "../../ledger/services/appCoverPhotos";
import { saveCoverPhoto } from "../../ledger/services/coverPhotos";

/*
 * 日記的照片：寫日記表單裡挑選、日記頁的拼貼與全螢幕、手帳頁列表的小縮圖。
 * 照片檔和封面照片放在同一個資料夾（CoverPhotoStore），日記只記檔名。
 */

const POLAROID = "#FFFDF8";
/** 縮圖一張張歪一點，不要排得太整齊 */
const THUMB_TILTS = [-3, 2.5, -1.5] as const;
/** 表單裡一排放三張，縮圖之間的距離 */
const GRID_GAP = 14;
/** 最右邊那張的移除鈕會超出縮圖，留一點空間 */
const REMOVE_OVERHANG = 6;

interface DraftPhoto {
  readonly key: string;
  /** 已經存進 App 的檔名；剛挑、還沒存的是 null */
  readonly saved: string | null;
  readonly uri: string;
}

/**
 * 表單裡的照片：剛挑的照片先放在暫存檔，按儲存時才用 commit 存進 App；
 * 中途取消就不會留下照片，拿掉的舊照片之後由 tidyCoverPhotos 清掉。
 */
export function useEntryPhotos(saved: readonly string[]) {
  const [photos, setPhotos] = useState<readonly DraftPhoto[]>(() =>
    saved.map((name) => ({ key: name, saved: name, uri: coverPhotoUri(name) })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    photos,
    busy,
    error,
    room: ENTRY_PHOTO_LIMIT - photos.length,
    async add() {
      setError(null);
      setBusy(true);
      try {
        const uris = await pickEntryPhotos(ENTRY_PHOTO_LIMIT - photos.length);
        setPhotos((current) => [
          ...current,
          ...uris
            .slice(0, ENTRY_PHOTO_LIMIT - current.length)
            .map((uri) => ({ key: uri, saved: null, uri })),
        ]);
      } catch {
        setError("讀不到這些照片，換幾張試試");
      } finally {
        setBusy(false);
      }
    },
    remove(key: string) {
      setError(null);
      setPhotos((current) => current.filter((p) => p.key !== key));
    },
    /**
     * 存檔前呼叫：剛挑的照片存進 App，回傳日記要記的檔名。
     * 存好的照片記下檔名，儲存失敗再按一次時不會重複存。
     */
    async commit(newId: () => string): Promise<string[]> {
      const committed: DraftPhoto[] = [];
      for (const photo of photos) {
        committed.push(
          photo.saved !== null
            ? photo
            : {
                ...photo,
                saved: await saveCoverPhoto(appCoverPhotos, newId, photo.uri),
              },
        );
      }
      setPhotos(committed);
      return committed.flatMap((p) => (p.saved === null ? [] : [p.saved]));
    },
  };
}

export type EntryPhotos = ReturnType<typeof useEntryPhotos>;

/**
 * 表單的「照片」區：拍立得小縮圖（右上角可以移除）加上虛線框的「加照片」，
 * 一排三張撐滿整個寬度。
 */
export function EntryPhotoField({
  photos,
  error,
}: {
  photos: EntryPhotos;
  error: string | null;
}) {
  const theme = useTheme();
  const [gridWidth, setGridWidth] = useState(0);
  const size =
    gridWidth > 0
      ? Math.floor((gridWidth - GRID_GAP * 2 - REMOVE_OVERHANG) / 3)
      : 88;
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={[styles.label, { color: theme.text }]}>照片</Text>
        <Text style={[styles.count, { color: theme.textMuted }]}>
          {photos.photos.length} / {ENTRY_PHOTO_LIMIT}
        </Text>
      </View>
      <View
        style={styles.grid}
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
      >
        {photos.photos.map((photo, i) => (
          <View
            key={photo.key}
            style={[
              styles.thumb,
              {
                width: size,
                transform: [
                  { rotate: `${THUMB_TILTS[i % THUMB_TILTS.length]}deg` },
                ],
              },
            ]}
          >
            <Image
              source={{ uri: photo.uri }}
              contentFit="cover"
              style={{ width: size - 8, height: size - 8 }}
              accessibilityIgnoresInvertColors
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`移除第 ${i + 1} 張照片`}
              hitSlop={4}
              onPress={() => photos.remove(photo.key)}
              style={({ pressed }) => [
                styles.remove,
                { borderColor: theme.background, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Svg
                width={13}
                height={13}
                viewBox="0 0 16 16"
                fill="none"
                stroke={theme.surface}
                strokeWidth={2}
                strokeLinecap="round"
              >
                <Path d="M4.5 4.6l7 6.9M11.4 4.5l-6.8 7" />
              </Svg>
            </Pressable>
          </View>
        ))}
        {photos.room > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: photos.busy }}
            disabled={photos.busy}
            onPress={() => void photos.add()}
            style={({ pressed }) => [
              styles.add,
              {
                width: size,
                height: size + 8,
                borderColor: theme.pencil,
                opacity: photos.busy ? 0.45 : pressed ? 0.6 : 1,
              },
            ]}
          >
            <CameraIcon color="#5E554C" />
            <Text style={styles.addText}>
              {photos.busy ? "處理中…" : "加照片"}
            </Text>
          </Pressable>
        )}
      </View>
      <ErrorText message={error ?? photos.error} />
    </View>
  );
}

/** 拼貼的位置：一張置中，兩張交錯，三張排成三角形（照設計稿） */
const COLLAGE = {
  1: { height: 262, spots: [{ left: "6%", top: 6, width: "88%", tilt: -2 }] },
  2: {
    height: 262,
    spots: [
      { left: "0%", top: 4, width: "62%", tilt: -4 },
      { left: "42%", top: 84, width: "58%", tilt: 5 },
    ],
  },
  3: {
    height: 318,
    spots: [
      { left: "0%", top: 4, width: "58%", tilt: -4 },
      { left: "46%", top: 30, width: "54%", tilt: 4 },
      { left: "16%", top: 156, width: "52%", tilt: -1.5 },
    ],
  },
} as const;

/**
 * 日記頁的照片：前三張用紙膠帶貼成拼貼，點一張打開全螢幕；更多張時在下面寫總共幾張。
 * tape 是第一張的紙膠帶顏色（手帳封面的顏色）。
 */
export function PhotoCollage({
  photos,
  tape,
  onOpen,
}: {
  photos: readonly string[];
  tape: string;
  onOpen: (index: number) => void;
}) {
  const theme = useTheme();
  const shown = photos.slice(0, 3);
  const layout = COLLAGE[shown.length as 1 | 2 | 3];
  const tapes = [tape, "#E9C46A", "#9DB07A"];
  return (
    <View style={styles.collageWrap}>
      <View style={[styles.collage, { height: layout.height }]}>
        {shown.map((name, i) => {
          const spot = layout.spots[i]!;
          return (
            <Pressable
              key={`${name}-${i}`}
              accessibilityRole="imagebutton"
              accessibilityLabel={`放大第 ${i + 1} 張照片`}
              onPress={() => onOpen(i)}
              style={[
                styles.polaroid,
                {
                  left: spot.left,
                  top: spot.top,
                  width: spot.width,
                  transform: [{ rotate: `${spot.tilt}deg` }],
                },
              ]}
            >
              <Image
                source={{ uri: coverPhotoUri(name) }}
                contentFit="cover"
                style={styles.collageImage}
                accessibilityIgnoresInvertColors
              />
              <View
                style={[
                  styles.tape,
                  { transform: [{ rotate: i % 2 ? "7deg" : "-5deg" }] },
                ]}
              >
                <WashiTape color={tapes[i]} opacity={0.86} />
              </View>
            </Pressable>
          );
        })}
      </View>
      {photos.length > 3 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(3)}
          style={styles.moreRow}
        >
          <Text style={[styles.moreText, { color: theme.textMuted }]}>
            共 {photos.length} 張照片，點照片可以左右滑著看
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** 全螢幕看照片，左右滑換下一張；start 是一開始看的那張 */
export function PhotoViewer({
  photos,
  start,
  onClose,
}: {
  photos: readonly string[];
  start: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  return (
    <Modal
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={["portrait"]}
    >
      <View style={styles.viewer}>
        <FlatList
          data={photos}
          keyExtractor={(name, i) => `${name}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={start}
          getItemLayout={(_data, i) => ({
            length: width,
            offset: width * i,
            index: i,
          })}
          onMomentumScrollEnd={(event) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
          }
          renderItem={({ item, index: i }) => (
            <Image
              source={{ uri: coverPhotoUri(item) }}
              contentFit="contain"
              style={{ width, height }}
              accessibilityLabel={`第 ${i + 1} 張照片`}
              accessibilityIgnoresInvertColors
            />
          )}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="關閉照片"
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [
            styles.viewerClose,
            { top: insets.top + 10, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Svg
            width={16}
            height={16}
            viewBox="0 0 16 16"
            fill="none"
            stroke="#FBF8F1"
            strokeWidth={1.8}
            strokeLinecap="round"
          >
            <Path d="M4.5 4.6l7 6.9M11.4 4.5l-6.8 7" />
          </Svg>
        </Pressable>
        {photos.length > 1 && (
          <Text style={[styles.viewerCount, { bottom: insets.bottom + 18 }]}>
            {index + 1} / {photos.length}
          </Text>
        )}
      </View>
    </Modal>
  );
}

/** 手帳頁列表上的小縮圖：最多三張，更多時接一個「+N」 */
export function PhotoThumbs({ photos }: { photos: readonly string[] }) {
  const theme = useTheme();
  return (
    <View style={styles.thumbRow}>
      {photos.slice(0, 3).map((name, i) => (
        <View
          key={`${name}-${i}`}
          style={[
            styles.smallThumb,
            { transform: [{ rotate: `${THUMB_TILTS[i]}deg` }] },
          ]}
        >
          <Image
            source={{ uri: coverPhotoUri(name) }}
            contentFit="cover"
            style={styles.smallThumbImage}
            accessibilityIgnoresInvertColors
          />
        </View>
      ))}
      {photos.length > 3 && (
        <Text style={[styles.more, { color: theme.textMuted }]}>
          +{photos.length - 3}
        </Text>
      )}
    </View>
  );
}

function CameraIcon({ color }: { color: string }) {
  return (
    <Svg
      width={26}
      height={26}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M4.5 7.5h3l1.6-2.2h5.8l1.6 2.2h3c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5h-15C3.7 19.5 3 18.8 3 18V9c0-.8.7-1.5 1.5-1.5z" />
      <Path d="M15.6 13.2a3.6 3.6 0 1 1-7.2 0a3.6 3.6 0 1 1 7.2 0z" />
    </Svg>
  );
}

const PHOTO_SHADOW =
  "0px 0px 0px 0.8px rgba(58,51,45,0.18), 1px 3px 6px rgba(58,51,45,0.14)";

const styles = StyleSheet.create({
  field: {
    gap: 10,
  },
  fieldHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    paddingTop: 4,
  },
  thumb: {
    padding: 4,
    paddingBottom: 12,
    backgroundColor: POLAROID,
    boxShadow: PHOTO_SHADOW,
  },
  remove: {
    position: "absolute",
    right: -12,
    top: -12,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: "#3A332D",
  },
  add: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1.4,
    borderStyle: "dashed",
    borderRadius: 8,
    backgroundColor: "rgba(251,248,241,0.6)",
  },
  addText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: "#5E554C",
  },
  collageWrap: {
    gap: 6,
    marginLeft: -16,
    marginRight: -6,
  },
  collage: {
    position: "relative",
  },
  polaroid: {
    position: "absolute",
    padding: 6,
    paddingBottom: 20,
    backgroundColor: POLAROID,
    boxShadow:
      "0px 0px 0px 0.8px rgba(58,51,45,0.16), 2px 6px 14px rgba(58,51,45,0.18)",
  },
  collageImage: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  tape: {
    position: "absolute",
    left: "50%",
    top: -8,
    width: 58,
    height: 16,
    marginLeft: -29,
  },
  moreRow: {
    minHeight: 36,
    justifyContent: "center",
    paddingLeft: 16,
  },
  moreText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  viewer: {
    flex: 1,
    backgroundColor: "#1E1A16",
  },
  viewerClose: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(251,248,241,0.18)",
  },
  viewerCount: {
    position: "absolute",
    alignSelf: "center",
    fontFamily: fonts.regular,
    fontSize: 14,
    color: "#FBF8F1",
  },
  thumbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
    paddingLeft: 2,
  },
  smallThumb: {
    width: 62,
    padding: 3,
    paddingBottom: 9,
    backgroundColor: POLAROID,
    boxShadow: PHOTO_SHADOW,
  },
  smallThumbImage: {
    width: 56,
    height: 56,
  },
  more: {
    fontFamily: fonts.accent,
    fontSize: 17,
    paddingRight: accentOverhang(17),
  },
});
