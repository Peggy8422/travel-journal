import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { JournalPlace } from "../../../domain/journal";
import { TEXT_LIMITS, type GeoPoint } from "../../../domain/ledger";
import { ErrorText, Label, SmallButton } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";
import { LocationPickerModal } from "../../ledger/components/LocationPickerModal";
import { describeError } from "../../ledger/components/messages";
import { useCurrentPlace } from "../../ledger/hooks/useCurrentPlace";

/** 表單上的一個地點；key 只給畫面用，不會存起來 */
interface PlaceDraft {
  readonly key: number;
  readonly name: string;
  readonly location: GeoPoint;
}

let nextKey = 0;

function draft(name: string, location: GeoPoint): PlaceDraft {
  nextKey += 1;
  return { key: nextKey, name, location };
}

/** 反查到的地名截到地名的字數上限，免得儲存時被擋 */
function suggested(name: string | null): string {
  return name?.slice(0, TEXT_LIMITS.placeName).trim() ?? "";
}

/**
 * 日記表單的地點：用目前位置或在地圖上選，地名先用反查到的，查不到再讓使用者自己打。
 * 儲存時用 toPlaces 交給指令檢查（地名不能空白）。
 */
export function useEntryPlaces(saved: readonly JournalPlace[]) {
  const currentPlace = useCurrentPlace();
  const [places, setPlaces] = useState<readonly PlaceDraft[]>(() =>
    saved.map((p) => draft(p.name, p.location)),
  );
  const [picking, setPicking] = useState(false);
  /** 剛加進來、還沒有地名的那一個，畫面把游標放過去 */
  const [focusKey, setFocusKey] = useState<number | null>(null);

  function append(name: string, location: GeoPoint): PlaceDraft {
    const added = draft(name, location);
    setPlaces((list) => [...list, added]);
    return added;
  }

  async function addCurrent() {
    const result = await currentPlace.locate();
    if (!result?.ok) return;
    const added = append(
      suggested(result.value.placeName),
      result.value.location,
    );
    if (added.name === "") setFocusKey(added.key);
  }

  async function addPicked(point: GeoPoint) {
    setPicking(false);
    // Keep the point even if the name lookup is slow or fails
    const added = append("", point);
    const result = await currentPlace.describe(point);
    const name = result?.ok ? suggested(result.value.placeName) : "";
    if (name === "") {
      setFocusKey(added.key);
      return;
    }
    // Only fill the name if it is still blank: it may have been typed meanwhile
    setPlaces((list) =>
      list.map((p) =>
        p.key === added.key && p.name === "" ? { ...p, name } : p,
      ),
    );
  }

  function rename(key: number, name: string) {
    setPlaces((list) => list.map((p) => (p.key === key ? { ...p, name } : p)));
  }

  function remove(key: number) {
    setPlaces((list) => list.filter((p) => p.key !== key));
  }

  return {
    places,
    focusKey,
    locateState: currentPlace.state,
    busy: currentPlace.state.status === "locating",
    picking,
    /** 地圖選點一開始看最後一個地點，沒有地點時看最近一次已知位置 */
    pickStart: places[places.length - 1]?.location ?? null,
    loadStartPoint: currentPlace.startPoint,
    addCurrent,
    addPicked,
    openPicker: () => setPicking(true),
    closePicker: () => setPicking(false),
    rename,
    remove,
    toPlaces: (): JournalPlace[] =>
      places.map(({ name, location }) => ({ name, location })),
  };
}

export type EntryPlaces = ReturnType<typeof useEntryPlaces>;

/** 「去過的地方」：一列一個地點（地名可以改、× 拿掉），下面是加地點的兩個按鈕 */
export function EntryPlaceField({
  places,
  error,
}: {
  places: EntryPlaces;
  error: string | null;
}) {
  const theme = useTheme();
  const state = places.locateState;
  const located =
    state.status === "done" && state.result.ok ? state.result.value : undefined;
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>去過的地方</Text>
      {places.places.map((place, i) => (
        <View
          key={place.key}
          style={[styles.row, { backgroundColor: theme.surface }]}
        >
          <PlacePinIcon size={17} filled />
          <TextInput
            accessibilityLabel={`第 ${i + 1} 個地點的名稱`}
            value={place.name}
            onChangeText={(name) => places.rename(place.key, name)}
            maxLength={Math.max(TEXT_LIMITS.placeName, place.name.length)}
            placeholder="輸入地名，例如：清水寺"
            placeholderTextColor={theme.textMuted}
            autoFocus={place.key === places.focusKey}
            style={[styles.name, { color: theme.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`拿掉地點「${place.name || `第 ${i + 1} 個`}」`}
            onPress={() => places.remove(place.key)}
            style={({ pressed }) => [
              styles.remove,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Svg
              width={14}
              height={14}
              viewBox="0 0 16 16"
              fill="none"
              stroke={theme.textMuted}
              strokeWidth={1.6}
              strokeLinecap="round"
            >
              <Path d="M4.5 4.6l7 6.9M11.4 4.5l-6.8 7" />
            </Svg>
          </Pressable>
        </View>
      ))}
      <View style={styles.buttons}>
        <SmallButton
          title="目前位置"
          icon={<PlacePinIcon size={16} color={theme.text} />}
          onPress={places.addCurrent}
          disabled={places.busy}
        />
        <SmallButton
          title="在地圖上選"
          icon={<GlobeIcon size={16} color={theme.text} />}
          onPress={places.openPicker}
          disabled={places.busy}
        />
      </View>
      {places.busy && <Label muted>取得地點中…</Label>}
      {state.status === "done" && !state.result.ok && (
        <ErrorText message={describeError(state.result.error)} />
      )}
      {located?.approximate && (
        <Label muted>目前無法精確定位，使用的是最近一次的位置</Label>
      )}
      {located?.placeNameLookupFailed && (
        <Label muted>查不到地名（可能沒有網路），請自行輸入</Label>
      )}
      <Text style={[styles.hint, { color: theme.textMuted }]}>
        地點會出現在地球和詳細地圖上。
      </Text>
      <ErrorText message={error} />
      <LocationPickerModal
        visible={places.picking}
        initialPoint={places.pickStart}
        loadStartPoint={places.loadStartPoint}
        onCancel={places.closePicker}
        onConfirm={places.addPicked}
      />
    </View>
  );
}

const PIN_PATH =
  "M8 14.6c-2.9-3.2-4.6-5.6-4.6-7.8C3.4 4.3 5.4 2.6 8 2.6s4.6 1.7 4.6 4.2c0 2.2-1.7 4.6-4.6 7.8zM9.6 6.8a1.6 1.6 0 1 1-3.2 0a1.6 1.6 0 1 1 3.2 0z";

/** 地點的圖釘；filled 是日記裡地點清單用的朱色圖釘 */
export function PlacePinIcon({
  size,
  filled = false,
  color,
}: {
  size: number;
  filled?: boolean;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? "#F2D2C4" : "none"}
      stroke={filled ? "#A3452E" : color}
      strokeWidth={filled ? 1.3 : 1.4}
      strokeLinejoin="round"
    >
      <Path d={PIN_PATH} />
    </Svg>
  );
}

/** 手繪的小地球（在地圖上選、在地圖上看） */
export function GlobeIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M13 3.6c5.4-.2 9.5 4 9.4 9.5-.1 5.3-4.3 9.3-9.6 9.2C7.5 22.2 3.5 18 3.6 12.8 3.7 7.6 7.8 3.7 13 3.6z" />
      <Path d="M4.4 9.6c5.6 1.4 11.6 1.3 17.3-.1M4.2 16.2c5.7 1.2 11.8 1.3 17.5 0" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingLeft: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 17,
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.3)",
  },
  name: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  remove: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 19,
  },
});
