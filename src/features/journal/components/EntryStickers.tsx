import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderHandlers,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  ENTRY_STICKER_LIMIT,
  type EntrySticker,
  type IllustrationRecord,
} from "../../../domain/journal";
import { SmallButton } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";
import { aspectOf, IllustrationArt } from "./IllustrationArt";
import { PencilIcon } from "./PencilIcon";

/** 以 id 查插圖 */
export type StickerArt = Readonly<Record<string, IllustrationRecord>>;

/**
 * 貼在日記頁上的插圖，疊在頁面上面、和頁面一樣大。位置以頁寬為單位（見 EntrySticker）。
 * 只是看的時候不接觸控（底下的照片、文字照常能點）；貼插圖時傳 panHandlers，
 * 整層接手勢，點到哪張由 useStickerBoard 判斷，所以裡面的貼紙都不接觸控。
 */
export function StickerLayer({
  stickers,
  art,
  pageWidth,
  selected = null,
  panHandlers,
}: {
  stickers: readonly EntrySticker[];
  art: StickerArt;
  pageWidth: number;
  selected?: number | null;
  panHandlers?: GestureResponderHandlers;
}) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={panHandlers ? "box-only" : "none"}
      {...panHandlers}
    >
      {pageWidth > 0 &&
        stickers.map((sticker, i) => {
          const illustration = art[sticker.illustrationId];
          if (!illustration) return null;
          return (
            <StickerView
              key={i}
              sticker={sticker}
              illustration={illustration}
              pageWidth={pageWidth}
              selected={i === selected}
            />
          );
        })}
    </View>
  );
}

function StickerView({
  sticker,
  illustration,
  pageWidth,
  selected,
}: {
  sticker: EntrySticker;
  illustration: IllustrationRecord;
  pageWidth: number;
  selected: boolean;
}) {
  const theme = useTheme();
  const width = sticker.size * pageWidth;
  const height = width * aspectOf(illustration.strokes);
  return (
    <View
      accessibilityLabel="手繪插圖"
      style={[
        styles.sticker,
        {
          left: sticker.x * pageWidth - width / 2,
          top: sticker.y * pageWidth - height / 2,
          width,
          height,
          transform: [{ rotate: `${sticker.rotation}deg` }],
        },
      ]}
    >
      <IllustrationArt
        strokes={illustration.strokes}
        width={width}
        height={height}
      />
      {selected && (
        <View style={[styles.selected, { borderColor: theme.primary }]} />
      )}
    </View>
  );
}

/**
 * 頁面至少要多高（px），才放得下最下面那張貼紙：換了比較窄的手機、文字折行變少時，
 * 頁面變短也不會把貼紙切掉。轉過的貼紙用對角線估算。
 */
export function stickersBottom(
  stickers: readonly EntrySticker[],
  art: StickerArt,
  pageWidth: number,
): number {
  let bottom = 0;
  for (const sticker of stickers) {
    const illustration = art[sticker.illustrationId];
    if (!illustration) continue;
    const aspect = aspectOf(illustration.strokes);
    const reach = (sticker.size * Math.hypot(1, aspect)) / 2;
    bottom = Math.max(bottom, (sticker.y + reach) * pageWidth);
  }
  return bottom;
}

const THUMB = 60;

/**
 * 貼插圖時畫面下方的插圖抽屜：點一張貼到頁面上；最前面是「畫新的」。
 * 選了頁面上的貼紙時多一個「拿掉」。
 */
export function StickerTray({
  library,
  full,
  hasSelection,
  bottomInset,
  onAdd,
  onRemove,
  onLayout,
}: {
  library: readonly IllustrationRecord[] | null;
  full: boolean;
  hasSelection: boolean;
  bottomInset: number;
  onAdd: (illustration: IllustrationRecord) => void;
  onRemove: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const theme = useTheme();
  const hint = full
    ? `一篇日記最多貼 ${ENTRY_STICKER_LIMIT} 張插圖`
    : hasSelection
      ? "拖曳移動，兩指捏合可以縮放、轉動"
      : library?.length === 0
        ? "還沒有插圖，先畫一張吧"
        : "點一張插圖貼上去，再點頁面上的插圖可以移動";
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.tray,
        { backgroundColor: theme.background, paddingBottom: bottomInset + 10 },
      ]}
    >
      <View style={styles.trayHead}>
        <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>
        {hasSelection && (
          <SmallButton
            title="拿掉"
            icon={<TrashIcon color={theme.text} />}
            onPress={onRemove}
          />
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trayRow}
      >
        <TrayCard
          label="畫新的插圖"
          onPress={() => router.push("/illustrations/draw")}
        >
          <PencilIcon color={theme.text} size={20} />
          <Text style={[styles.drawText, { color: theme.text }]}>畫新的</Text>
        </TrayCard>
        {library?.map((illustration) => (
          <TrayCard
            key={illustration.id}
            label="貼上這張插圖"
            disabled={full}
            onPress={() => onAdd(illustration)}
          >
            <IllustrationArt
              strokes={illustration.strokes}
              width={THUMB - 12}
              height={THUMB - 12}
            />
          </TrayCard>
        ))}
      </ScrollView>
    </View>
  );
}

function TrayCard({
  label,
  disabled = false,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

/** 「貼插圖」按鈕的圖示：右下角翻起來的貼紙 */
export function StickerIcon({
  color,
  size = 17,
}: {
  color: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 13.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7.5zM20 13.5h-4.5a2 2 0 0 0-2 2V20M8.5 10.5c.8 1.2 2 1.8 3.5 1.8s2.7-.6 3.5-1.8M9 8v.1M15 8v.1" />
    </Svg>
  );
}

function TrashIcon({ color }: { color: string }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7M6.5 6.5l.9 12.6c.1 1 .9 1.4 1.7 1.4h5.8c.8 0 1.6-.4 1.7-1.4l.9-12.6" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  sticker: {
    position: "absolute",
  },
  selected: {
    position: "absolute",
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 6,
  },
  tray: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 8,
    paddingTop: 12,
    boxShadow: "0px -2px 10px rgba(58,51,45,0.1)",
  },
  trayHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 36,
    paddingHorizontal: 16,
  },
  hint: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  trayRow: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  card: {
    width: THUMB,
    height: THUMB,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "#FFFDF8",
    borderRadius: 8,
    boxShadow: "0px 0px 0px 1px rgba(58,51,45,0.18)",
  },
  drawText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
});
