import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import {
  formatMinorAmount,
  type CategoryTotal,
  type CurrencyCode,
} from "../../../domain/ledger";
import { Card, CardTitle } from "../../../shared/ui/components";
import { DonutChart } from "../../../shared/ui/DonutChart";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";
import {
  categoryColor,
  categoryLabel,
  categoryTint,
  orderForChart,
  UNCATEGORIZED_KEY,
} from "./categories";

const SIZE = 220;
const THICKNESS = 32;

/**
 * 分類甜甜圈圖與圖例的卡片（統計頁與個人分頁共用）。
 * 依分類清單的固定順序排列、顏色跟著分類走；點一段或一列圖例可查看該分類，再點一次取消。
 */
export function CategoryBreakdown({
  categories: totals,
  totalMinor,
  currency,
  centerLabel = "總花費",
}: {
  categories: readonly CategoryTotal[];
  totalMinor: number;
  currency: CurrencyCode;
  /** 沒有選取時，圓圈中間顯示的標題 */
  centerLabel?: string;
}) {
  const theme = useTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const money = (minor: number) =>
    `${currency} ${formatMinorAmount(minor, currency)}`;

  const categories = orderForChart(totals).map((c) => ({
    ...c,
    key: c.category ?? UNCATEGORIZED_KEY,
    label: categoryLabel(c.category),
    color: categoryColor(c.category, theme),
    tint: categoryTint(c.category, theme),
    percent:
      totalMinor === 0 ? 0 : Math.round((c.totalMinor / totalMinor) * 100),
  }));
  const selected = categories.find((c) => c.key === selectedKey);

  return (
    <Card style={styles.card}>
      <CardTitle title="分類" hint="點圓環或分類可以查看" />
      <View style={styles.chart}>
        <DonutChart
          size={SIZE}
          thickness={THICKNESS}
          segments={categories.map((c) => ({
            key: c.key,
            value: c.totalMinor,
            color: c.color,
          }))}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          accessibilityLabel={`分類占比：${categories
            .map((c) => `${c.label} ${c.percent}%`)
            .join("，")}`}
        >
          {/* 鏤空處的鉛筆虛線圈，只是裝飾 */}
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={SIZE / 2 - THICKNESS - 18}
              fill="none"
              stroke={theme.text}
              strokeOpacity={0.25}
              strokeDasharray="2 4"
            />
          </Svg>
          <Text style={[styles.centerLabel, { color: theme.textMuted }]}>
            {selected ? selected.label : centerLabel}
          </Text>
          <Text style={[styles.centerValue, { color: theme.text }]}>
            {money(selected ? selected.totalMinor : totalMinor)}
          </Text>
          {selected && (
            <Text style={[styles.centerPercent, { color: theme.textMuted }]}>
              {selected.percent}%
            </Text>
          )}
        </DonutChart>
      </View>
      <View>
        {categories.map((c) => {
          const isSelected = c.key === selectedKey;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelectedKey(isSelected ? null : c.key)}
              style={[
                styles.legendRow,
                {
                  backgroundColor: isSelected ? c.tint : "transparent",
                  opacity: selectedKey && !isSelected ? 0.5 : 1,
                },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: c.color }]} />
              <Text style={[styles.legendLabel, { color: theme.text }]}>
                {c.label}
              </Text>
              <Text style={[styles.legendAmount, { color: theme.text }]}>
                {money(c.totalMinor)}
              </Text>
              <Text style={[styles.legendPercent, { color: theme.textMuted }]}>
                {c.percent}%
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    paddingVertical: 16,
  },
  chart: {
    alignItems: "center",
  },
  centerLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
  },
  centerValue: {
    fontFamily: fonts.bold,
    fontSize: 17,
    lineHeight: 22,
    textAlign: "center",
  },
  centerPercent: {
    fontFamily: fonts.accent,
    fontSize: 20,
    lineHeight: 22,
    paddingRight: accentOverhang(20),
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 8,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 13,
  },
  swatch: {
    width: 14,
    height: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 3,
    borderBottomLeftRadius: 6,
    transform: [{ rotate: "-6deg" }],
  },
  legendLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14.5,
  },
  legendAmount: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  legendPercent: {
    width: 40,
    textAlign: "right",
    fontFamily: fonts.regular,
    fontSize: 13,
  },
});
