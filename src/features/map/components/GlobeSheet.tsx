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
import type { GlobeSheetContent } from "../services/globeView";
import type { MapExpense, MapLedger } from "../services/mapData";
import { ledgerColors } from "./GlobeIndex";
import { LedgerSectionHeader, MapExpenseRow } from "./MapExpenseRow";

/** 地圖上的金額一律換算成新台幣（帳本的基準幣） */
const BASE = "TWD";

/**
 * 地球下方的消費卡片：標題列可以展開／收合，清單依帳本分段。
 * 點一筆消費，地球會轉到那裡並標出名稱；在地球上點標記時，清單只列那個地方的消費。
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
  onFocus,
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
  onFocus: (expense: MapExpense) => void;
  onOpenDetail: () => void;
}) {
  const theme = useTheme();
  const multi = picked.length > 1;
  const money = (minor: number) => `${BASE} ${formatMinorAmount(minor, BASE)}`;
  const title =
    picked.length === 1
      ? picked[0].kind === "personal"
        ? "個人記帳"
        : picked[0].name
      : `${picked.length} 本帳本`;
  const count = content.expenses.length;
  const shown = content.sections.flatMap((s) => s.expenses);
  const placeNames = [
    ...new Set(shown.map((e) => e.placeName ?? e.title)),
  ].join("、");

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
            {count > 0
              ? `${count} 筆消費 · ${content.placeCount} 個地點`
              : "還沒有標記地點的消費"}
          </Text>
        </View>
        <View style={styles.headTotal}>
          <Text style={[styles.total, { color: theme.text }]}>
            {money(content.totalBaseMinor)}
          </Text>
          <Text style={[styles.totalLabel, { color: theme.textMuted }]}>
            合計
          </Text>
        </View>
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

      {count > 0 && (
        <View style={styles.tools}>
          {placeIds ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`取消只看${placeNames}，顯示全部消費`}
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
                只看 {placeNames} · {shown.length} 筆
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
        {count === 0 && (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            {picked.length === 1 && picked[0].kind === "personal"
              ? "個人記帳"
              : multi
                ? "選的帳本"
                : "這本帳本"}
            還沒有標記地點的消費。新增消費時按「使用目前位置」，足跡就會出現在地球上。
          </Text>
        )}
        {content.sections.map(({ ledger, expenses }) => (
          <View key={ledger.id}>
            {multi && <LedgerSectionHeader ledger={ledger} />}
            {expenses.map((expense) => (
              <MapExpenseRow
                key={expense.id}
                expense={expense}
                ledger={ledger}
                selected={expense.id === focusId}
                accessibilityHint="在地球上標出這筆消費"
                onPress={() => onFocus(expense)}
              />
            ))}
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
