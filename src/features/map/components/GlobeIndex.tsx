import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";
import { COVER_COLORS } from "../../ledger/components/coverStyles";
import type { MapLedger } from "../services/mapData";
import { groupLedgersByYear } from "../services/globeView";

/** 個人記帳固定用藍色，和個人分頁的長條一致 */
const PERSONAL_COLORS = COVER_COLORS.ai;

/** 帳本在地球上的顏色：索引籤底色（tint）與標記、選取條（deep） */
export function ledgerColors(ledger: MapLedger): {
  deep: string;
  tint: string;
} {
  return ledger.kind === "personal"
    ? PERSONAL_COLORS
    : COVER_COLORS[ledger.cover.palette];
}

/**
 * 地球右側的直書索引籤：最上面是個人記帳，下面依年份收合分帳帳本。
 * 帳本可以複選，選中的籤會往左凸出、左緣加一條帳本色。
 */
export function GlobeIndex({
  top,
  ledgers,
  picked,
  openYear,
  onToggleYear,
  onToggleLedger,
  onClear,
}: {
  /** 欄位頂端（含安全區域） */
  top: number;
  ledgers: readonly MapLedger[];
  picked: readonly string[];
  /** 展開的年份；null 代表全部收合 */
  openYear: string | null;
  onToggleYear: (year: string) => void;
  onToggleLedger: (id: string) => void;
  onClear: () => void;
}) {
  const theme = useTheme();
  const personal = ledgers.find((l) => l.kind === "personal");
  const years = groupLedgersByYear(ledgers);

  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="選擇要顯示在地圖上的帳本"
      style={[styles.column, { top }]}
    >
      <Text style={[styles.heading, { color: theme.textMuted }]}>帳本</Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      >
        {personal && (
          <LedgerTab
            ledger={personal}
            label="個人"
            sub="記帳"
            selected={picked.includes(personal.id)}
            onPress={() => onToggleLedger(personal.id)}
          />
        )}
        {years.map(({ year, ledgers: inYear }) => {
          const open = year === openYear;
          const pickedCount = inYear.filter((l) =>
            picked.includes(l.id),
          ).length;
          return (
            <View key={year} style={styles.year}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${year} 年，${inYear.length} 本帳本${pickedCount ? `，已選 ${pickedCount} 本` : ""}`}
                onPress={() => onToggleYear(year)}
                style={[
                  styles.yearTab,
                  { backgroundColor: open ? theme.text : theme.surface },
                ]}
              >
                <Text
                  style={[
                    styles.yearText,
                    { color: open ? theme.surface : theme.text },
                  ]}
                >
                  {year}
                </Text>
                <Text
                  style={[
                    styles.yearCount,
                    { color: open ? theme.surface : theme.text },
                  ]}
                >
                  {inYear.length} 本
                </Text>
                {pickedCount > 0 && (
                  <Text
                    style={[
                      styles.pickedBadge,
                      { backgroundColor: theme.primary, color: theme.surface },
                    ]}
                  >
                    已選 {pickedCount}
                  </Text>
                )}
                <Svg
                  width={14}
                  height={14}
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke={open ? theme.surface : theme.text}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
                >
                  <Path d="M4.8 7l4.3 4.1 4.2-4.2" />
                </Svg>
              </Pressable>
              {open &&
                inYear.map((ledger) => (
                  <LedgerTab
                    key={ledger.id}
                    ledger={ledger}
                    label={ledger.name}
                    sub={`${Number(ledger.tripMonth.slice(5, 7))} 月`}
                    selected={picked.includes(ledger.id)}
                    onPress={() => onToggleLedger(ledger.id)}
                  />
                ))}
            </View>
          );
        })}
        {picked.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="清除選取的帳本"
            onPress={onClear}
            style={({ pressed }) => [
              styles.clear,
              { borderColor: theme.textMuted, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.clearText, { color: theme.text }]}>清除</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

/** 一張直書索引籤：名稱取前四個字直排（更長的接一個直的「⋮」），下面一行小字 */
function LedgerTab({
  ledger,
  label,
  sub,
  selected,
  onPress,
}: {
  ledger: MapLedger;
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colors = ledgerColors(ledger);
  // Array.from keeps characters outside the BMP in one piece
  const all = Array.from(label);
  const chars = all.slice(0, 4);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={
        ledger.kind === "personal"
          ? "個人記帳"
          : `${ledger.name}，${ledger.tripMonth.slice(0, 4)} 年 ${Number(ledger.tripMonth.slice(5, 7))} 月`
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        {
          backgroundColor: colors.tint,
          opacity: pressed ? 0.75 : 1,
          // Unselected tabs tuck back into the edge of the screen
          transform: [{ translateX: selected ? 0 : 12 }],
        },
      ]}
    >
      {selected && (
        <View style={[styles.strip, { backgroundColor: colors.deep }]} />
      )}
      <Text
        style={[
          styles.tabLabel,
          {
            color: theme.text,
            fontFamily: selected ? fonts.bold : fonts.regular,
          },
        ]}
      >
        {chars.join("\n")}
      </Text>
      {all.length > chars.length && (
        // Drawn as dots: the fonts have no vertical ellipsis glyph to rely on
        <View style={styles.more}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.moreDot, { backgroundColor: theme.text }]}
            />
          ))}
        </View>
      )}
      <Text style={[styles.tabSub, { color: theme.textMuted }]}>{sub}</Text>
      {selected && (
        <Svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          fill="none"
          stroke={theme.primary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M3 8.6l3.2 3.1 6.8-7.4" />
        </Svg>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: {
    position: "absolute",
    right: 0,
    bottom: 8,
    width: 76,
    alignItems: "flex-end",
    gap: 6,
  },
  heading: {
    paddingTop: 4,
    paddingRight: 14,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  list: {
    alignItems: "flex-end",
    gap: 6,
    paddingBottom: 8,
  },
  year: {
    alignItems: "flex-end",
    gap: 6,
  },
  yearTab: {
    width: 66,
    alignItems: "center",
    gap: 2,
    paddingTop: 8,
    paddingBottom: 7,
    paddingLeft: 2,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 12,
    boxShadow: "-2px 3px 0px rgba(58,51,45,0.14)",
  },
  yearText: {
    fontFamily: fonts.accent,
    fontSize: 21,
    lineHeight: 23,
    paddingRight: accentOverhang(21),
  },
  yearCount: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
  pickedBadge: {
    overflow: "hidden",
    paddingHorizontal: 6,
    borderRadius: 8,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  tab: {
    width: 62,
    alignItems: "center",
    gap: 5,
    paddingTop: 11,
    paddingBottom: 9,
    paddingLeft: 3,
    borderWidth: 1.3,
    borderRightWidth: 0,
    borderColor: "rgba(58,51,45,0.5)",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    boxShadow: "-2px 3px 0px rgba(58,51,45,0.12)",
  },
  strip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  more: {
    alignItems: "center",
    gap: 2.5,
    marginTop: -2,
  },
  moreDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
  },
  tabLabel: {
    fontSize: 14,
    lineHeight: 17,
    textAlign: "center",
  },
  tabSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  clear: {
    minWidth: 54,
    minHeight: 44,
    marginTop: 4,
    marginRight: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderRadius: 22,
  },
  clearText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
});
