import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  FloatingAddButton,
  Screen,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { RuledPaper, SketchFrame } from "../../../shared/ui/handDrawn";
import { PageHeader, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { useIllustrationLibrary } from "../hooks/useJournalQueries";
import type { IllustrationOverview } from "../services/illustrationCommands";
import { IllustrationArt } from "./IllustrationArt";
import { PencilIcon } from "./PencilIcon";

const SIDE = 16;
const GAP = 12;
const COLUMNS = 3;

/** 「我的插圖」：自己畫的插圖三張一排，點一張改畫，右下角畫新的 */
export function IllustrationLibraryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, error } = useIllustrationLibrary();
  const card = Math.floor((width - SIDE * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  if (error) {
    return <PageMessage onBack={router.back} text="讀取插圖失敗" />;
  }
  const header = (
    <PageHeader onBack={router.back} kicker="My Doodles" title="我的插圖" />
  );
  const draw = () => router.push("/illustrations/draw");

  return (
    <View style={styles.fill}>
      <Screen
        header={header}
        contentStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
      >
        {data && data.length === 0 && (
          <RuledPaper style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.text }]}>
              畫一隻鹿、一碗拉麵、一張車票……畫好的插圖會收在這裡，之後可以貼在任何一篇日記上。
            </Text>
            <Button title="畫第一張插圖" onPress={draw} />
          </RuledPaper>
        )}
        {data && data.length > 0 && (
          <>
            <Text style={[styles.summary, { color: theme.textMuted }]}>
              {data.length} 張插圖 · 點一張可以改畫或刪除
            </Text>
            <View style={styles.grid}>
              {data.map((overview, index) => (
                <Doodle
                  key={overview.illustration.id}
                  overview={overview}
                  size={card}
                  index={index}
                />
              ))}
            </View>
          </>
        )}
      </Screen>
      {data && data.length > 0 && (
        <FloatingAddButton
          title="畫插圖"
          bottom={insets.bottom + 18}
          icon={
            <PencilIcon color={theme.onPrimary} size={18} strokeWidth={2} />
          }
          onPress={draw}
        />
      )}
    </View>
  );
}

/** 一張插圖貼在紙卡上，微微歪一點 */
function Doodle({
  overview,
  size,
  index,
}: {
  overview: IllustrationOverview;
  size: number;
  index: number;
}) {
  const theme = useTheme();
  const { illustration, useCount } = overview;
  const used = useCount > 0 ? `貼在 ${useCount} 篇日記` : "還沒貼";
  const tilt = TILTS[index % TILTS.length];
  const art = size - 20;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`插圖，${used}`}
      accessibilityHint="改畫或刪除這張插圖"
      onPress={() =>
        router.push({
          pathname: "/illustrations/draw",
          params: { id: illustration.id },
        })
      }
      style={({ pressed }) => [
        styles.doodle,
        { width: size, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            width: size,
            height: size,
            transform: [{ rotate: `${tilt}deg` }],
          },
        ]}
      >
        <IllustrationArt
          strokes={illustration.strokes}
          width={art}
          height={art}
        />
        <SketchFrame radius={6} strokeWidth={1} />
      </View>
      <Text style={[styles.used, { color: theme.textMuted }]}>{used}</Text>
    </Pressable>
  );
}

const TILTS = [-1.6, 1.2, -0.6, 1.8, -1.1, 0.7] as const;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SIDE,
  },
  summary: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: GAP,
    rowGap: 18,
    paddingTop: 6,
  },
  doodle: {
    gap: 6,
    alignItems: "center",
  },
  card: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFDF8",
    borderRadius: 6,
    boxShadow: "0px 1px 3px rgba(58,51,45,0.12)",
  },
  used: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  empty: {
    gap: 16,
    padding: 20,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 26,
  },
});
