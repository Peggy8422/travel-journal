import { View } from "react-native";

import { formatMinorAmount } from "../../../domain/ledger";
import {
  Label,
  MessageScreen,
  Row,
  Screen,
  Section,
} from "../../../shared/ui/components";
import { useTheme } from "../../../shared/ui/theme";
import { useLedgerStats } from "../hooks/useLedgerQueries";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { describeError } from "./messages";

export function LedgerStatsScreen({ ledgerId }: { ledgerId: string }) {
  const theme = useTheme();
  const { data, error } = useLedgerStats(ledgerId);

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

      <CategoryBreakdown
        categories={stats.categories}
        totalMinor={stats.totalMinor}
        currency={base}
      />
    </Screen>
  );
}
