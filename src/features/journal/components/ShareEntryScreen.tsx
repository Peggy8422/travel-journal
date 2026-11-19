import * as Clipboard from "expo-clipboard";
import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import {
  PixelRatio,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import {
  captureCard,
  PhotoLibraryDeniedError,
  saveToPhotoLibrary,
  SHARE_ALBUM,
  shareImage,
} from "../../../data/files/shareImages";
import {
  Button,
  ErrorText,
  HeaderAction,
  MessageScreen,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { PaperBackground } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { ToastProvider, useToast } from "../../../shared/ui/Toast";
import { describeError } from "../../ledger/components/messages";
import { useEntry } from "../hooks/useJournalQueries";
import type { EntryDetail } from "../services/entryCommands";
import {
  entrySharePages,
  shareCaption,
  sharePageLabel,
  sharePagePhotos,
  type ShareFormat,
  type SharePage,
} from "../services/shareEntry";
import {
  SHARE_CARD_WIDTH,
  SHARE_IMAGE_WIDTH,
  ShareCard,
  shareCardSize,
  type ShareCardView,
} from "./ShareCards";

/** 預覽卡片縮小的比例：貼文一次看得到一張多，限動比較高所以再小一點 */
const THUMB_SCALE: Record<ShareFormat, number> = { post: 0.62, story: 0.5 };
const FORMATS: readonly { format: ShareFormat; label: string }[] = [
  { format: "post", label: "貼文 4:5" },
  { format: "story", label: "限動 9:16" },
];
/** 底部按鈕列（不含安全區域）的高度：上下留白加兩顆按鈕，提示要浮在它上面 */
const BAR_PADDING = 12;
const BAR_GAP = 8;
const BAR_HEIGHT = BAR_PADDING * 2 + 48 * 2 + BAR_GAP;

/**
 * 分享到 IG：把一篇日記做成輪播貼文的幾張圖片，或一張限動拼貼。
 * 貼文勾選的頁面依序存進照片 App 的「旅遊手帳」相簿，使用者到 IG 新增貼文時一次選取；
 * 也可以只分享正在看的那一張。限動直接打開分享選單，選 Instagram 的「限時動態」。
 * IG 不會帶入分享時的文字，貼文文字讓使用者複製後自己貼上。
 */
export function ShareEntryScreen({ entryId }: { entryId: string }) {
  const { data, error } = useEntry(entryId);
  return (
    // The native modal covers the root toast, so this screen shows its own
    <ToastProvider offset={BAR_HEIGHT + 14}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <HeaderAction title="取消" onPress={() => router.back()} />
          ),
        }}
      />
      {error ? (
        <MessageScreen text="讀取日記失敗" />
      ) : !data ? null : !data.ok ? (
        <MessageScreen text={describeError(data.error)} />
      ) : (
        <SharePreview detail={data.value} />
      )}
    </ToastProvider>
  );
}

function SharePreview({ detail }: { detail: EntryDetail }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { entry } = detail;
  const [format, setFormat] = useState<ShareFormat>("post");
  const post = format === "post";
  const pages = entrySharePages(entry, format);
  /** 取消勾選、不存的頁面 */
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  /** 已經載入完的照片，「頁面:第幾張」 */
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const cards = useRef(new Map<string, ShareCardView>());

  const currentPage = pages[Math.min(current, pages.length - 1)]!;
  const chosen = post ? pages.filter((page) => !off.has(page.key)) : pages;
  const isReady = (page: SharePage) =>
    sharePagePhotos(page, entry).every((_, i) =>
      loaded.has(`${page.key}:${i}`),
    );
  const allReady = chosen.every(isReady);
  const caption = shareCaption(detail);
  const size = shareCardSize(format);
  const scale = THUMB_SCALE[format];

  function pickFormat(next: ShareFormat) {
    setFormat(next);
    setCurrent(0);
    setFailure(null);
  }

  async function capture(page: SharePage): Promise<string> {
    const view = cards.current.get(page.key);
    if (!view) throw new Error(`Card ${page.key} is not on screen`);
    return captureCard(view, {
      pixelWidth: SHARE_IMAGE_WIDTH,
      pixelHeight: size.pixelHeight,
      pixelRatio: PixelRatio.get(),
    });
  }

  async function save() {
    setFailure(null);
    setBusy(true);
    try {
      const uris: string[] = [];
      for (const page of chosen) uris.push(await capture(page));
      const { inAlbum } = await saveToPhotoLibrary(uris);
      toast(
        inAlbum
          ? `存進「${SHARE_ALBUM}」相簿了（${uris.length} 張）`
          : `存進照片了（${uris.length} 張），沒有完整的照片權限，所以沒放進相簿`,
      );
    } catch (e) {
      setFailure(
        e instanceof PhotoLibraryDeniedError
          ? "沒有加入照片的權限：請到 iPhone 的「設定」允許加入照片，再試一次"
          : "存不進相簿，請再試一次",
      );
    } finally {
      setBusy(false);
    }
  }

  async function shareCurrent() {
    setFailure(null);
    setBusy(true);
    try {
      await shareImage(await capture(currentPage));
    } catch {
      setFailure("打不開分享選單，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  async function copyCaption() {
    await Clipboard.setStringAsync(caption);
    toast("已複製貼文文字");
  }

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View
          accessibilityRole="tablist"
          style={[styles.formats, { backgroundColor: theme.chip }]}
        >
          {FORMATS.map((item) => {
            const on = item.format === format;
            return (
              <Pressable
                key={item.format}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => pickFormat(item.format)}
                style={[styles.format, on && styles.formatOn]}
              >
                <Text
                  style={[
                    styles.formatText,
                    {
                      color: theme.text,
                      fontFamily: on ? fonts.bold : fonts.regular,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pages}
        >
          {pages.map((page, i) => {
            const checked = !off.has(page.key);
            const selected = page.key === currentPage.key;
            const label = sharePageLabel(page);
            return (
              <View key={page.key} style={styles.pageColumn}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`第 ${i + 1} 頁：${label}${checked ? "" : "（不存）"}`}
                  accessibilityState={{ selected }}
                  onPress={() => setCurrent(i)}
                  style={[
                    styles.thumb,
                    {
                      width: Math.round(SHARE_CARD_WIDTH * scale),
                      height: Math.round(size.height * scale),
                      boxShadow: selected
                        ? `0px 0px 0px 2.5px ${theme.primary}, 0px 6px 16px rgba(58,51,45,0.2)`
                        : "0px 0px 0px 1px rgba(58,51,45,0.18), 0px 4px 12px rgba(58,51,45,0.14)",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.thumbScale,
                      { height: size.height, transform: [{ scale }] },
                    ]}
                  >
                    <ShareCard
                      ref={(view) => {
                        if (view) cards.current.set(page.key, view);
                        else cards.current.delete(page.key);
                      }}
                      detail={detail}
                      page={page}
                      onPhotoReady={(index) => {
                        const key = `${page.key}:${index}`;
                        setLoaded((done) =>
                          done.has(key) ? done : new Set(done).add(key),
                        );
                      }}
                    />
                  </View>
                  {post && !checked && (
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFill,
                        styles.dim,
                        { backgroundColor: theme.background },
                      ]}
                    />
                  )}
                </Pressable>
                {post && (
                  <CheckChip
                    label={label}
                    checked={checked}
                    onPress={() =>
                      setOff((current) => {
                        const next = new Set(current);
                        if (checked) next.add(page.key);
                        else next.delete(page.key);
                        return next;
                      })
                    }
                  />
                )}
              </View>
            );
          })}
        </ScrollView>

        <Text style={[styles.hint, { color: theme.textMuted }]}>
          {post
            ? `勾選的頁面會依序存進相簿裡的「${SHARE_ALBUM}」。到 IG 新增貼文時一次選取這幾張，就是一則輪播貼文。`
            : "按「分享到限動」打開分享選單，點 Instagram 後選「限時動態」。"}
        </Text>

        {post && (
          <View style={[styles.captionBox, { backgroundColor: theme.surface }]}>
            <View style={styles.captionHead}>
              <Text
                accessibilityRole="header"
                style={[styles.captionTitle, { color: theme.text }]}
              >
                貼文文字
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="複製貼文文字"
                onPress={copyCaption}
                style={({ pressed }) => [
                  styles.copy,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <CopyIcon color={theme.text} />
                <Text style={[styles.copyText, { color: theme.text }]}>
                  複製
                </Text>
              </Pressable>
            </View>
            <Text selectable style={[styles.caption, { color: theme.text }]}>
              {caption}
            </Text>
            <Text style={[styles.captionNote, { color: theme.textMuted }]}>
              IG 不會帶入分享時的文字，複製後在 IG 的說明欄貼上。
            </Text>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.surface,
            paddingBottom: insets.bottom + BAR_PADDING,
          },
        ]}
      >
        <ErrorText message={failure} />
        {post ? (
          <>
            <Button
              title={
                allReady ? `存到相簿（${chosen.length} 張）` : "照片載入中…"
              }
              disabled={busy || chosen.length === 0 || !allReady}
              onPress={save}
            />
            <Button
              title={`分享「${sharePageLabel(currentPage)}」這一張`}
              variant="secondary"
              disabled={busy || !isReady(currentPage)}
              onPress={shareCurrent}
            />
          </>
        ) : (
          <>
            <Button
              title={allReady ? "分享到限動" : "照片載入中…"}
              disabled={busy || !allReady}
              onPress={shareCurrent}
            />
            <Button
              title="存到相簿"
              variant="secondary"
              disabled={busy || !allReady}
              onPress={save}
            />
          </>
        )}
      </View>
    </View>
  );
}

/** 卡片下面的勾選鈕：沒勾的頁面不存 */
function CheckChip({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`存${label}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: checked ? theme.surface : "transparent",
          boxShadow: `0px 0px 0px 1.2px ${checked ? "rgba(58,51,45,0.5)" : "rgba(58,51,45,0.28)"}`,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.box,
          {
            backgroundColor: checked ? theme.primary : "#FFFDF8",
            boxShadow: `0px 0px 0px 1.3px ${checked ? theme.primary : "rgba(58,51,45,0.5)"}`,
          },
        ]}
      >
        {checked && (
          <Svg width={13} height={13} viewBox="0 0 16 16" fill="none">
            <Path
              d="M3 8.6l3.2 3.1 6.8-7.4"
              stroke={theme.onPrimary}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}
      </View>
      <Text style={[styles.chipText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function CopyIcon({ color }: { color: string }) {
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9 8.5h9.5c.8 0 1.5.7 1.5 1.5v9c0 .8-.7 1.5-1.5 1.5H9c-.8 0-1.5-.7-1.5-1.5v-9c0-.8.7-1.5 1.5-1.5zM16.5 8.5V5c0-.8-.7-1.5-1.5-1.5H5.5C4.7 3.5 4 4.2 4 5v9c0 .8.7 1.5 1.5 1.5h2" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  scroll: {
    gap: 14,
    paddingTop: 16,
    paddingBottom: 20,
  },
  pages: {
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 6,
  },
  pageColumn: {
    alignItems: "center",
    gap: 10,
  },
  formats: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 19,
    borderBottomRightRadius: 21,
    borderBottomLeftRadius: 20,
  },
  format: {
    minWidth: 128,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 17,
    borderBottomLeftRadius: 15,
  },
  formatOn: {
    backgroundColor: "#FFFDF8",
    boxShadow:
      "0px 0px 0px 1.2px rgba(58,51,45,0.45), 1px 2px 0px rgba(58,51,45,0.1)",
  },
  formatText: {
    fontSize: 14.5,
  },
  thumb: {
    borderRadius: 3,
    overflow: "hidden",
  },
  thumbScale: {
    width: SHARE_CARD_WIDTH,
    transformOrigin: "top left",
  },
  dim: {
    opacity: 0.62,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingLeft: 8,
    paddingRight: 12,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 17,
    borderBottomLeftRadius: 16,
  },
  box: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 5,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 7,
  },
  chipText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  hint: {
    marginHorizontal: 24,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 21,
  },
  captionBox: {
    marginHorizontal: 20,
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 11,
    borderBottomLeftRadius: 15,
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.3)",
  },
  captionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  captionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
  },
  copy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 36,
    paddingLeft: 9,
    paddingRight: 12,
    backgroundColor: "#FFFDF8",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 15,
    borderBottomRightRadius: 17,
    borderBottomLeftRadius: 16,
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.5)",
  },
  copyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 23,
  },
  captionNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
  },
  bar: {
    gap: BAR_GAP,
    paddingTop: BAR_PADDING,
    paddingHorizontal: 20,
    boxShadow: "0px -1px 0px rgba(58,51,45,0.14)",
  },
});
