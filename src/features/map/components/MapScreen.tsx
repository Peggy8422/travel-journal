import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import {
  groupByLocation,
  pinDates,
  regionForPoints,
  routeOf,
  type PinGroup,
} from "../../../domain/map";
import { Chip, Label, MessageScreen, Row } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { spacing, useTheme } from "../../../shared/ui/theme";
import { describeMapLocateError } from "../../ledger/components/messages";
import {
  formatLocalDate,
  formatLocalDateTime,
} from "../../ledger/services/localTimestamp";
import { useMapData } from "../hooks/useMapData";
import { useUserLocation } from "../hooks/useUserLocation";
import {
  filterPins,
  type MapLedger,
  type PinFilter,
} from "../services/mapData";

export function MapScreen() {
  const theme = useTheme();
  const { data, error } = useMapData();
  const mapRef = useRef<MapView>(null);
  /** null 代表全部帳本 */
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  /** 當地日期 YYYY-MM-DD；null 代表全部日期 */
  const [date, setDate] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const userLocation = useUserLocation();

  if (error) return <MessageScreen text="讀取地圖資料失敗" />;
  if (!data) return null;
  if (data.pins.length === 0) {
    return (
      <MessageScreen text="新增消費時按「使用目前位置」記錄地點，就會出現在地圖上。" />
    );
  }

  const { pins, ledgers } = data;
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
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={regionForPoints(pins.map((p) => p.point))}
        userInterfaceStyle={theme.isDark ? "dark" : "light"}
        toolbarEnabled={false}
        // Only after the button got permission, so opening the tab never prompts
        showsUserLocation={userLocation.showsUser}
        showsMyLocationButton={false}
        onPress={(event) => {
          // Android also reports marker taps here; keep the selection then
          if (event.nativeEvent.action !== "marker-press") setSelectedKey(null);
        }}
      >
        {route.length > 0 && (
          <Polyline
            coordinates={route}
            strokeColor={theme.primary}
            strokeWidth={3}
          />
        )}
        {groups.map((group) => (
          <Marker
            key={group.key}
            coordinate={group.point}
            pinColor={group.key === selectedKey ? theme.primary : undefined}
            onPress={() => setSelectedKey(group.key)}
          />
        ))}
      </MapView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="顯示目前位置"
        accessibilityState={{ busy: userLocation.locating }}
        disabled={userLocation.locating}
        onPress={showUserLocation}
        style={({ pressed }) => [
          styles.locateButton,
          { backgroundColor: theme.surface, borderColor: theme.border },
          pressed && { backgroundColor: theme.chip },
        ]}
      >
        {userLocation.locating ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <Text style={[styles.locateIcon, { color: theme.primary }]}>◎</Text>
        )}
      </Pressable>

      {dates.length > 1 && (
        <DateStrip
          dates={dates}
          selectedDate={activeDate}
          onSelect={(d) => applyFilter({ ledgerId: activeLedgerId, date: d })}
        />
      )}

      {selected && (
        <PinGroupCard
          group={selected}
          ledgers={ledgers}
          showLedger={activeLedgerId === null && ledgers.length > 1}
          onClose={() => setSelectedKey(null)}
        />
      )}

      {/* Rendered last so the open menu and its backdrop sit above the card */}
      {ledgers.length > 1 && (
        <LedgerDropdown
          ledgers={ledgers}
          selectedId={activeLedgerId}
          onSelect={selectLedger}
        />
      )}
    </View>
  );
}

/** 日期篩選，橫向捲動；選了某一天時地圖會畫出當天的路線 */
function DateStrip({
  dates,
  selectedDate,
  onSelect,
}: {
  dates: readonly string[];
  selectedDate: string | null;
  onSelect: (date: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.dateStrip}
      contentContainerStyle={styles.dateStripContent}
    >
      <Chip
        label="全部日期"
        selected={selectedDate === null}
        onPress={() => onSelect(null)}
      />
      {dates.map((d) => (
        <Chip
          key={d}
          label={formatLocalDate(d)}
          selected={d === selectedDate}
          onPress={() => onSelect(d)}
        />
      ))}
    </ScrollView>
  );
}

const ALL_LEDGERS: MapLedger = { id: "", name: "全部帳本", kind: "shared" };

function LedgerDropdown({
  ledgers,
  selectedId,
  onSelect,
}: {
  ledgers: readonly MapLedger[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selectedName =
    ledgers.find((l) => l.id === selectedId)?.name ?? ALL_LEDGERS.name;
  const options = [ALL_LEDGERS, ...ledgers];
  const panel = { backgroundColor: theme.surface, borderColor: theme.border };

  return (
    <>
      {open && (
        // Tapping anywhere outside the menu closes it without touching the map
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="關閉帳本選單"
          onPress={() => setOpen(false)}
        />
      )}
      <View style={styles.dropdown}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`篩選帳本，目前是${selectedName}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((o) => !o)}
          style={[styles.dropdownTrigger, panel]}
        >
          <Text
            numberOfLines={1}
            style={[styles.dropdownText, { color: theme.text }]}
          >
            {selectedName}
          </Text>
          <Text style={{ color: theme.textMuted }}>{open ? "▴" : "▾"}</Text>
        </Pressable>
        {open && (
          <ScrollView style={[styles.dropdownMenu, panel]}>
            {options.map((ledger) => {
              const id = ledger === ALL_LEDGERS ? null : ledger.id;
              const selected = id === selectedId;
              return (
                <Pressable
                  key={ledger.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setOpen(false);
                    if (!selected) onSelect(id);
                  }}
                  style={({ pressed }) => [
                    styles.dropdownOption,
                    pressed && { backgroundColor: theme.chip },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.dropdownText,
                      { color: selected ? theme.primary : theme.text },
                    ]}
                  >
                    {ledger.name}
                  </Text>
                  {selected && <Text style={{ color: theme.primary }}>✓</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </>
  );
}

function PinGroupCard({
  group,
  ledgers,
  showLedger,
  onClose,
}: {
  group: PinGroup;
  ledgers: readonly MapLedger[];
  /** 顯示全部帳本時，標出每筆消費屬於哪本帳本 */
  showLedger: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const ledgerOf = (id: string) => ledgers.find((l) => l.id === id);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <Row>
        <Label muted>
          {group.pins.length > 1
            ? `這裡有 ${group.pins.length} 筆消費`
            : "消費"}
        </Label>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="關閉"
          hitSlop={spacing.md}
          onPress={onClose}
        >
          <Label muted>關閉</Label>
        </Pressable>
      </Row>
      <ScrollView style={styles.cardList}>
        {group.pins.map((pin) => (
          <Pressable
            key={pin.id}
            accessibilityRole="button"
            accessibilityHint="編輯或刪除這筆消費"
            onPress={() =>
              ledgerOf(pin.ledgerId)?.kind === "personal"
                ? router.push({
                    pathname: "/personal/expense/[expenseId]",
                    params: { expenseId: pin.id },
                  })
                : router.push({
                    pathname: "/ledger/[id]/expense/[expenseId]",
                    params: { id: pin.ledgerId, expenseId: pin.id },
                  })
            }
            style={({ pressed }) => [
              styles.cardItem,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Label>{pin.title}</Label>
            {pin.subtitle !== null && <Label muted>{pin.subtitle}</Label>}
            <Label muted>
              {formatLocalDateTime(pin.occurredAt)}
              {showLedger && ` · ${ledgerOf(pin.ledgerId)?.name ?? ""}`}
            </Label>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dropdown: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.md,
    maxWidth: "70%",
    gap: spacing.xs,
  },
  locateButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.md,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  locateIcon: {
    fontSize: 22,
  },
  dateStrip: {
    position: "absolute",
    // Below the ledger dropdown and the locate button
    top: spacing.sm * 2 + 44,
    left: 0,
    right: 0,
    flexGrow: 0,
  },
  dateStripContent: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dropdownMenu: {
    maxHeight: 280,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  dropdownText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  card: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    maxHeight: "45%",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardList: {
    flexGrow: 0,
  },
  cardItem: {
    paddingVertical: spacing.sm,
    gap: 2,
  },
});
