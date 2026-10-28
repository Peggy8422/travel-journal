import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line, Path } from "react-native-svg";

import { coverFromId, formatMinorAmount } from "../../../domain/ledger";
import { ErrorText } from "../../../shared/ui/components";
import { FabMenu } from "../../../shared/ui/FabMenu";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import {
  HandCircle,
  PaperBackground,
  WashiTape,
  WavyLine,
} from "../../../shared/ui/handDrawn";
import { spacing, useTheme } from "../../../shared/ui/theme";
import { useLedgerList } from "../hooks/useLedgerQueries";
import type { LedgerOverview } from "../services/ledgerOverview";
import {
  applyShelfFilter,
  groupShelf,
  NO_SHELF_FILTER,
  shelfMonths,
  shelfYears,
  type ShelfFilter,
} from "../services/ledgerShelf";
import { coverTilt } from "./coverStyles";
import { NotebookCover } from "./NotebookCover";

const GUTTER = 22;
const COLUMN_GAP = 18;
const TAPE_COLORS = ["#E9C46A", "#9DB07A", "#E6B1AC", "#A596C5"];
const TAPE_TILTS = [-2, 1.5, -1, 2];

/**
 * 帳本書架：標題與年月篩選固定在上方，帳本依旅行月份分組排成兩欄的筆記本，
 * 「建立帳本」「備份與還原」收在右下角的選單裡。
 */
export function LedgerListScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data: overviews, error } = useLedgerList();
  const [filter, setFilter] = useState<ShelfFilter>(NO_SHELF_FILTER);

  const all = overviews ?? [];
  const years = shelfYears(all);
  // 選的年份或月份已經沒有帳本（例如帳本被刪掉）時，視為不篩選
  const year =
    filter.year !== null && years.includes(filter.year) ? filter.year : null;
  const months = shelfMonths(all, year);
  const month =
    filter.month !== null && months.includes(filter.month)
      ? filter.month
      : null;
  const shown = applyShelfFilter(all, { year, month });
  const bookWidth = Math.floor((width - GUTTER * 2 - COLUMN_GAP) / 2);

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.kicker, { color: theme.textMuted }]}>
              My Notebooks
            </Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: theme.text }]}
            >
              帳本
            </Text>
          </View>
          {all.length > 0 && (
            <Text style={[styles.count, { color: theme.textMuted }]}>
              {shown.length === all.length
                ? `共 ${all.length} 本`
                : `顯示 ${shown.length} / ${all.length} 本`}
            </Text>
          )}
        </View>
        {years.length > 0 && (
          <>
            <YearFilter
              years={years}
              selected={year}
              onSelect={(y) => setFilter({ year: y, month: null })}
            />
            <MonthFilter
              available={months}
              selected={month}
              onSelect={(m) => setFilter({ year, month: m })}
            />
          </>
        )}
        <Svg width="100%" height={2}>
          <Line
            x1={0}
            y1={1}
            x2="100%"
            y2={1}
            stroke={theme.text}
            strokeOpacity={0.22}
            strokeWidth={1.2}
            strokeDasharray="4 4"
          />
        </Svg>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ErrorText message={error ? "讀取帳本失敗" : null} />
        {overviews && all.length === 0 && (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            還沒有帳本，按右下角的按鈕建立一本開始記帳吧。
          </Text>
        )}
        {all.length > 0 && shown.length === 0 && (
          <Text style={[styles.empty, { color: theme.textMuted }]}>
            這個月份沒有帳本，換個月份看看。
          </Text>
        )}
        {groupShelf(shown).map((group) => (
          <View key={group.month} style={styles.group}>
            <View style={styles.groupHeading}>
              <Text
                accessibilityRole="header"
                style={[styles.groupTitle, { color: theme.text }]}
              >
                {`${group.month.slice(0, 4)} 年 ${Number(group.month.slice(5, 7))} 月`}
              </Text>
              <WavyLine />
            </View>
            <View style={styles.grid}>
              {group.overviews.map((overview) => (
                <Book
                  key={overview.ledger.id}
                  overview={overview}
                  width={bookWidth}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <FabMenu
        label="帳本選單"
        items={[
          {
            key: "backup",
            label: "備份與還原",
            icon: <BackupIcon />,
            onPress: () => router.push("/backup"),
          },
          {
            key: "new",
            label: "建立帳本",
            icon: <NewNotebookIcon />,
            tint: "#F3E0B4",
            onPress: () => router.push("/ledger/new"),
          },
        ]}
      />
    </View>
  );
}

function Book({
  overview,
  width,
}: {
  overview: LedgerOverview;
  width: number;
}) {
  const theme = useTheme();
  const { ledger } = overview;
  const { meta, status, pending } = describeBook(overview);
  const month = overview.tripMonth;
  // 依 id 給每本書固定的傾斜角度（約 ±1.6 度），書架看起來像手擺的
  const tilt = coverTilt(ledger.id);
  const settled =
    overview.kind === "ok" &&
    overview.expenseCount > 0 &&
    overview.pendingTransferCount === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${ledger.name}，${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月，${meta}，${status}`}
      onPress={() =>
        router.push({ pathname: "/ledger/[id]", params: { id: ledger.id } })
      }
      style={({ pressed }) => [
        styles.book,
        { width, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <NotebookCover
        cover={ledger.cover ?? coverFromId(ledger.id)}
        title={ledger.name}
        caption={month.replace("-", ".")}
        width={width}
        settled={settled}
        tilt={tilt}
      />
      <View style={styles.bookText}>
        <Text style={[styles.meta, { color: theme.text }]}>{meta}</Text>
        <Text
          style={[
            styles.status,
            { color: pending ? theme.negative : theme.textMuted },
          ]}
        >
          {status}
        </Text>
      </View>
    </Pressable>
  );
}

/** 例如 meta「3 人 · TWD 14,020」、status「還有 2 筆待還款」 */
function describeBook(overview: LedgerOverview): {
  meta: string;
  status: string;
  pending: boolean;
} {
  if (overview.kind === "invalid") {
    return { meta: "資料有誤", status: "請打開帳本查看", pending: true };
  }
  const base = overview.ledger.baseCurrency;
  const people = `${overview.activeMemberCount} 人`;
  if (overview.expenseCount === 0) {
    return { meta: people, status: "還沒有消費", pending: false };
  }
  return {
    meta: `${people} · ${base} ${formatMinorAmount(overview.totalBaseMinor, base)}`,
    status:
      overview.pendingTransferCount === 0
        ? "已結清"
        : `還有 ${overview.pendingTransferCount} 筆待還款`,
    pending: overview.pendingTransferCount > 0,
  };
}

/** 年份篩選：選中的貼一條紙膠帶，沒選的畫點線底線 */
function YearFilter({
  years,
  selected,
  onSelect,
}: {
  years: readonly string[];
  selected: string | null;
  onSelect: (year: string | null) => void;
}) {
  const theme = useTheme();
  const options: (string | null)[] = [null, ...years];
  return (
    <View accessibilityLabel="依年份篩選" style={styles.yearRow}>
      {options.map((year, index) => {
        const isSelected = year === selected;
        return (
          <Pressable
            key={year ?? "all"}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(year)}
            style={styles.yearChip}
          >
            {isSelected ? (
              <View style={styles.tapeBox}>
                <WashiTape
                  color={TAPE_COLORS[index % TAPE_COLORS.length]}
                  tilt={TAPE_TILTS[index % TAPE_TILTS.length]}
                />
              </View>
            ) : (
              <Svg width="70%" height={2} style={styles.dotted}>
                <Line
                  x1={0}
                  y1={1}
                  x2="100%"
                  y2={1}
                  stroke={theme.text}
                  strokeOpacity={0.4}
                  strokeWidth={1.5}
                  strokeDasharray="1.5 3"
                  strokeLinecap="round"
                />
              </Svg>
            )}
            <Text
              style={[
                styles.yearText,
                { color: theme.text },
                isSelected && { fontFamily: fonts.bold },
              ]}
            >
              {year === null ? "全部" : `${year} 年`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const MONTHS = [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** 月份篩選：像月曆，用朱筆圈起選中的月份；沒有帳本的月份變淡、不能點 */
function MonthFilter({
  available,
  selected,
  onSelect,
}: {
  available: readonly number[];
  selected: number | null;
  onSelect: (month: number | null) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="依月份篩選"
      style={styles.monthScroll}
      contentContainerStyle={styles.monthRow}
    >
      {MONTHS.map((month) => {
        const disabled = month !== null && !available.includes(month);
        const isSelected = month === selected;
        const chipWidth = month === null ? 50 : 40;
        const ringWidth = month === null ? 52 : 42;
        return (
          <Pressable
            key={month ?? "all"}
            accessibilityRole="button"
            accessibilityLabel={
              month === null
                ? "全部月份"
                : `${month} 月${disabled ? "，沒有帳本" : ""}`
            }
            accessibilityState={{ selected: isSelected, disabled }}
            disabled={disabled}
            onPress={() => onSelect(month)}
            style={[
              styles.monthChip,
              { width: chipWidth, opacity: disabled ? 0.3 : 1 },
            ]}
          >
            {isSelected && (
              <View
                style={[styles.ring, { left: (chipWidth - ringWidth) / 2 }]}
              >
                <HandCircle width={ringWidth} height={44} />
              </View>
            )}
            <Text
              style={[
                month === null ? styles.monthAll : styles.monthNumber,
                { color: theme.text },
              ]}
            >
              {month ?? "全部"}
            </Text>
            <Text style={[styles.monthUnit, { color: theme.textMuted }]}>
              {month === null ? "月份" : "月"}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function NewNotebookIcon() {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 22 22"
      fill="none"
      stroke="#3A332D"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M5 3.5h9.5c.9 0 1.5.7 1.5 1.5v6" />
      <Path d="M5 3.5v15h6.5" />
      <Path d="M7.7 3.6v14.8" />
      <Path d="M16 14v6M13 17h6" />
    </Svg>
  );
}

function BackupIcon() {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 22 22"
      fill="none"
      stroke="#3A332D"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M4 8.5h14v9.3c0 .7-.5 1.2-1.2 1.2H5.2c-.7 0-1.2-.5-1.2-1.2z" />
      <Path d="M3.2 5.2h15.6v3.3H3.2z" />
      <Path d="M11 11v5M8.8 13.8L11 16l2.2-2.2" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: GUTTER,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: spacing.xs,
  },
  kicker: {
    fontFamily: fonts.accent,
    fontSize: 18,
    lineHeight: 20,
    paddingRight: accentOverhang(18),
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 25,
    lineHeight: 32,
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 13,
    paddingBottom: 5,
  },
  yearRow: {
    flexDirection: "row",
    gap: 6,
    marginLeft: -4,
  },
  yearChip: {
    minHeight: 44,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  tapeBox: {
    position: "absolute",
    left: 2,
    right: 2,
    top: 10,
    bottom: 9,
  },
  dotted: {
    position: "absolute",
    bottom: 10,
  },
  yearText: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  // 捲動範圍延伸到螢幕邊緣，邊距改由內容補上，圈選的線才不會被 ScrollView 切掉
  monthScroll: {
    marginHorizontal: -GUTTER,
  },
  monthRow: {
    gap: 2,
    paddingBottom: spacing.sm,
    paddingHorizontal: GUTTER,
  },
  monthChip: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    top: 5,
  },
  monthNumber: {
    fontFamily: fonts.accent,
    fontSize: 23,
    lineHeight: 24,
    paddingRight: accentOverhang(23),
  },
  monthAll: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  monthUnit: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
  },
  content: {
    paddingTop: spacing.sm,
    paddingBottom: 120,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.xl,
  },
  group: {
    paddingBottom: spacing.lg,
  },
  groupHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: GUTTER,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  groupTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: COLUMN_GAP,
    rowGap: 24,
    paddingHorizontal: GUTTER,
  },
  book: {
    gap: spacing.sm,
  },
  bookText: {
    gap: 1,
    paddingHorizontal: 2,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  status: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
});
