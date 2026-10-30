import { router } from "expo-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import {
  groupByLocation,
  pinDates,
  regionForPoints,
  routeOf,
  type PinGroup,
} from "../../../domain/map";
import type { GeoPoint } from "../../../domain/ledger";
import { Chip, CloseButton, Label, Row } from "../../../shared/ui/components";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { DashedLine, SketchFrame } from "../../../shared/ui/handDrawn";
import { BackButton, PageMessage } from "../../../shared/ui/PageHeader";
import { spacing, useTheme } from "../../../shared/ui/theme";
import { describeMapLocateError } from "../../ledger/components/messages";
import { formatLocalDate } from "../../ledger/services/localTimestamp";
import { useMapData } from "../hooks/useMapData";
import { useUserLocation } from "../hooks/useUserLocation";
import {
  filterPins,
  type MapExpense,
  type MapLedger,
  type PinFilter,
} from "../services/mapData";
import { LedgerSectionHeader, MapExpenseRow } from "./MapExpenseRow";

/**
 * 詳細地圖：從地球的消費卡片進來，只看選取的帳本。
 * 可以依帳本、日期篩選，選了某一天會畫出當天的路線；也可以顯示目前位置。
 */
export function MapDetailScreen({
  ledgerIds,
}: {
  /** 地球上選取的帳本 */
  ledgerIds: readonly string[];
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useMapData();
  const mapRef = useRef<MapView>(null);
  /** null 代表全部選取的帳本 */
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  /** 當地日期 YYYY-MM-DD；null 代表全部日期 */
  const [date, setDate] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const userLocation = useUserLocation();

  if (error) {
    return (
      <PageMessage
        backLabel="地球"
        onBack={router.back}
        text="讀取地圖資料失敗"
      />
    );
  }
  if (!data) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]} />
    );
  }

  const pins = data.pins.filter((p) => ledgerIds.includes(p.ledgerId));
  // Picked ledgers that still have pins, in the globe's index order
  const ledgers = data.ledgers.filter(
    (l) => ledgerIds.includes(l.id) && pins.some((p) => p.ledgerId === l.id),
  );
  if (pins.length === 0) {
    return (
      <PageMessage
        backLabel="地球"
        onBack={router.back}
        text="這幾本帳本還沒有標記地點的消費。新增消費時按「使用目前位置」，足跡就會出現在地圖上。"
      />
    );
  }

  // 篩選的帳本被刪除或已沒有地點時，回到全部帳本；日期同理
  const activeLedgerId = ledgers.some((l) => l.id === ledgerId)
    ? ledgerId
    : null;
  const dates = pinDates(
    filterPins(pins, { ledgerId: activeLedgerId, date: null }),
  );
  const activeDate = date !== null && dates.includes(date) ? date : null;
  const visiblePins = filterPins(pins, {
    ledgerId: activeLedgerId,
    date: activeDate,
  });
  const groups = groupByLocation(visiblePins);
  const selected = groups.find((g) => g.key === selectedKey);
  // 只有選了某一天才畫路線，全部日期連在一起沒有意義
  const route = activeDate === null ? [] : routeOf(visiblePins);
  const title =
    ledgers.length === 1
      ? ledgers[0].kind === "personal"
        ? "個人記帳"
        : ledgers[0].name
      : `${ledgers.length} 本帳本`;

  function applyFilter(filter: PinFilter) {
    setLedgerId(filter.ledgerId);
    setDate(filter.date);
    setSelectedKey(null);
    const region = regionForPoints(
      filterPins(pins, filter).map((p) => p.point),
    );
    if (region) mapRef.current?.animateToRegion(region, 300);
  }

  function selectLedger(id: string | null) {
    // Keep the chosen day only if the new ledger has pins on it
    const keepsDate =
      activeDate !== null &&
      filterPins(pins, { ledgerId: id, date: activeDate }).length > 0;
    applyFilter({ ledgerId: id, date: keepsDate ? activeDate : null });
  }

  async function showUserLocation() {
    const result = await userLocation.locate();
    if (!result) return;
    if (!result.ok) {
      Alert.alert("無法顯示目前位置", describeMapLocateError(result.error));
      return;
    }
    const region = regionForPoints([result.value.location]);
    if (region) mapRef.current?.animateToRegion(region, 300);
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            backgroundColor: theme.background,
          },
        ]}
      >
        <BackButton label="地球" onPress={router.back} />
        <View style={styles.titleBlock}>
          <Text style={[styles.kicker, { color: theme.textMuted }]}>Map</Text>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[styles.title, { color: theme.text }]}
          >
            {title}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="顯示目前位置"
          accessibilityState={{ busy: userLocation.locating }}
          disabled={userLocation.locating}
          onPress={showUserLocation}
          style={({ pressed }) => [
            styles.locateButton,
            { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {userLocation.locating ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <Svg
              width={22}
              height={22}
              viewBox="0 0 22 22"
              fill="none"
              stroke={theme.primary}
              strokeWidth={1.6}
              strokeLinecap="round"
            >
              <Circle cx={11} cy={11} r={6.2} />
              <Circle cx={11} cy={11} r={2} fill={theme.primary} />
              <Path d="M11 1.8v3M11 17.2v3M1.8 11h3M17.2 11h3" />
            </Svg>
          )}
        </Pressable>
      </View>
      {(ledgers.length > 1 || dates.length > 1) && (
        <View style={styles.filters}>
          {ledgers.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityLabel="依帳本篩選"
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label="全部帳本"
                selected={activeLedgerId === null}
                onPress={() => selectLedger(null)}
              />
              {ledgers.map((ledger) => (
                <Chip
                  key={ledger.id}
                  label={ledgerName(ledger)}
                  selected={ledger.id === activeLedgerId}
                  onPress={() =>
                    selectLedger(
                      ledger.id === activeLedgerId ? null : ledger.id,
                    )
                  }
                />
              ))}
            </ScrollView>
          )}
          {dates.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityLabel="依日期篩選，選了某一天會畫出當天的路線"
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label="全部日期"
                selected={activeDate === null}
                onPress={() =>
                  applyFilter({ ledgerId: activeLedgerId, date: null })
                }
              />
              {dates.map((d) => (
                <Chip
                  key={d}
                  label={formatLocalDate(d)}
                  selected={d === activeDate}
                  onPress={() =>
                    applyFilter({
                      ledgerId: activeLedgerId,
                      date: d === activeDate ? null : d,
                    })
                  }
                />
              ))}
            </ScrollView>
          )}
          {activeDate !== null && (
            <Text style={[styles.routeNote, { color: theme.textMuted }]}>
              {route.length >= 2
                ? `依消費時間連起當天 ${route.length} 個地點`
                : "這天的消費都在同一個地點，沒有路線"}
            </Text>
          )}
        </View>
      )}
      <DashedLine />

      <View style={styles.fill}>
        <DayMap
          mapRef={mapRef}
          initialRegion={regionForPoints(pins.map((p) => p.point))}
          groups={groups}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          showsUser={userLocation.showsUser}
          route={route}
        />

        {selected && (
          <PinGroupCard
            group={selected}
            ledgers={ledgers}
            showLedger={activeLedgerId === null && ledgers.length > 1}
            bottom={insets.bottom + spacing.md}
            onClose={() => setSelectedKey(null)}
          />
        )}
      </View>
    </View>
  );
}

function ledgerName(ledger: MapLedger): string {
  return ledger.kind === "personal" ? "個人記帳" : ledger.name;
}

/**
 * 地圖本體與當天路線。路線用 SVG 畫在地圖上方，地圖移動時重新換算各點在畫面上的位置：
 * react-native-maps 的 Polyline、Polygon 在 iOS 實機上都沒有畫出來（2026-10-29）。
 */
function DayMap({
  mapRef,
  initialRegion,
  groups,
  selectedKey,
  onSelect,
  showsUser,
  route,
}: {
  mapRef: RefObject<MapView | null>;
  initialRegion: Region | undefined;
  groups: readonly PinGroup[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  /** 按過「顯示目前位置」取得權限後才顯示，打開頁面不會跳出權限詢問 */
  showsUser: boolean;
  /** 依時間連起的地點；少於兩點時不畫 */
  route: readonly GeoPoint[];
}) {
  const theme = useTheme();
  const routeKey = route.map((p) => `${p.latitude},${p.longitude}`).join(" ");
  const [projected, setProjected] = useState<{
    key: string;
    points: readonly { x: number; y: number }[];
  } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || route.length < 2) return;
    let active = true;
    projectRoute(map, route).then(
      (points) => active && setProjected({ key: routeKey, points }),
      () => {},
    );
    return () => {
      active = false;
    };
  }, [mapRef, route, routeKey]);

  /** 地圖移動、縮放時跟著換算 */
  function reproject() {
    const map = mapRef.current;
    if (!map || route.length < 2) return;
    projectRoute(map, route).then(
      (points) => setProjected({ key: routeKey, points }),
      () => {},
    );
  }

  // Points worked out for an earlier day are never drawn on top of a new one
  const points =
    route.length >= 2 && projected?.key === routeKey ? projected.points : [];
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join("");

  return (
    <>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        userInterfaceStyle="light"
        toolbarEnabled={false}
        showsUserLocation={showsUser}
        showsMyLocationButton={false}
        onMapReady={reproject}
        onRegionChange={reproject}
        onRegionChangeComplete={reproject}
        onPress={(event) => {
          // Android also reports marker taps here; keep the selection then
          if (event.nativeEvent.action !== "marker-press") onSelect(null);
        }}
      >
        {groups.map((group) => (
          <Marker
            key={group.key}
            coordinate={group.point}
            pinColor={group.key === selectedKey ? theme.primary : undefined}
            onPress={() => onSelect(group.key)}
          />
        ))}
      </MapView>
      {d !== "" && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {/* A paper-coloured halo keeps the line readable over busy streets */}
          <Path
            d={d}
            fill="none"
            stroke={theme.surface}
            strokeOpacity={0.85}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d={d}
            fill="none"
            stroke={theme.primary}
            strokeWidth={3.2}
            strokeDasharray="8 6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </>
  );
}

/** 地點在地圖畫面上的位置（pt） */
function projectRoute(
  map: MapView,
  route: readonly GeoPoint[],
): Promise<{ x: number; y: number }[]> {
  return Promise.all(route.map((point) => map.pointForCoordinate(point)));
}

function PinGroupCard({
  group,
  ledgers,
  showLedger,
  bottom,
  onClose,
}: {
  group: PinGroup<MapExpense>;
  ledgers: readonly MapLedger[];
  /** 顯示全部帳本時，依帳本分段並標出帳本名稱 */
  showLedger: boolean;
  bottom: number;
  onClose: () => void;
}) {
  const theme = useTheme();
  // Same order as the ledger chips
  const sections = ledgers
    .map((ledger) => ({
      ledger,
      pins: group.pins.filter((p) => p.ledgerId === ledger.id),
    }))
    .filter((s) => s.pins.length > 0);

  return (
    <View style={[styles.card, { bottom, backgroundColor: theme.surface }]}>
      <SketchFrame radius={12} />
      <Row>
        <Label muted>
          {group.pins.length > 1
            ? `這裡有 ${group.pins.length} 筆消費`
            : "消費"}
        </Label>
        <CloseButton onPress={onClose} />
      </Row>
      <ScrollView style={styles.cardList}>
        {sections.map(({ ledger, pins }) => (
          <View key={ledger.id}>
            {showLedger && <LedgerSectionHeader ledger={ledger} />}
            {pins.map((pin) => (
              <MapExpenseRow
                key={pin.id}
                expense={pin}
                ledger={ledger}
                accessibilityHint="編輯或刪除這筆消費"
                onPress={() =>
                  ledger.kind === "personal"
                    ? router.push({
                        pathname: "/personal/expense/[expenseId]",
                        params: { expenseId: pin.id },
                      })
                    : router.push({
                        pathname: "/ledger/[id]/expense/[expenseId]",
                        params: { id: pin.ledgerId, expenseId: pin.id },
                      })
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontFamily: fonts.accent,
    fontSize: 16,
    lineHeight: 18,
    paddingRight: accentOverhang(16),
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 25,
  },
  locateButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    boxShadow:
      "0px 0px 0px 1.3px rgba(58,51,45,0.6), 1px 2px 0px rgba(58,51,45,0.12)",
  },
  filters: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  routeNote: {
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  chipRow: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  card: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    maxHeight: "50%",
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardList: {
    flexGrow: 0,
  },
});
