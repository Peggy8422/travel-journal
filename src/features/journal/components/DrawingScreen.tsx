import { router, Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import {
  hasInk,
  ILLUSTRATION_INKS,
  ILLUSTRATION_STROKE_LIMIT,
  type IllustrationInk,
  type IllustrationStroke,
  type IllustrationTool,
} from "../../../domain/journal";
import {
  HeaderAction,
  MessageScreen,
  TextButton,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { PaperBackground, SketchFrame } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { describeError } from "../../ledger/components/messages";
import { useDrawingPad, type PadBrush } from "../hooks/useDrawingPad";
import { useIllustration } from "../hooks/useJournalQueries";
import {
  deleteIllustration,
  saveIllustration,
  type IllustrationOverview,
} from "../services/illustrationCommands";
import { IllustrationArt } from "./IllustrationArt";
import {
  BRUSH_SIZES,
  INK_COLORS,
  PAD_PAPER,
  PENCIL_OPACITY,
  WASH_OPACITY,
} from "./inks";

type DrawTool = Exclude<IllustrationTool, "eraser">;

const NO_STROKES: readonly IllustrationStroke[] = [];

const SIDE = 16;

/**
 * 畫插圖（illustrationId 為 null）與改畫共用的全螢幕 modal。
 * 不能往下滑關掉，免得往下畫線時把畫板關了；導覽列左右是取消、儲存。
 */
export function DrawingScreen({
  illustrationId,
}: {
  illustrationId: string | null;
}) {
  if (illustrationId === null) return <DrawingPad existing={null} />;
  return <EditDrawing illustrationId={illustrationId} />;
}

function EditDrawing({ illustrationId }: { illustrationId: string }) {
  const { data, error } = useIllustration(illustrationId);
  if (error) return <MessageScreen text="讀取插圖失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;
  // Mounted once the strokes are in, so the pad starts from them
  return <DrawingPad existing={data.value} />;
}

function DrawingPad({ existing }: { existing: IllustrationOverview | null }) {
  const theme = useTheme();
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tool, setTool] = useState<IllustrationTool>("pen");
  /** 最後用的畫筆，橡皮擦時點顏色會切回它 */
  const [drawTool, setDrawTool] = useState<DrawTool>("pen");
  const [ink, setInk] = useState<IllustrationInk>("sumi");
  const [size, setSize] = useState(1);
  const brush: PadBrush = {
    tool,
    ink: tool === "eraser" ? "sumi" : ink,
    width: BRUSH_SIZES[size]!.width[tool],
  };
  const pad = useDrawingPad(existing?.illustration.strokes ?? [], brush);
  const { strokes, live, canUndo, dirty, full } = pad.snapshot;
  const [saving, setSaving] = useState(false);
  const canvas = width - SIDE * 2;
  const drawn = hasInk(strokes);

  function pickTool(next: IllustrationTool) {
    setTool(next);
    if (next !== "eraser") setDrawTool(next);
  }

  function pickInk(next: IllustrationInk) {
    setInk(next);
    // Picking a colour while erasing goes back to the last brush
    if (tool === "eraser") setTool(drawTool);
  }

  function cancel() {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert("還沒儲存", "要放棄這次畫的嗎？", [
      { text: "繼續畫", style: "cancel" },
      { text: "放棄", style: "destructive", onPress: () => router.back() },
    ]);
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveIllustration(
        deps,
        existing?.illustration.id ?? null,
        strokes,
      );
      if (!result.ok) {
        // 儲存在頁首，錯誤不屬於任何欄位
        Alert.alert("無法儲存", describeError(result.error));
        return;
      }
      router.back();
      toast(existing ? "插圖改好了" : "存進我的插圖了");
    } catch {
      Alert.alert("無法儲存", "儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!existing) return;
    const count = existing.useCount;
    Alert.alert(
      "刪除插圖",
      count > 0
        ? `這張插圖貼在 ${count} 篇日記上，刪掉後也會從那些日記上拿掉，而且沒辦法復原。`
        : "刪掉後沒辦法復原。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => remove(existing.illustration.id),
        },
      ],
    );
  }

  async function remove(id: string) {
    try {
      const result = await deleteIllustration(deps, id);
      if (!result.ok) {
        Alert.alert("無法刪除", describeError(result.error));
        return;
      }
      router.back();
      toast("刪掉插圖了");
    } catch {
      Alert.alert("無法刪除", "刪除失敗，請再試一次");
    }
  }

  const hint = full
    ? `一張插圖最多 ${ILLUSTRATION_STROKE_LIMIT} 筆，先存起來，剩下的畫在另一張吧`
    : tool === "eraser"
      ? "手指劃過的地方會擦掉，粗細可以調整橡皮擦大小"
      : !drawn && !live
        ? "用手指在紙上畫，存起來之後可以貼在日記上"
        : null;

  return (
    <View
      style={[
        styles.fill,
        { backgroundColor: theme.background, paddingBottom: insets.bottom },
      ]}
    >
      <PaperBackground />
      <Stack.Screen
        options={{
          title: existing ? "改插圖" : "畫插圖",
          headerLeft: () => <HeaderAction title="取消" onPress={cancel} />,
          headerRight: () => (
            <HeaderAction
              title="儲存"
              strong
              disabled={saving || !drawn || (!!existing && !dirty)}
              onPress={save}
            />
          ),
        }}
      />

      <View
        accessibilityLabel="畫板"
        style={[styles.canvas, { width: canvas, height: canvas }]}
        onLayout={(e) => pad.setCanvasWidth(e.nativeEvent.layout.width)}
        {...pad.panHandlers}
      >
        {/* The finished strokes and the stroke in progress are separate layers,
            so a moving finger only redraws its own stroke */}
        <IllustrationArt
          strokes={strokes}
          width={canvas}
          height={canvas}
          crop={false}
          paper={PAD_PAPER}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <IllustrationArt
            strokes={live ? [live] : NO_STROKES}
            width={canvas}
            height={canvas}
            crop={false}
            paper={PAD_PAPER}
          />
        </View>
        <SketchFrame radius={6} strokeWidth={1.2} />
      </View>
      <Text style={[styles.hint, { color: theme.textMuted }]}>
        {hint ?? " "}
      </Text>

      <View style={styles.tools}>
        <View style={styles.toolRow}>
          <ToolButton
            label="筆"
            selected={tool === "pen"}
            onPress={() => pickTool("pen")}
          >
            <Path d="M12 3l5 7.5L12 21l-5-10.5zM12 11.5v4.5M12 9.2v.1" />
          </ToolButton>
          <ToolButton
            label="鉛筆"
            selected={tool === "pencil"}
            onPress={() => pickTool("pencil")}
          >
            <Path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8zM14 6.6l3.4 3.4M5.2 15.4l3.4 3.4" />
          </ToolButton>
          <ToolButton
            label="水彩"
            selected={tool === "wash"}
            onPress={() => pickTool("wash")}
          >
            <Path d="M14.5 3.5l6 6-7.2 7.3-6-6zM7.2 10.9c-2.4.6-3.8 2.4-3.6 5.1.1 1.7-.5 3.1-1.6 4.4 3.4.4 6.6-.3 8.2-2.4 1.1-1.4 1-3 .6-4.5" />
          </ToolButton>
          <ToolButton
            label="橡皮擦"
            selected={tool === "eraser"}
            onPress={() => pickTool("eraser")}
          >
            <Path d="M9.5 19.5h10M4.6 14.8l8.7-9.3a1.8 1.8 0 0 1 2.6 0l3.6 3.7a1.8 1.8 0 0 1 0 2.5l-7.8 8H9.3l-4.6-4.4a.4.4 0 0 1-.1-.5zM9.6 9.7l6 6" />
          </ToolButton>
          <ToolButton
            label="復原"
            selected={false}
            disabled={!canUndo}
            onPress={pad.undo}
          >
            <Path d="M8.5 6.5L4.5 10.5l4 4M4.8 10.5h9.4c3 0 5.3 2.3 5.3 5s-2.3 4.8-5.3 4.8H10" />
          </ToolButton>
        </View>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="墨水色"
          style={styles.inkRow}
        >
          {ILLUSTRATION_INKS.map((code) => {
            const on = ink === code && tool !== "eraser";
            return (
              <Pressable
                key={code}
                accessibilityRole="radio"
                accessibilityLabel={INK_COLORS[code].name}
                accessibilityState={{ checked: on }}
                onPress={() => pickInk(code)}
                style={styles.inkButton}
              >
                <View
                  style={[
                    styles.inkDot,
                    { backgroundColor: INK_COLORS[code].color },
                    on ? styles.inkSelected : styles.inkIdle,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="粗細"
          style={styles.sizeRow}
        >
          {BRUSH_SIZES.map((option, index) => {
            const on = size === index;
            const dot = 6 + index * 6;
            const color = INK_COLORS[ink].color;
            const erasing = tool === "eraser";
            return (
              <Pressable
                key={option.name}
                accessibilityRole="radio"
                accessibilityLabel={option.name}
                accessibilityState={{ checked: on }}
                onPress={() => setSize(index)}
                style={({ pressed }) => [
                  styles.sizeButton,
                  {
                    backgroundColor: on ? theme.chip : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Svg width={26} height={26}>
                  <Circle
                    cx={13}
                    cy={13}
                    r={dot / 2}
                    fill={erasing ? PAD_PAPER : color}
                    fillOpacity={
                      tool === "wash"
                        ? WASH_OPACITY + 0.2
                        : tool === "pencil"
                          ? PENCIL_OPACITY
                          : 1
                    }
                    stroke={erasing ? theme.textMuted : undefined}
                    strokeWidth={erasing ? 1.2 : 0}
                  />
                </Svg>
                <Text style={[styles.sizeName, { color: theme.text }]}>
                  {option.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {existing && (
        <TextButton
          title="刪除這張插圖"
          color={theme.negative}
          align="center"
          onPress={confirmDelete}
        />
      )}
    </View>
  );
}

function ToolButton({
  label,
  selected,
  disabled = false,
  onPress,
  children,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const color = selected ? theme.surface : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolButton,
        selected
          ? { backgroundColor: theme.text, borderColor: theme.text }
          : { borderColor: theme.pencil },
        { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <Svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </Svg>
      <Text style={[styles.toolText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  canvas: {
    alignSelf: "center",
    marginTop: 12,
    backgroundColor: PAD_PAPER,
    borderRadius: 6,
    overflow: "hidden",
  },
  hint: {
    marginTop: 8,
    paddingHorizontal: SIDE,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    textAlign: "center",
  },
  tools: {
    gap: 14,
    marginTop: 10,
    paddingHorizontal: SIDE,
  },
  toolRow: {
    flexDirection: "row",
    gap: 6,
  },
  toolButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 54,
    paddingHorizontal: 2,
    borderWidth: 1.2,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 17,
  },
  toolText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  inkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inkButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  inkDot: {
    width: 28,
    height: 28,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 13,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 12.5,
  },
  inkIdle: {
    boxShadow: "0px 0px 0px 1px rgba(58,51,45,0.2)",
  },
  inkSelected: {
    boxShadow: "0px 0px 0px 2.5px #F3EDE1, 0px 0px 0px 4.2px #3A332D",
  },
  sizeRow: {
    flexDirection: "row",
    gap: 8,
  },
  sizeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 44,
    borderRadius: 12,
  },
  sizeName: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
});
