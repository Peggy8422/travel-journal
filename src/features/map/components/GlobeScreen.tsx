import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import {
  frameForPoints,
  GLOBE_HOME,
  globeProjection,
  orthographic,
  toScreen,
} from "../../../domain/map";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { PaperBackground, WashiTape } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { useGlobeMotion } from "../hooks/useGlobeMotion";
import { useMapData } from "../hooks/useMapData";
import {
  clusterDescription,
  clusterLabel,
  clusterOnScreen,
  globeSheet,
  groupLedgersByYear,
} from "../services/globeView";
import type { MapData, MapExpense } from "../services/mapData";
import { GlobeArt } from "./GlobeArt";
import { GlobeIndex, ledgerColors } from "./GlobeIndex";
import { GlobeSheet } from "./GlobeSheet";

/** 右側索引籤的寬度 */
const INDEX_WIDTH = 76;
/** 消費卡片收合時的高度 */
const SHEET_CLOSED = 236;
/** 畫面上距離小於這個值（px）的標記合成一個 */
const CLUSTER_DISTANCE = 22;
/** 選了帳本、標記不多時，每個標記旁都寫地名 */
const MAX_TAGGED_CLUSTERS = 6;

/**
 * 地圖分頁：手繪地球。沒選帳本時在台灣附近慢慢擺動；
 * 從右側索引籤選帳本（可複選），地球轉到那趟旅行並放大，下方卡片列出有地點的消費。
 * 城市裡的細節（日期、路線、目前位置）在「詳細地圖」看。
 */
export function GlobeScreen() {
  const theme = useTheme();
  const { data, error } = useMapData();
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  return (
    <View
      style={[styles.fill, { backgroundColor: theme.background }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      <PaperBackground />
      {/* The globe needs the screen size before its first frame */}
      {size && (
        <GlobeStage
          width={size.width}
          height={size.height}
          data={data}
          failed={error !== undefined}
        />
      )}
    </View>
  );
}

function GlobeStage({
  width,
  height,
  data,
  failed,
}: {
  width: number;
  height: number;
  data: MapData | undefined;
  failed: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  const cx = (width - INDEX_WIDTH) / 2;
  const radius = Math.max(60, Math.min(cx - 19, height * 0.3));
  const sheetOpenHeight = Math.max(
    SHEET_CLOSED,
    Math.min(500, height - insets.top - 140),
  );
  // Where the globe centre sits: middle of the screen, or above the sheet
  const cyIdle = height * 0.526;
  const cyPicked = (height - SHEET_CLOSED - 10) * 0.62;
  const cySheet = (height - sheetOpenHeight - 10) * 0.856;

  const [pickedIds, setPickedIds] = useState<readonly string[]>([]);
  /** undefined：還沒動過，預設展開最近的年份 */
  const [openYear, setOpenYear] = useState<string | null | undefined>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [placeIds, setPlaceIds] = useState<readonly string[] | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [autoSpin, setAutoSpin] = useState(!reduceMotion);

  const ledgers = data?.ledgers ?? [];
  const pins = data?.pins ?? [];
  // Ledgers deleted since they were picked drop out
  const picked = ledgers.filter((l) => pickedIds.includes(l.id));
  const pickedIdList = picked.map((l) => l.id);
  const year =
    openYear === undefined
      ? (groupLedgersByYear(ledgers)[0]?.year ?? null)
      : openYear;

  const motion = useGlobeMotion({
    radius,
    idleCy: cyIdle,
    spinning: autoSpin && picked.length === 0,
    animate: !reduceMotion,
  });
  const { view } = motion.frame;

  const cyFor = (pickedCount: number, open: boolean) =>
    pickedCount === 0 ? cyIdle : open ? cySheet : cyPicked;

  /** 轉到這幾本帳本的足跡；沒有足跡時回到台灣 */
  function frameLedgers(ids: readonly string[], open: boolean) {
    const frame = frameForPoints(
      pins.filter((p) => ids.includes(p.ledgerId)).map((p) => p.point),
      radius,
    );
    const cy = cyFor(ids.length, open);
    if (frame) motion.flyTo({ ...frame, cy });
    else motion.goHome(cy);
  }

  function changeSheet(open: boolean) {
    if (open === sheetOpen) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSheetOpen(open);
  }

  function toggleLedger(id: string) {
    const next = pickedIdList.includes(id)
      ? pickedIdList.filter((x) => x !== id)
      : [...pickedIdList, id];
    const open = next.length > 0 && sheetOpen;
    setPickedIds(next);
    setPlaceIds(null);
    setFocusId(null);
    changeSheet(open);
    frameLedgers(next, open);
  }

  function clearPicked() {
    setPickedIds([]);
    setPlaceIds(null);
    setFocusId(null);
    changeSheet(false);
    motion.goHome(cyIdle);
  }

  function toggleSheet() {
    const open = !sheetOpen;
    changeSheet(open);
    motion.flyTo({ ...view, cy: open ? cySheet : cyPicked });
  }

  /**
   * 標出這筆消費並打開明細。明細蓋住畫面時地球的動畫會停（畫面失去焦點），
   * 所以直接跳到那裡，並放在明細卡片上方看得到的高度。
   */
  function openExpense(expense: MapExpense) {
    setFocusId(expense.id);
    motion.jumpTo({
      lon: expense.point.longitude,
      lat: expense.point.latitude,
      k: view.k,
      cy: cySheet,
    });
    router.push({
      pathname: "/expense/[expenseId]",
      params: { expenseId: expense.id },
    });
  }

  function pickCluster(items: readonly MapExpense[]) {
    const ids = items.map((e) => e.id);
    if (placeIds && placeIds.join(",") === ids.join(",")) {
      setPlaceIds(null);
      setFocusId(null);
      return;
    }
    setPlaceIds(ids);
    setFocusId(ids.length === 1 ? ids[0] : null);
    changeSheet(true);
    motion.flyTo({
      lon: items[0].point.longitude,
      lat: items[0].point.latitude,
      k: view.k,
      cy: cySheet,
    });
  }

  // Pins of the picked ledgers on the visible side, merged when they overlap
  const projection = globeProjection(view, { cx, radius });
  const clusters = clusterOnScreen(
    pins
      .filter((p) => pickedIdList.includes(p.ledgerId))
      .flatMap((pin) => {
        const [x, y, z] = orthographic(
          projection,
          pin.point.longitude,
          pin.point.latitude,
        );
        // Points right at the rim are too squashed to tap
        if (z < 0.06) return [];
        const s = toScreen(projection, x, y);
        if (s.x < -30 || s.x > width + 30 || s.y < -30 || s.y > height + 30) {
          return [];
        }
        return [{ item: pin, ...s }];
      }),
    CLUSTER_DISTANCE,
  );
  const [hx, hy, hz] = orthographic(projection, GLOBE_HOME.lon, GLOBE_HOME.lat);
  const home = toScreen(projection, hx, hy);
  const showHome =
    hz > 0.2 &&
    view.k < 2.6 &&
    !clusters.some((c) => Math.hypot(c.x - home.x, c.y - home.y) < 30);

  const hint = failed
    ? "讀取地圖資料失敗，請稍後再試。"
    : data && !ledgers.some((l) => l.kind === "shared")
      ? "還沒有帳本。到「帳本」分頁建立一本，記帳時記下地點，足跡就會出現在地球上。"
      : "從右邊的索引籤挑一本帳本，這趟旅行的足跡和消費就會出現在地球上。";

  return (
    <>
      <View style={StyleSheet.absoluteFill} {...motion.panHandlers}>
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            picked.length > 0
              ? `可以拖曳轉動的地球，標出 ${picked.length} 本帳本的消費地點`
              : "以台灣為中心慢慢自轉的地球，可以拖曳轉動"
          }
        >
          <GlobeArt
            view={view}
            plane={motion.frame.plane}
            cx={cx}
            radius={radius}
          />
        </View>
        {showHome && (
          <View
            pointerEvents="none"
            style={[styles.home, { left: home.x - 40, top: home.y - 38 }]}
          >
            {/* Text can't clip a rounded background and keep its shadow on iOS */}
            <View style={styles.homeLabel}>
              <Text style={[styles.homeText, { color: theme.primary }]}>
                台灣
              </Text>
            </View>
            <Svg width={16} height={16} viewBox="0 0 16 16">
              <Path
                d="M8 14.5 C 5 11, 2.5 8.6, 2.5 6.2 C 2.5 4.2 4 3 5.5 3 C 6.7 3 7.5 3.8 8 4.8 C 8.5 3.8 9.3 3 10.5 3 C 12 3 13.5 4.2 13.5 6.2 C 13.5 8.6 11 11 8 14.5 Z"
                fill="#D9785C"
                stroke={theme.primary}
                strokeWidth={1.1}
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        )}
        {clusters.map((cluster) => {
          const ids = cluster.items.map((e) => e.id);
          const focus = cluster.items.find((e) => e.id === focusId);
          const ledgerIds = new Set(cluster.items.map((e) => e.ledgerId));
          const only = picked.find((l) => ledgerIds.has(l.id));
          const color =
            ledgerIds.size === 1 && only ? ledgerColors(only).deep : theme.text;
          const marked =
            focus !== undefined || placeIds?.join(",") === ids.join(",");
          return (
            <GlobePin
              key={ids[0]}
              x={cluster.x}
              y={cluster.y}
              count={cluster.items.length}
              color={color}
              marked={marked}
              tag={
                focus
                  ? focus.title
                  : clusters.length <= MAX_TAGGED_CLUSTERS
                    ? clusterLabel(cluster.items)
                    : null
              }
              tagOnLeft={cluster.x > cx + 75}
              accessibilityLabel={clusterDescription(cluster.items)}
              onPress={() => pickCluster(cluster.items)}
            />
          );
        })}
      </View>

      <View
        style={[
          styles.title,
          { top: insets.top + 6, backgroundColor: "#F8F3EA" },
        ]}
      >
        <View style={styles.titleTape}>
          <WashiTape color="#E6B1AC" tilt={18} opacity={0.85} />
        </View>
        <Text style={[styles.kicker, { color: theme.textMuted }]}>
          Travel Globe
        </Text>
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: theme.text }]}
        >
          旅行足跡
        </Text>
      </View>

      <View style={[styles.pills, { top: insets.top + 86 }]}>
        <Pill
          label="回到台灣"
          onPress={() => motion.goHome(cyFor(picked.length, sheetOpen))}
          icon={
            <>
              <Path d="M2.8 8.4L9 3.2l6.3 5.1" />
              <Path d="M4.6 7.3v7.4h8.8V7.2" />
              <Path d="M7.6 14.6v-3.8h2.8v3.8" />
            </>
          }
        />
        {picked.length === 0 ? (
          <Pill
            label={autoSpin ? "暫停自轉" : "繼續自轉"}
            selected={!autoSpin}
            onPress={() => setAutoSpin(!autoSpin)}
            icon={
              autoSpin ? (
                <Path d="M6.5 4.6c.1 3 .1 6 0 8.8M11.5 4.4c-.1 3.1.1 6.1 0 9" />
              ) : (
                <>
                  <Path d="M14.5 9.2a5.5 5.5 0 1 1-1.8-4.3" />
                  <Path d="M13.2 2.6l-.3 2.6 2.6.3" />
                </>
              )
            }
          />
        ) : (
          <Pill
            label="看全部足跡"
            onPress={() => {
              setPlaceIds(null);
              setFocusId(null);
              frameLedgers(pickedIdList, sheetOpen);
            }}
            icon={
              <Path d="M3 6.5V3.2h3.3M11.7 3.2H15v3.3M15 11.5v3.3h-3.3M6.3 14.8H3v-3.3" />
            }
          />
        )}
      </View>

      <GlobeIndex
        top={insets.top + 2}
        ledgers={ledgers}
        picked={pickedIdList}
        openYear={year}
        onToggleYear={(y) => setOpenYear(y === year ? null : y)}
        onToggleLedger={toggleLedger}
        onClear={clearPicked}
      />

      {picked.length === 0 || !data ? (
        <View style={[styles.hint, { backgroundColor: theme.surface }]}>
          <View style={styles.hintTape}>
            <WashiTape color="#E9C46A" tilt={-4} opacity={0.85} />
          </View>
          <Text style={[styles.hintText, { color: theme.text }]}>{hint}</Text>
          {!failed && ledgers.some((l) => l.kind === "shared") && (
            <Svg
              width={34}
              height={26}
              viewBox="0 0 34 26"
              fill="none"
              stroke={theme.textMuted}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={styles.hintArrow}
            >
              <Path d="M2.5 19c7-6.5 15-9.6 26-7.6" />
              <Path d="M24 6.6l5.2 4.9-5.4 4" />
            </Svg>
          )}
        </View>
      ) : (
        <GlobeSheet
          picked={picked}
          content={globeSheet(data, pickedIdList, placeIds)}
          height={sheetOpen ? sheetOpenHeight : SHEET_CLOSED}
          open={sheetOpen}
          onToggle={toggleSheet}
          placeIds={placeIds}
          onClearPlace={() => {
            setPlaceIds(null);
            setFocusId(null);
          }}
          focusId={focusId}
          onOpen={openExpense}
          onOpenDetail={() =>
            router.push({
              pathname: "/map",
              params: { ledgers: pickedIdList.join(",") },
            })
          }
        />
      )}
    </>
  );
}

/** 地球上的標記：帳本色圓點，多筆合在一起時寫筆數；旁邊可以掛一個地名小標籤 */
function GlobePin({
  x,
  y,
  count,
  color,
  marked,
  tag,
  tagOnLeft,
  accessibilityLabel,
  onPress,
}: {
  x: number;
  y: number;
  count: number;
  color: string;
  marked: boolean;
  tag: string | null;
  tagOnLeft: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  const size = count > 1 ? 26 : 18;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: marked }}
      onPress={onPress}
      style={[styles.pin, { left: x - 22, top: y - 22 }]}
    >
      <View
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color,
          borderTopLeftRadius: size / 2,
          borderTopRightRadius: size * 0.46,
          borderBottomRightRadius: size * 0.52,
          borderBottomLeftRadius: size * 0.48,
          boxShadow: marked
            ? `0px 0px 0px 3px ${theme.surface}, 0px 0px 0px 5px ${color}, 2px 3px 0px rgba(58,51,45,0.22)`
            : `0px 0px 0px 2px ${theme.surface}, 0px 0px 0px 3.2px rgba(58,51,45,0.7), 2px 3px 0px rgba(58,51,45,0.22)`,
        }}
      >
        {count > 1 && (
          <Text style={[styles.pinCount, { color: theme.surface }]}>
            {count}
          </Text>
        )}
      </View>
      {tag !== null && (
        // An absolute child only gets the space left in the 44pt button unless
        // it has its own width, so the slot is fixed and the label shrinks to fit
        <View
          pointerEvents="none"
          style={[
            styles.pinTagSlot,
            tagOnLeft
              ? { right: 38, alignItems: "flex-end" }
              : { left: 38, alignItems: "flex-start" },
          ]}
        >
          <View style={[styles.pinTag, { backgroundColor: theme.surface }]}>
            <Text
              numberOfLines={1}
              style={[styles.pinTagText, { color: theme.text }]}
            >
              {tag}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** 地球左上的紙色膠囊按鈕（回到台灣、暫停自轉、看全部足跡） */
function Pill({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Svg
        width={18}
        height={18}
        viewBox="0 0 18 18"
        fill="none"
        stroke={theme.text}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon}
      </Svg>
      <Text style={[styles.pillText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  home: {
    position: "absolute",
    width: 80,
    alignItems: "center",
    gap: 1,
  },
  homeLabel: {
    paddingTop: 1,
    paddingHorizontal: 7,
    paddingBottom: 2,
    backgroundColor: "#FBF8F1",
    borderTopLeftRadius: 5,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 8,
    boxShadow: "0px 0px 0px 1.2px rgba(163,69,46,0.7)",
  },
  homeText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  pin: {
    position: "absolute",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pinCount: {
    fontFamily: fonts.accent,
    fontSize: 16,
    lineHeight: 18,
    paddingRight: accentOverhang(16) / 2,
  },
  pinTagSlot: {
    position: "absolute",
    top: 11,
    width: 150,
  },
  pinTag: {
    maxWidth: 150,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 9,
    boxShadow:
      "0px 0px 0px 1.1px rgba(58,51,45,0.55), 1px 2px 0px rgba(58,51,45,0.12)",
  },
  pinTagText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
  },
  title: {
    position: "absolute",
    left: 14,
    paddingTop: 7,
    paddingRight: 16,
    paddingBottom: 8,
    paddingLeft: 14,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 12,
    boxShadow:
      "0px 1px 0px rgba(58,51,45,0.1), 0px 4px 10px rgba(58,51,45,0.06)",
    transform: [{ rotate: "-1deg" }],
  },
  titleTape: {
    position: "absolute",
    right: -14,
    top: -7,
    width: 46,
    height: 15,
  },
  kicker: {
    fontFamily: fonts.accent,
    fontSize: 18,
    lineHeight: 20,
    paddingRight: accentOverhang(18),
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 25,
    lineHeight: 32,
  },
  pills: {
    position: "absolute",
    left: 12,
    right: INDEX_WIDTH + 4,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    paddingLeft: 10,
    paddingRight: 13,
    borderRadius: 22,
    boxShadow:
      "0px 0px 0px 1.3px rgba(58,51,45,0.6), 1px 2px 0px rgba(58,51,45,0.12)",
  },
  pillText: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  hint: {
    position: "absolute",
    left: 14,
    right: INDEX_WIDTH + 12,
    bottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    paddingTop: 18,
    paddingRight: 12,
    paddingBottom: 14,
    paddingLeft: 16,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 16,
    boxShadow:
      "0px 2px 0px rgba(58,51,45,0.08), 0px 8px 18px rgba(58,51,45,0.1)",
    transform: [{ rotate: "-0.8deg" }],
  },
  hintTape: {
    position: "absolute",
    left: 18,
    top: -8,
    width: 64,
    height: 17,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 24,
  },
  hintArrow: {
    marginBottom: 6,
  },
});
