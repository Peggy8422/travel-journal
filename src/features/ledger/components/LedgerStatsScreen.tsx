import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatMinorAmount } from "../../../domain/ledger";
import { Card, CardTitle } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import {
  DashedLine,
  PaperBackground,
  WashFill,
  WashiTape,
} from "../../../shared/ui/handDrawn";
import { PageHeader, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { useLedgerStats } from "../hooks/useLedgerQueries";
import { SelfBadge } from "./badges";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { describeError } from "./messages";

export function LedgerStatsScreen({ ledgerId }: { ledgerId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useLedgerStats(ledgerId);

  if (error) {
    return (
      <PageMessage backLabel="帳本" onBack={router.back} text="讀取帳本失敗" />
    );
  }
  if (!data) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]} />
    );
  }
  if (!data.ok) {
    return (
      <PageMessage
        backLabel="帳本"
        onBack={router.back}
        text={describeError(data.error)}
      />
    );
  }

  const { ledger, members, stats } = data.value;
  const base = ledger.baseCurrency;
  const money = (minor: number) => `${base} ${formatMinorAmount(minor, base)}`;
  const member = (id: string) => members.find((m) => m.id === id);
  const max = Math.max(
    1,
    ...stats.members.flatMap((m) => [m.paidMinor, m.shareMinor]),
  );

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <PageHeader
        backLabel={ledger.name}
        onBack={router.back}
        kicker="Stats"
        title="統計"
      />
      {stats.totalMinor === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>
          還沒有消費，記帳後就能看到統計。
        </Text>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 40 },
          ]}
        >
          <Card style={styles.totalCard}>
            <View style={styles.tape}>
              <WashiTape tilt={4} opacity={0.85} />
            </View>
            <Text style={[styles.totalLabel, { color: theme.textMuted }]}>
              {ledger.name} · 總花費
            </Text>
            <Text style={[styles.total, { color: theme.text }]}>
              {money(stats.totalMinor)}
            </Text>
            <Text style={[styles.note, { color: theme.textMuted }]}>
              外幣消費已依記帳時的匯率換算成 {base}，不含還款。
            </Text>
          </Card>

          <CategoryBreakdown
            categories={stats.categories}
            totalMinor={stats.totalMinor}
            currency={base}
          />

          <Card style={styles.membersCard}>
            <CardTitle
              title="每個人"
              hint={
                <View style={styles.legend}>
                  <LegendKey color={theme.categorical[1]} label="付出" />
                  <LegendKey color={theme.categorical[3]} label="負擔" />
                </View>
              }
            />
            {stats.members.map((m) => {
              // 正數代表墊付比自己負擔的多
              const diff = m.paidMinor - m.shareMinor;
              const record = member(m.memberId);
              return (
                <View key={m.memberId}>
                  <View style={styles.memberBlock}>
                    <View style={styles.memberHead}>
                      <View style={styles.memberName}>
                        <Text style={[styles.name, { color: theme.text }]}>
                          {record?.name ?? "?"}
                        </Text>
                        {record?.isSelf && <SelfBadge />}
                      </View>
                      <Text
                        style={[
                          styles.diff,
                          {
                            color:
                              diff > 0
                                ? theme.positive
                                : diff < 0
                                  ? theme.negative
                                  : theme.textMuted,
                          },
                        ]}
                      >
                        {diff > 0 ? "+" : ""}
                        {formatMinorAmount(diff, base)}
                      </Text>
                    </View>
                    <AmountBar
                      label="付出"
                      color={theme.categorical[1]}
                      ratio={m.paidMinor / max}
                      amount={money(m.paidMinor)}
                    />
                    <AmountBar
                      label="負擔"
                      color={theme.categorical[3]}
                      ratio={m.shareMinor / max}
                      amount={money(m.shareMinor)}
                    />
                  </View>
                  <DashedLine dotted />
                </View>
              );
            })}
            <Text style={[styles.note, { color: theme.textMuted }]}>
              右上的數字是付出減負擔，正數代表幫別人墊付比較多。
            </Text>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendKey}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

/** 一條水彩色的長條：左邊標籤、右邊金額，長度相對所有人裡最大的那個金額 */
function AmountBar({
  label,
  color,
  ratio,
  amount,
}: {
  label: string;
  color: string;
  ratio: number;
  amount: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.barRow}>
      <Text style={[styles.barLabel, { color: theme.textMuted }]}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${ratio * 100}%` }]}>
          <WashFill color={color} />
        </View>
      </View>
      <Text style={[styles.barAmount, { color: theme.text }]}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 26,
    marginVertical: 30,
    marginHorizontal: 20,
  },
  content: {
    gap: 16,
    paddingTop: 4,
    paddingHorizontal: 14,
  },
  totalCard: {
    gap: 4,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  tape: {
    position: "absolute",
    right: 26,
    top: -8,
    width: 58,
    height: 17,
  },
  totalLabel: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
  },
  total: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 40,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 20,
  },
  membersCard: {
    gap: 6,
    paddingVertical: 16,
  },
  legend: {
    flexDirection: "row",
    gap: 12,
  },
  legendKey: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  memberBlock: {
    gap: 5,
    paddingVertical: 10,
  },
  memberHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  memberName: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  diff: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  barLabel: {
    width: 30,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(58,51,45,0.07)",
  },
  barFill: {
    height: 10,
  },
  barAmount: {
    width: 84,
    textAlign: "right",
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
});
