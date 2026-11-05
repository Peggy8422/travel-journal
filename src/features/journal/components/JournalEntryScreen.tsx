import { router, Stack } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderHandlers,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { notifyDataChanged } from "../../../shared/hooks/useFocusedQuery";
import { HeaderAction } from "../../../shared/ui/components";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { PaperBackground, RuledPaper } from "../../../shared/ui/handDrawn";
import { BackButton, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { describeError } from "../../ledger/components/messages";
import { UNBOUND_JOURNALS_ID } from "../../map/services/mapData";
import { useStickerBoard } from "../hooks/useStickerBoard";
import { useEntry, useIllustrationLibrary } from "../hooks/useJournalQueries";
import { saveEntryStickers, type EntryDetail } from "../services/entryCommands";
import { entryHeading, monthDayLabel } from "../services/journalDates";
import { DaySpendingCard } from "./DaySpendingCard";
import { PhotoCollage, PhotoViewer } from "./EntryPhotos";
import { GlobeIcon, PlacePinIcon } from "./EntryPlaces";
import {
  StickerIcon,
  StickerLayer,
  stickersBottom,
  StickerTray,
  type StickerArt,
} from "./EntryStickers";
import { aspectOf } from "./IllustrationArt";
import { JournalStamp } from "./JournalStamp";
import { PencilIcon } from "./PencilIcon";
import { TAPE_COLORS } from "./tapes";
import type { EntrySticker } from "../../../domain/journal";

/** 捲動區上方的留白，頁面從這裡開始 */
const PAGE_TOP = 4;

/**
 * 一篇日記（只能看）：橫線信紙上寫日期、印章、標題、照片、內容與去過的地方，
 * 有綁帳本時最下面列出這天的消費，貼的插圖疊在頁面上。右上角「編輯」才進表單，
 * 「貼插圖」在同一頁切換成擺插圖的模式。
 * 點照片全螢幕看，可以左右滑；「在地圖上看」打開這天的詳細地圖。
 * 導覽列隱藏，返回鍵自己畫。
 */
export function JournalEntryScreen({ entryId }: { entryId: string }) {
  const theme = useTheme();
  const { data, error } = useEntry(entryId);
  /** 貼插圖中時是打開那時頁面捲到哪裡，擺插圖的畫面從同一處開始；沒在貼時為 null */
  const [editing, setEditing] = useState<number | null>(null);
  /** 看日記時從哪裡開始捲（貼完插圖回來停在原處） */
  const [viewOffset, setViewOffset] = useState(0);

  if (error) {
    return <PageMessage onBack={router.back} text="讀取日記失敗" />;
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

  return (
    <>
      {/* Edge swipe would leave without saving, and fights dragging stickers */}
      <Stack.Screen options={{ gestureEnabled: editing === null }} />
      {editing === null ? (
        <EntryView
          detail={data.value}
          offset={viewOffset}
          onEditStickers={setEditing}
        />
      ) : (
        <StickerEditor
          detail={data.value}
          offset={editing}
          onClose={(offset) => {
            setViewOffset(offset);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function EntryView({
  detail,
  offset,
  onEditStickers,
}: {
  detail: EntryDetail;
  offset: number;
  onEditStickers: (offset: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { entry, journal } = detail;
  /** 全螢幕看的那張照片；沒在看時為 null */
  const [viewing, setViewing] = useState<number | null>(null);
  const scrolled = useRef(offset);

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
        <BackButton onPress={router.back} />
        <View style={styles.actions}>
          <PillButton
            label="貼插圖"
            icon={<StickerIcon color={theme.text} />}
            onPress={() => onEditStickers(scrolled.current)}
          />
          <PillButton
            label="編輯"
            icon={<PencilIcon color={theme.text} size={17} />}
            onPress={() =>
              router.push({
                pathname: "/journal/[id]/entry/[entryId]/edit",
                params: { id: journal.id, entryId: entry.id },
              })
            }
          />
        </View>
      </View>

      <ScrollView
        contentOffset={{ x: 0, y: offset }}
        scrollEventThrottle={32}
        onScroll={(e) => {
          scrolled.current = e.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <EntryPage
          detail={detail}
          stickers={entry.stickers}
          art={detail.illustrations}
          onOpenPhoto={setViewing}
        />
      </ScrollView>
      {viewing !== null && (
        <PhotoViewer
          photos={entry.photos}
          start={Math.min(viewing, entry.photos.length - 1)}
          onClose={() => setViewing(null)}
        />
      )}
    </View>
  );
}

/**
 * 貼插圖：同一張日記頁，下面拉出插圖抽屜。點抽屜裡的插圖貼到畫面中間，
 * 單指拖曳移動、兩指捏合縮放轉動；按「完成」才存。
 */
function StickerEditor({
  detail,
  offset,
  onClose,
}: {
  detail: EntryDetail;
  offset: number;
  onClose: (offset: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const library = useIllustrationLibrary();
  const drawings = library.data?.map((item) => item.illustration) ?? null;
  const art: StickerArt = {
    ...detail.illustrations,
    ...Object.fromEntries((drawings ?? []).map((d) => [d.id, d])),
  };
  const board = useStickerBoard(detail.entry.stickers, (id) => {
    const illustration = art[id];
    return illustration ? aspectOf(illustration.strokes) : 1;
  });
  const { stickers, selected, touching, dirty, full } = board.snapshot;
  const [saving, setSaving] = useState(false);
  const [viewport, setViewport] = useState(0);
  const [trayHeight, setTrayHeight] = useState(160);
  const scrolled = useRef(offset);

  function close() {
    onClose(scrolled.current);
  }

  function cancel() {
    if (!dirty) {
      close();
      return;
    }
    Alert.alert("還沒儲存", "要放棄這次貼的插圖嗎？", [
      { text: "繼續貼", style: "cancel" },
      { text: "放棄", style: "destructive", onPress: close },
    ]);
  }

  async function done() {
    if (!dirty) {
      close();
      return;
    }
    setSaving(true);
    try {
      const result = await saveEntryStickers(deps, detail.entry.id, stickers);
      if (!result.ok) {
        // 「完成」在頁首，錯誤不屬於任何欄位
        Alert.alert("無法儲存", describeError(result.error));
        return;
      }
      notifyDataChanged();
      toast("插圖貼好了");
      close();
    } catch {
      Alert.alert("無法儲存", "儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
        <HeaderAction title="取消" onPress={cancel} />
        <Text
          accessibilityRole="header"
          style={[styles.editTitle, { color: theme.text }]}
        >
          貼插圖
        </Text>
        <HeaderAction title="完成" strong disabled={saving} onPress={done} />
      </View>

      <ScrollView
        scrollEnabled={!touching}
        contentOffset={{ x: 0, y: offset }}
        scrollEventThrottle={32}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrolled.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: trayHeight + 24 },
        ]}
      >
        <EntryPage
          detail={detail}
          stickers={stickers}
          art={art}
          selected={selected}
          panHandlers={board.panHandlers}
          onPageSize={board.setPageSize}
        />
      </ScrollView>
      <StickerTray
        library={drawings}
        full={full}
        hasSelection={selected !== null}
        bottomInset={insets.bottom}
        onAdd={(illustration) =>
          // Lands in the middle of what is on screen above the tray
          board.add(
            illustration.id,
            scrolled.current + (viewport - trayHeight) / 2 - PAGE_TOP,
          )
        }
        onRemove={board.removeSelected}
        onLayout={(e) => setTrayHeight(e.nativeEvent.layout.height)}
      />
    </View>
  );
}

/** 日記頁本體與疊在上面的插圖，看日記和貼插圖共用 */
function EntryPage({
  detail,
  stickers,
  art,
  selected = null,
  panHandlers,
  onPageSize,
  onOpenPhoto,
}: {
  detail: EntryDetail;
  stickers: readonly EntrySticker[];
  art: StickerArt;
  selected?: number | null;
  panHandlers?: GestureResponderHandlers;
  onPageSize?: (width: number, height: number) => void;
  onOpenPhoto?: (index: number) => void;
}) {
  const theme = useTheme();
  const { entry, journal, dayNumber, daySpending } = detail;
  const [pageWidth, setPageWidth] = useState(0);
  const minHeight = stickersBottom(stickers, art, pageWidth) + 16;

  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setPageWidth(width);
        onPageSize?.(width, height);
      }}
    >
      <RuledPaper marginLine={30} style={[styles.page, { minHeight }]}>
        <View style={styles.head}>
          <View style={styles.date}>
            <Text style={[styles.dayN, { color: theme.primary }]}>
              Day {dayNumber}
            </Text>
            <Text style={[styles.dateLabel, { color: theme.text }]}>
              {`${entry.date.slice(0, 4)} 年 ${monthDayLabel(entry.date)}`}
            </Text>
          </View>
          <View style={styles.stamps}>
            {entry.weather && (
              <JournalStamp code={entry.weather} size={54} tilt={-8} />
            )}
            {entry.mood && (
              <JournalStamp code={entry.mood} size={54} tilt={6} />
            )}
          </View>
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.text }]}
        >
          {entryHeading(entry)}
        </Text>
        {entry.photos.length > 0 && (
          <PhotoCollage
            photos={entry.photos}
            tape={TAPE_COLORS[journal.cover.tape].color}
            onOpen={onOpenPhoto ?? (() => undefined)}
          />
        )}
        {entry.body !== "" && (
          <Text selectable style={[styles.body, { color: theme.text }]}>
            {entry.body}
          </Text>
        )}
        {entry.places.length > 0 && (
          <View style={styles.places}>
            <View style={styles.placesHead}>
              <Text
                accessibilityRole="header"
                style={[styles.placesTitle, { color: theme.text }]}
              >
                去過的地方
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityHint="打開詳細地圖，看這天的地點"
                onPress={() =>
                  router.push({
                    pathname: "/map",
                    params: {
                      // Journal places show up with the bound ledger
                      ledgers: journal.ledgerId ?? UNBOUND_JOURNALS_ID,
                      date: entry.date,
                    },
                  })
                }
                style={({ pressed }) => [
                  styles.mapButton,
                  {
                    backgroundColor: theme.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <GlobeIcon size={16} color={theme.text} />
                <Text style={[styles.mapText, { color: theme.text }]}>
                  在地圖上看
                </Text>
              </Pressable>
            </View>
            {entry.places.map((place, i) => (
              <View key={i} style={styles.place}>
                <PlacePinIcon size={18} filled />
                <Text
                  selectable
                  style={[styles.placeName, { color: theme.text }]}
                >
                  {place.name}
                </Text>
              </View>
            ))}
          </View>
        )}
        {daySpending && <DaySpendingCard spending={daySpending} />}
      </RuledPaper>
      <StickerLayer
        stickers={stickers}
        art={art}
        pageWidth={pageWidth}
        selected={selected}
        panHandlers={panHandlers}
      />
    </View>
  );
}

function PillButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.edit,
        { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon}
      <Text style={[styles.editText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const RING =
  "0px 0px 0px 1.3px rgba(58,51,45,0.55), 1px 2px 0px rgba(58,51,45,0.12)";

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    // As tall as the pill buttons, so the page stays put when switching modes
    lineHeight: 44,
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
    boxShadow: RING,
  },
  editText: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  scroll: {
    paddingHorizontal: 12,
    paddingTop: PAGE_TOP,
  },
  page: {
    gap: 18,
    paddingTop: 22,
    paddingRight: 18,
    paddingBottom: 26,
    paddingLeft: 42,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  date: {
    gap: 2,
  },
  dayN: {
    fontFamily: fonts.accent,
    fontSize: 20,
    lineHeight: 22,
    paddingRight: accentOverhang(20),
  },
  dateLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  stamps: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -4,
  },
  title: {
    marginTop: -6,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 31,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15.5,
    lineHeight: 28,
  },
  places: {
    gap: 6,
  },
  placesHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  placesTitle: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    paddingLeft: 9,
    paddingRight: 12,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 17,
    borderBottomLeftRadius: 16,
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.5)",
  },
  mapText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  place: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 28,
  },
  placeName: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
