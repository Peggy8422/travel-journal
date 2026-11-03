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
import { RuledPaper } from "../../../shared/ui/handDrawn";
import { PageHeader, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { coverTilt } from "../../ledger/components/coverStyles";
import { useJournalShelf } from "../hooks/useJournalQueries";
import type { JournalOverview } from "../services/journalCommands";
import { journalCaption } from "../services/journalDates";
import { JournalCover } from "./JournalCover";
import { ledgerDotColor } from "./tapes";

const SIDE = 16;
const GAP = 18;

/** 「旅遊手帳」書架：所有手帳的牛皮紙封面兩本一排，右下角建立新手帳 */
export function JournalShelfScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, error } = useJournalShelf();
  const bookWidth = Math.floor((width - SIDE * 2 - GAP) / 2);

  if (error) {
    return (
      <PageMessage backLabel="個人" onBack={router.back} text="讀取手帳失敗" />
    );
  }

  const header = (
    <PageHeader
      backLabel="個人"
      onBack={router.back}
      kicker="Travel Journal"
      title="旅遊手帳"
    />
  );
  const entryTotal = data?.reduce((sum, o) => sum + o.entryCount, 0) ?? 0;

  return (
    <View style={styles.fill}>
      <Screen
        header={header}
        contentStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
      >
        {data && data.length === 0 && (
          <RuledPaper style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.text }]}>
              每趟旅行一本手帳，按日期寫下去了哪裡、吃了什麼。綁定帳本的話，日記頁還會列出那天的消費。
            </Text>
            <Button
              title="建立第一本手帳"
              onPress={() => router.push("/journal/new")}
            />
          </RuledPaper>
        )}
        {data && data.length > 0 && (
          <>
            <Text style={[styles.summary, { color: theme.textMuted }]}>
              {data.length} 本手帳 · {entryTotal} 篇日記
            </Text>
            <View style={styles.grid}>
              {data.map((overview) => (
                <ShelfBook
                  key={overview.journal.id}
                  overview={overview}
                  width={bookWidth}
                />
              ))}
            </View>
          </>
        )}
      </Screen>
      {data && data.length > 0 && (
        <FloatingAddButton
          title="新手帳"
          bottom={insets.bottom + 18}
          onPress={() => router.push("/journal/new")}
        />
      )}
    </View>
  );
}

function ShelfBook({
  overview,
  width,
}: {
  overview: JournalOverview;
  width: number;
}) {
  const theme = useTheme();
  const { journal, ledger, entryCount } = overview;
  const count = entryCount > 0 ? `${entryCount} 篇日記` : "還沒有日記";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${journal.name}，${count}`}
      onPress={() =>
        router.push({ pathname: "/journal/[id]", params: { id: journal.id } })
      }
      style={({ pressed }) => [
        styles.book,
        { width, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <JournalCover
        cover={journal.cover}
        title={journal.name}
        caption={journalCaption(
          journal.createdAt,
          overview.firstDate,
          overview.lastDate,
        )}
        width={width}
        tilt={coverTilt(journal.id)}
      />
      <View style={styles.meta}>
        <Text style={[styles.metaText, { color: theme.textMuted }]}>
          {count}
        </Text>
        {ledger && (
          <View style={styles.ledger}>
            <View
              style={[styles.dot, { backgroundColor: ledgerDotColor(ledger) }]}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.metaText,
                styles.ledgerName,
                { color: theme.textMuted },
              ]}
            >
              {ledger.name}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

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
    rowGap: 26,
    paddingTop: 6,
  },
  book: {
    gap: 10,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 8,
    paddingHorizontal: 2,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  ledger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  ledgerName: {
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
