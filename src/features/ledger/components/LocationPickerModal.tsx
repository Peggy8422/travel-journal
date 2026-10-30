import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import type { GeoPoint } from "../../../domain/ledger";
import { regionForPoints, type MapRegion } from "../../../domain/map";
import { Label } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { spacing, useTheme } from "../../../shared/ui/theme";

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
 * 在地圖上選消費地點：點地圖放標記，或拖曳標記微調。
 * 用 React Native 的 Modal 而不是路由，選好的座標直接交回表單，不用跨畫面傳值。
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
  onConfirm: (point: GeoPoint) => void;
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
  onConfirm: (point: GeoPoint) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [point, setPoint] = useState(initialPoint);
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
          onPress={() => point && onConfirm(point)}
        />
      </View>

      <View style={styles.mapArea}>
        {startRegion && (
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={startRegion}
            userInterfaceStyle={theme.isDark ? "dark" : "light"}
            toolbarEnabled={false}
            onPress={(event) => {
              // Android also reports marker taps here; dragging handles those
              if (event.nativeEvent.action === "marker-press") return;
              setPoint(event.nativeEvent.coordinate);
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
          <Label muted>
            {point
              ? "拖曳標記可以微調，或點地圖其他地方重新放置"
              : "點一下地圖放置標記"}
          </Label>
        </View>
      </View>
    </View>
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
  mapArea: {
    flex: 1,
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
