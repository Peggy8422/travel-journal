import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { formatMinorAmount } from "../../../domain/ledger";
import { TextButton } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import {
  DashedLine,
  SketchFrame,
  WashiTape,
} from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import {
  countLabel,
  type GlobeSheetContent,
  type MapEntry,
} from "../services/globeView";
import {
  mapLedgerName,
  type MapExpense,
  type MapItem,
  type MapLedger,
} from "../services/mapData";
import { ledgerColors } from "./GlobeIndex";
import {
  LedgerSectionHeader,
  MapEntryRow,
  MapExpenseRow,
} from "./MapExpenseRow";

/** 地圖上的金額一律換算成新台幣（帳本的基準幣） */
const BASE = "TWD";

/**
 * 地球下方的消費卡片：標題列可以展開／收合，清單依帳本分段，有地點的日記和消費依日期排在一起。
 * 點一筆消費（一篇日記），地球轉到那裡並標出名稱，同時打開消費明細（日記頁）；
 * 在地球上點標記時，清單只列那個地方的消費與日記。
 */
export function GlobeSheet({
  picked,
  content,
  height,
  open,
  onToggle,
  placeIds,
  onClearPlace,
  focusId,
  onOpen,
  onOpenEntry,
  onOpenDetail,
}: {
  picked: readonly MapLedger[];
  content: GlobeSheetContent;
  height: number;
  open: boolean;
  onToggle: () => void;
  placeIds: readonly string[] | null;
  onClearPlace: () => void;
  focusId: string | null;
  onOpen: (expense: MapExpense) => void;
  onOpenEntry: (entry: MapEntry) => void;
  onOpenDetail: () => void;
}) {
  const theme = useTheme();
  const multi = picked.length > 1;
  const money = (minor: number) => `${BASE} ${formatMinorAmount(minor, BASE)}`;
  const title =
    picked.length === 1 ? mapLedgerName(picked[0]) : `${picked.length} 本帳本`;
  const count = content.expenses.length;
  const hasItems = count > 0 || content.entryCount > 0;
  // What the list shows when narrowed to a place on the globe
  const shown: MapItem[] = content.sections.flatMap((s) =>
    s.rows.flatMap<MapItem>((row) =>
      row.kind === "expense"
        ? [row.expense]
        : row.entry.pins.filter((p) => placeIds?.includes(p.id) ?? true),
    ),
  );
  const placeNames = [
    ...new Set(shown.map((e) => e.placeName ?? e.title)),
  ].join("、");
  const summary = [
    content.entryCount > 0 ? `${content.entryCount} 篇日記` : null,
    count > 0 ? `${count} 筆消費` : null,
    `${content.placeCount} 個地點`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
  const onlyJournals = picked.every((l) => l.kind === "journals");

  return (
    <View style={[styles.sheet, { height, backgroundColor: theme.surface }]}>
      <SketchFrame radius={16} strokeWidth={1.3} />
      <View style={styles.tape}>
        <WashiTape color="#9DB07A" tilt={-3} opacity={0.85} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? "收合消費明細" : "展開消費明細"}
        onPress={onToggle}
        style={styles.head}
      >
        <View style={styles.headMain}>
          <View style={styles.titleRow}>
            {picked.map((l) => (
              <View
                key={l.id}
                style={[styles.dot, { backgroundColor: ledgerColors(l).deep }]}
              />
            ))}
            <Text
              numberOfLines={1}
              style={[styles.title, { color: theme.text }]}
            >
              {title}
            </Text>
          </View>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {hasItems
              ? summary
              : onlyJournals
                ? "日記還沒有記地點"
                : "還沒有標記地點的消費"}
          </Text>
        </View>
        {!onlyJournals && (
          <View style={styles.headTotal}>
            <Text style={[styles.total, { color: theme.text }]}>
              {money(content.totalBaseMinor)}
            </Text>
            <Text style={[styles.totalLabel, { color: theme.textMuted }]}>
              合計
            </Text>
          </View>
        )}
        <Svg
          width={18}
          height={18}
          viewBox="0 0 18 18"
          fill="none"
          stroke={theme.text}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        >
          <Path d="M4.8 11.2l4.3-4.1 4.2 4.2" />
        </Svg>
      </Pressable>

      {hasItems && (
        <View style={styles.tools}>
          {placeIds ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`取消只看${placeNames}，顯示全部`}
              onPress={onClearPlace}
              style={({ pressed }) => [
                styles.placeChip,
                { backgroundColor: theme.chip, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.placeText, { color: theme.text }]}
              >
                只看 {placeNames} · {countLabel(shown)}
              </Text>
              <Svg
                width={14}
                height={14}
                viewBox="0 0 16 16"
                fill="none"
                stroke={theme.text}
                strokeWidth={1.6}
                strokeLinecap="round"
              >
                <Path d="M4.5 4.6l7 6.9M11.4 4.5l-6.8 7" />
              </Svg>
            </Pressable>
          ) : (
            <View style={styles.flex} />
          )}
          <TextButton title="詳細地圖" onPress={onOpenDetail} />
        </View>
      )}

      <View style={styles.rule}>
        <DashedLine opacity={0.25} />
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {!hasItems && (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            {onlyJournals
              ? "這些手帳的日記還沒有記地點。寫日記時按「目前位置」或「在地圖上選」，地點就會出現在地球上。"
              : `${
                  picked.length === 1 && picked[0].kind === "personal"
                    ? "個人記帳"
                    : multi
                      ? "選的帳本"
                      : "這本帳本"
                }還沒有標記地點的消費。新增消費時按「使用目前位置」，足跡就會出現在地球上。`}
          </Text>
        )}
        {content.sections.map(({ ledger, rows }) => (
          <View key={ledger.id}>
            {multi && <LedgerSectionHeader ledger={ledger} />}
            {rows.map((row) =>
              row.kind === "expense" ? (
                <MapExpenseRow
                  key={row.expense.id}
                  expense={row.expense}
                  ledger={ledger}
                  selected={row.expense.id === focusId}
                  accessibilityHint="在地球上標出這筆消費並打開明細"
                  onPress={() => onOpen(row.expense)}
                />
              ) : (
                <MapEntryRow
                  key={row.entry.entryId}
                  entry={row.entry}
                  selected={row.entry.pins.some((p) => p.id === focusId)}
                  accessibilityHint="在地球上標出這篇日記的地點並打開日記"
                  onPress={() => onOpenEntry(row.entry)}
                />
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 10,
    right: 84,
    bottom: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 18,
    boxShadow:
      "0px 3px 0px rgba(58,51,45,0.07), 0px 12px 26px rgba(58,51,45,0.14)",
  },
  tape: {
    position: "absolute",
    left: "50%",
    top: -9,
    width: 74,
    height: 18,
    marginLeft: -37,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 58,
    paddingTop: 16,
    paddingRight: 12,
    paddingBottom: 8,
    paddingLeft: 16,
  },
  headMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 4.5,
    borderBottomRightRadius: 5.2,
    borderBottomLeftRadius: 4.8,
  },
  title: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  headTotal: {
    alignItems: "flex-end",
  },
  total: {
    fontFamily: fonts.bold,
    fontSize: 15.5,
  },
  totalLabel: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  flex: {
    flex: 1,
  },
  placeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 17,
  },
  placeText: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  rule: {
    marginHorizontal: 8,
  },
  list: {
    flex: 1,
    marginHorizontal: 8,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  empty: {
    marginVertical: 16,
    marginHorizontal: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 23,
  },
});
