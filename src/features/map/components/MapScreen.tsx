import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import {
  groupByLocation,
  regionForPoints,
  type PinGroup,
} from "../../../domain/map";
import { Label, MessageScreen, Row } from "../../../shared/ui/components";
import { spacing, useTheme } from "../../../shared/ui/theme";
import { formatLocalDateTime } from "../../ledger/services/localTimestamp";
import { useMapData } from "../hooks/useMapData";
import { filterPins, type MapLedger } from "../services/mapData";

export function MapScreen() {
  const theme = useTheme();
  const { data, error } = useMapData();
  const mapRef = useRef<MapView>(null);
  /** null 代表全部帳本 */
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (error) return <MessageScreen text="讀取地圖資料失敗" />;
  if (!data) return null;
  if (data.pins.length === 0) {
    return (
      <MessageScreen text="新增消費時按「使用目前位置」記錄地點，就會出現在地圖上。" />
    );
  }

  // 篩選的帳本被刪除或已沒有地點時，回到全部帳本
  const activeLedgerId = data.ledgers.some((l) => l.id === ledgerId)
    ? ledgerId
    : null;
  const groups = groupByLocation(filterPins(data.pins, activeLedgerId));
  const selected = groups.find((g) => g.key === selectedKey);

  function selectLedger(id: string | null) {
    setLedgerId(id);
    setSelectedKey(null);
    const region = regionForPoints(
      filterPins(data?.pins ?? [], id).map((p) => p.point),
    );
    if (region) mapRef.current?.animateToRegion(region, 300);
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={regionForPoints(data.pins.map((p) => p.point))}
        userInterfaceStyle={theme.isDark ? "dark" : "light"}
        toolbarEnabled={false}
        onPress={(event) => {
          // Android also reports marker taps here; keep the selection then
          if (event.nativeEvent.action !== "marker-press") setSelectedKey(null);
        }}
      >
        {groups.map((group) => (
          <Marker
            key={group.key}
            coordinate={group.point}
            pinColor={group.key === selectedKey ? theme.primary : undefined}
            onPress={() => setSelectedKey(group.key)}
          />
        ))}
      </MapView>

      {selected && (
        <PinGroupCard
          group={selected}
          ledgers={data.ledgers}
          showLedger={activeLedgerId === null && data.ledgers.length > 1}
          onClose={() => setSelectedKey(null)}
        />
      )}

      {/* Rendered last so the open menu and its backdrop sit above the card */}
      {data.ledgers.length > 1 && (
        <LedgerDropdown
          ledgers={data.ledgers}
          selectedId={activeLedgerId}
          onSelect={selectLedger}
        />
      )}
    </View>
  );
}

const ALL_LEDGERS: MapLedger = { id: "", name: "全部帳本" };

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
  const ledgerName = (id: string) =>
    ledgers.find((l) => l.id === id)?.name ?? "";

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
              router.push({
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
              {showLedger && ` · ${ledgerName(pin.ledgerId)}`}
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
