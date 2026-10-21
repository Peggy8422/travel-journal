import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import {
  formatMinorAmount,
  type CategoryTotal,
  type CurrencyCode,
} from "../../../domain/ledger";
import { Label, Row, Section } from "../../../shared/ui/components";
import { DonutChart } from "../../../shared/ui/DonutChart";
import { useTheme } from "../../../shared/ui/theme";
import {
  categoryColor,
  categoryLabel,
  orderForChart,
  UNCATEGORIZED_KEY,
} from "./categories";

/**
 * 分類甜甜圈圖與圖例（統計頁與個人分頁共用）。
 * 依分類清單的固定順序排列、顏色跟著分類走；點一段或一列圖例可查看該分類。
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
    percent:
      totalMinor === 0 ? 0 : Math.round((c.totalMinor / totalMinor) * 100),
  }));
  const selected = categories.find((c) => c.key === selectedKey);

  return (
    <Section title="分類（點一下可查看）">
      <View style={styles.chart}>
        <DonutChart
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
          {selected ? (
            <>
              <Label>{selected.label}</Label>
              <Label>{money(selected.totalMinor)}</Label>
              <Label muted>{selected.percent}%</Label>
            </>
          ) : (
            <>
              <Label muted>{centerLabel}</Label>
              <Label>{money(totalMinor)}</Label>
            </>
          )}
        </DonutChart>
      </View>
      {categories.map((c) => (
        <Pressable
          key={c.key}
          accessibilityRole="button"
          accessibilityState={{ selected: c.key === selectedKey }}
          onPress={() => setSelectedKey(c.key === selectedKey ? null : c.key)}
          style={{ opacity: selectedKey && selectedKey !== c.key ? 0.5 : 1 }}
        >
          <Row>
            <View style={styles.legendName}>
              <View style={[styles.swatch, { backgroundColor: c.color }]} />
              <View style={{ flex: 1 }}>
                <Label>{c.label}</Label>
              </View>
            </View>
            <Label>
              {money(c.totalMinor)}
              <Label muted> {c.percent}%</Label>
            </Label>
          </Row>
        </Pressable>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  chart: {
    alignItems: "center",
    paddingVertical: 8,
  },
  legendName: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
});
