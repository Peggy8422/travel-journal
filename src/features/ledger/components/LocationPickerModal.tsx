import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import Svg, { Path } from "react-native-svg";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import type { GeoPoint } from "../../../domain/ledger";
import { regionForPoints, type MapRegion } from "../../../domain/map";
import type { FoundPlace } from "../../../domain/location";
import { ErrorText, Label } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { spacing, useTheme } from "../../../shared/ui/theme";
import { usePlaceSearch } from "../hooks/usePlaceSearch";
import { describeError } from "./messages";

/** 沒有地點、也拿不到最近位置時，先顯示整個臺灣 */
const DEFAULT_REGION: MapRegion = {
  latitude: 23.7,
  longitude: 120.95,
  latitudeDelta: 4,
  longitudeDelta: 4,
};

/** 選點時放大到看得出街道（約 500 公尺） */
const PICK_DELTA = 0.005;

function regionAround(point: GeoPoint): MapRegion {
  return regionForPoints([point], { minDelta: PICK_DELTA }) ?? DEFAULT_REGION;
}

/**
 * 在地圖上選地點：搜尋地名（只有 iOS，用 Apple 地圖），或點地圖放標記，再拖曳標記微調。
 * 用 React Native 的 Modal 而不是路由，選好的座標直接交回表單，不用跨畫面傳值。
 * 從搜尋結果選的地點會一起交回名稱，表單就不用再用座標反查地名。
 */
export function LocationPickerModal({
  visible,
  initialPoint,
  loadStartPoint,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  /** 表單已有的座標；有的話從這裡開始 */
  initialPoint: GeoPoint | null;
  /** 沒有座標時一開始要看的位置，例如最近一次已知位置 */
  loadStartPoint: () => Promise<GeoPoint | null>;
  onCancel: () => void;
  /** placeName 是搜尋結果的名稱；點地圖放的標記為 null */
  onConfirm: (point: GeoPoint, placeName: string | null) => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      {/* A modal is a separate native window, so it needs its own provider for insets */}
      <SafeAreaProvider>
        {visible && (
          <PickerContent
            initialPoint={initialPoint}
            loadStartPoint={loadStartPoint}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        )}
      </SafeAreaProvider>
    </Modal>
  );
}

function PickerContent({
  initialPoint,
  loadStartPoint,
  onCancel,
  onConfirm,
}: {
  initialPoint: GeoPoint | null;
  loadStartPoint: () => Promise<GeoPoint | null>;
  onCancel: () => void;
  onConfirm: (point: GeoPoint, placeName: string | null) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState(initialPoint);
  /** 從搜尋結果選的名稱；改點地圖別的地方就不算了，拖曳微調仍算 */
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const placeSearch = usePlaceSearch();
  const mapRef = useRef<MapView>(null);
  /** 地圖目前看的範圍，搜尋時優先找附近 */
  const visibleRegion = useRef<MapRegion | null>(null);
  // MapView only reads initialRegion once, so wait for the start point before showing it
  const [startRegion, setStartRegion] = useState<MapRegion | null>(
    initialPoint ? regionAround(initialPoint) : null,
  );

  useEffect(() => {
    if (initialPoint) return;
    let active = true;
    void loadStartPoint().then((start) => {
      if (active) setStartRegion(start ? regionAround(start) : DEFAULT_REGION);
    });
    return () => {
      active = false;
    };
  }, [initialPoint, loadStartPoint]);

  function submitSearch() {
    if (query.trim() === "") return;
    setListOpen(true);
    void placeSearch.run(query, visibleRegion.current ?? startRegion);
  }

  function changeQuery(text: string) {
    setQuery(text);
    if (text.trim() === "") {
      placeSearch.clear();
      setListOpen(false);
    }
  }

  function choose(place: FoundPlace) {
    Keyboard.dismiss();
    setListOpen(false);
    setPoint(place.location);
    setPickedName(place.name);
    mapRef.current?.animateToRegion(regionAround(place.location), 350);
  }

  const state = placeSearch.state;
  const hint = pickedName
    ? `已選「${pickedName}」，拖曳標記可以微調`
    : point
      ? "拖曳標記可以微調，或點地圖其他地方重新放置"
      : placeSearch.available
        ? "搜尋地點，或點一下地圖放置標記"
        : "點一下地圖放置標記";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <HeaderButton title="取消" onPress={onCancel} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          選擇地點
        </Text>
        <HeaderButton
          title="完成"
          bold
          disabled={point === null}
          onPress={() => point && onConfirm(point, pickedName)}
        />
      </View>

      {placeSearch.available && (
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.searchField, { backgroundColor: theme.chip }]}>
            <SearchIcon color={theme.textMuted} />
            <TextInput
              accessibilityLabel="搜尋地點"
              value={query}
              onChangeText={changeQuery}
              onSubmitEditing={submitSearch}
              onFocus={() => {
                if (state.status !== "idle") setListOpen(true);
              }}
              placeholder="搜尋地點，例如：清水寺、一蘭"
              placeholderTextColor={theme.textMuted}
              returnKeyType="search"
              clearButtonMode="while-editing"
              autoCorrect={false}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>
        </View>
      )}

      <View style={styles.mapArea}>
        {startRegion && (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={startRegion}
            userInterfaceStyle={theme.isDark ? "dark" : "light"}
            toolbarEnabled={false}
            onRegionChangeComplete={(region) => {
              visibleRegion.current = region;
            }}
            onPress={(event) => {
              // Android also reports marker taps here; dragging handles those
              if (event.nativeEvent.action === "marker-press") return;
              // The first tap only closes the search results
              if (listOpen) {
                Keyboard.dismiss();
                setListOpen(false);
                return;
              }
              setPoint(event.nativeEvent.coordinate);
              setPickedName(null);
            }}
          >
            {point && (
              <Marker
                coordinate={point}
                pinColor={theme.primary}
                draggable
                onDragEnd={(event) => setPoint(event.nativeEvent.coordinate)}
              />
            )}
          </MapView>
        )}
        <View
          style={[
            styles.hint,
            {
              bottom: insets.bottom + spacing.md,
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Label muted>{hint}</Label>
        </View>
        {listOpen && state.status !== "idle" && (
          <View
            style={[
              styles.results,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            {state.status === "searching" ? (
              <View style={styles.resultNote}>
                <Label muted>搜尋中…</Label>
              </View>
            ) : !state.result.ok ? (
              <View style={styles.resultNote}>
                <ErrorText message={describeError(state.result.error)} />
              </View>
            ) : state.result.value.length === 0 ? (
              <View style={styles.resultNote}>
                <Label muted>
                  找不到「{state.query}」，換個關鍵字，或直接點地圖放置標記
                </Label>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled">
                {state.result.value.map((place, i) => (
                  <Pressable
                    key={`${place.name}@${place.location.latitude},${place.location.longitude}`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      place.address
                        ? `${place.name}，${place.address}`
                        : place.name
                    }
                    accessibilityHint="在地圖上放置這個地點的標記"
                    onPress={() => choose(place)}
                    style={({ pressed }) => [
                      styles.result,
                      i > 0 && {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderColor: theme.border,
                      },
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.resultName, { color: theme.text }]}
                    >
                      {place.name}
                    </Text>
                    {place.address && (
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.resultAddress,
                          { color: theme.textMuted },
                        ]}
                      >
                        {place.address}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
    >
      <Path d="M7 2.6c2.5-.1 4.4 1.8 4.4 4.3 0 2.4-1.9 4.4-4.4 4.4-2.4 0-4.4-1.9-4.4-4.3C2.6 4.6 4.5 2.7 7 2.6zM10.3 10.4l3.2 3.1" />
    </Svg>
  );
}

function HeaderButton({
  title,
  onPress,
  disabled,
  bold,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  bold?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={spacing.md}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Text
        style={[
          styles.headerButton,
          { color: theme.primary },
          bold && styles.headerButtonBold,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  headerButton: {
    fontFamily: fonts.regular,
    fontSize: 17,
  },
  headerButtonBold: {
    fontFamily: fonts.bold,
  },
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingLeft: 12,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingRight: 8,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  mapArea: {
    flex: 1,
  },
  results: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    maxHeight: "60%",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: "0px 6px 18px rgba(58,51,45,0.16)",
    overflow: "hidden",
  },
  resultNote: {
    padding: spacing.md,
  },
  result: {
    minHeight: 52,
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  resultName: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  resultAddress: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  hint: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
});
