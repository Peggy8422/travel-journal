import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { formatMinorAmount } from "../../../domain/ledger";
import {
  Label,
  MessageScreen,
  Row,
  Screen,
  Section,
} from "../../../shared/ui/components";
import { DonutChart } from "../../../shared/ui/DonutChart";
import { useTheme } from "../../../shared/ui/theme";
import { useLedgerStats } from "../hooks/useLedgerQueries";
import {
  categoryColor,
  categoryLabel,
  orderForChart,
  UNCATEGORIZED_KEY,
} from "./categories";
import { describeError } from "./messages";

export function LedgerStatsScreen({ ledgerId }: { ledgerId: string }) {
  const theme = useTheme();
  const { data, error } = useLedgerStats(ledgerId);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (error) return <MessageScreen text="讀取帳本失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;

  const { ledger, members, stats } = data.value;
  const base = ledger.baseCurrency;
  const money = (minor: number) => `${base} ${formatMinorAmount(minor, base)}`;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  if (stats.totalMinor === 0) {
    return <MessageScreen text="還沒有消費，記帳後就能看到統計" />;
  }

  // 依分類清單的固定順序排列，顏色跟著分類走
  const categories = orderForChart(stats.categories).map((c) => ({
    ...c,
    key: c.category ?? UNCATEGORIZED_KEY,
    label: categoryLabel(c.category),
    color: categoryColor(c.category, theme),
    percent: Math.round((c.totalMinor / stats.totalMinor) * 100),
  }));
  const selected = categories.find((c) => c.key === selectedKey);

  return (
    <Screen>
      <Section title="總花費">
        <Label>{money(stats.totalMinor)}</Label>
        <Label muted>外幣消費已依記帳時的匯率換算成 {base}，不含還款</Label>
      </Section>

      <Section title="每個人">
        {stats.members.map((m) => {
          // 正數代表墊付比自己負擔的多
          const diff = m.paidMinor - m.shareMinor;
          const color =
            diff > 0 ? theme.positive : diff < 0 ? theme.negative : undefined;
          return (
            <Row key={m.memberId}>
              <View style={{ flex: 1 }}>
                <Label>{nameOf(m.memberId)}</Label>
                <Label muted>
                  付出 {money(m.paidMinor)} · 負擔 {money(m.shareMinor)}
                </Label>
              </View>
              <Label color={color} muted={diff === 0}>
                {diff > 0 ? "+" : ""}
                {formatMinorAmount(diff, base)}
              </Label>
            </Row>
          );
        })}
        <Label muted>右側為付出減負擔，正數代表幫別人墊付較多</Label>
      </Section>

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
                <Label muted>總花費</Label>
                <Label>{money(stats.totalMinor)}</Label>
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
            style={{
              opacity: selectedKey && selectedKey !== c.key ? 0.5 : 1,
            }}
          >
            <Row>
              <View style={styles.legendName}>
                <View style={[styles.swatch, { backgroundColor: c.color }]} />
                <Label>{c.label}</Label>
              </View>
              <Label>
                {money(c.totalMinor)}
                <Label muted> {c.percent}%</Label>
              </Label>
            </Row>
          </Pressable>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chart: {
    alignItems: "center",
    paddingVertical: 8,
  },
  legendName: {
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
