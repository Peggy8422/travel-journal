import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Line, Path } from "react-native-svg";

import type { Result } from "../../../domain/common/result";
import {
  formatMinorAmount,
  type SettlementRecord,
  type Transfer,
} from "../../../domain/ledger";
import {
  Button,
  CardTitle,
  ErrorText,
  SmallButton,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { DashedLine, InkStamp } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import {
  addSettlement,
  deleteSettlement,
  settleAll,
  type LedgerCommandError,
} from "../services/ledgerCommands";
import type { LedgerSummary } from "../services/ledgerSummary";
import {
  formatLocalDateTime,
  toLocalIsoString,
} from "../services/localTimestamp";
import { buildSettlementShareText } from "../services/settlementShareText";
import { SelfBadge } from "./badges";
import { describeError } from "./messages";

const STAMP = "#B5452B";

/** 帳本內頁的「結算」索引籤：結餘、還款建議、還款紀錄 */
export function SettlePanel({
  ledgerId,
  summary,
  reload,
  bottomInset,
}: {
  ledgerId: string;
  summary: LedgerSummary;
  reload: () => void;
  /** 底部安全區域，最後要留空間給右下角的「新增消費」 */
  bottomInset: number;
}) {
  const theme = useTheme();
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const [actionError, setActionError] = useState<string | null>(null);
  const { members, transfers, settlements, expenses } = summary;
  const base = summary.ledger.baseCurrency;
  const money = (minor: number) => `${base} ${formatMinorAmount(minor, base)}`;
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "?";

  /** 執行一個寫入動作；成功時顯示提示、失敗時顯示訊息，完成後重新讀取 */
  async function run(
    action: () => Promise<Result<unknown, LedgerCommandError>>,
    done: string,
    failure: string,
  ) {
    setActionError(null);
    try {
      const result = await action();
      if (result.ok) toast(done);
      else setActionError(describeError(result.error));
      reload();
    } catch {
      setActionError(failure);
    }
  }

  function confirmSettlement(transfer: Transfer) {
    Alert.alert(
      "記錄還款",
      `${nameOf(transfer.fromId)} 已還給 ${nameOf(transfer.toId)} ${money(transfer.amountMinor)}？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "記錄",
          onPress: () =>
            run(
              () =>
                addSettlement(deps, ledgerId, {
                  ...transfer,
                  settledAt: toLocalIsoString(new Date()),
                }),
              "記下這筆還款",
              "記錄失敗，請再試一次",
            ),
        },
      ],
    );
  }

  function confirmSettleAll() {
    const lines = transfers.map(
      (t) => `${nameOf(t.fromId)} → ${nameOf(t.toId)} ${money(t.amountMinor)}`,
    );
    Alert.alert(
      "全部結清",
      `記錄以下 ${lines.length} 筆還款？\n${lines.join("\n")}`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "記錄",
          onPress: () =>
            run(
              () => settleAll(deps, ledgerId, toLocalIsoString(new Date())),
              `記下 ${transfers.length} 筆還款`,
              "記錄失敗，請再試一次",
            ),
        },
      ],
    );
  }

  function confirmDeleteSettlement(settlement: SettlementRecord) {
    Alert.alert(
      "刪除還款",
      `確定要刪除「${nameOf(settlement.fromId)} → ${nameOf(settlement.toId)} ${money(settlement.amountMinor)}」這筆還款嗎？\n刪除後會重新計算結餘與還款建議，因這筆還款而「已結清」的消費可能會變回未結清。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () =>
            run(
              () => deleteSettlement(deps, settlement.id),
              "刪掉這筆還款了",
              "刪除失敗，請再試一次",
            ),
        },
      ],
    );
  }

  async function shareSettlement() {
    setActionError(null);
    const text = buildSettlementShareText(summary, new Date());
    if (!text.ok) {
      setActionError(describeError(text.error));
      return;
    }
    try {
      await Share.share({
        title: `${summary.ledger.name} 結算`,
        message: text.value,
      });
    } catch {
      setActionError("分享失敗，請再試一次");
    }
  }

  const maxAbs = Math.max(
    1,
    ...members.map((m) => Math.abs(summary.balances.get(m.id) ?? 0)),
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomInset + 110 },
      ]}
    >
      <ErrorText message={actionError} />

      <View style={styles.section}>
        <CardTitle title="結餘" hint="＋ 代表別人欠他、− 代表他欠別人" />
        {members.map((member) => {
          const balance = summary.balances.get(member.id) ?? 0;
          const width = (Math.abs(balance) / maxAbs) * 50;
          const valueColor =
            balance > 0
              ? theme.positive
              : balance < 0
                ? theme.negative
                : theme.textMuted;
          return (
            <View
              key={member.id}
              accessible
              accessibilityLabel={`${member.name}${member.isSelf ? "（我）" : ""} ${balance > 0 ? "+" : ""}${formatMinorAmount(balance, base)}`}
              style={styles.balanceRow}
            >
              <View style={styles.balanceName}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, { color: theme.text }]}
                >
                  {member.name}
                </Text>
                {member.isSelf && <SelfBadge />}
              </View>
              <View style={styles.bar}>
                <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                  <Line
                    x1="50%"
                    y1={-5}
                    x2="50%"
                    y2={24}
                    stroke={theme.text}
                    strokeOpacity={0.35}
                    strokeWidth={1.2}
                    strokeDasharray="3 3"
                  />
                </Svg>
                {balance !== 0 && (
                  <View
                    style={[
                      styles.barFill,
                      {
                        left: `${balance > 0 ? 50 : 50 - width}%`,
                        width: `${width}%`,
                        backgroundColor:
                          balance > 0
                            ? theme.categorical[1]
                            : theme.categorical[0],
                      },
                    ]}
                  />
                )}
              </View>
              <Text style={[styles.balanceValue, { color: valueColor }]}>
                {balance > 0 ? "+" : ""}
                {formatMinorAmount(balance, base)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <CardTitle title="還款建議" />
        {transfers.length === 0 && (
          <View style={[styles.clear, { backgroundColor: theme.background }]}>
            <View style={styles.clearStamp}>
              <InkStamp size={52} label="結清" color={STAMP} />
            </View>
            <Text style={[styles.clearText, { color: theme.text }]}>
              {expenses.length > 0
                ? "目前沒有欠款，這本帳本已經結清。"
                : "還沒有消費，也還沒有欠款。"}
            </Text>
          </View>
        )}
        {transfers.map((transfer) => (
          <View
            key={`${transfer.fromId}-${transfer.toId}`}
            style={styles.transfer}
          >
            <View style={styles.transferMain}>
              <View style={styles.transferWho}>
                <Text style={[styles.transferName, { color: theme.text }]}>
                  {nameOf(transfer.fromId)}
                </Text>
                <Svg
                  width={22}
                  height={14}
                  viewBox="0 0 22 14"
                  accessibilityLabel="還給"
                >
                  <Path
                    d="M1.5 7.4c5.8-.6 11.6.3 17.6-.2M15.2 3.2l4.2 4-4.1 3.9"
                    fill="none"
                    stroke={theme.text}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={[styles.transferName, { color: theme.text }]}>
                  {nameOf(transfer.toId)}
                </Text>
              </View>
              <Text style={[styles.transferAmount, { color: theme.text }]}>
                {money(transfer.amountMinor)}
              </Text>
            </View>
            <SmallButton
              title="記錄還款"
              accessibilityLabel={`記錄 ${nameOf(transfer.fromId)} 還給 ${nameOf(transfer.toId)} ${money(transfer.amountMinor)}`}
              onPress={() => confirmSettlement(transfer)}
            />
          </View>
        ))}
        {transfers.length > 1 && (
          <Button
            title={`全部結清（${transfers.length} 筆）`}
            onPress={confirmSettleAll}
          />
        )}
        {expenses.length > 0 && (
          <Button
            title="分享結算結果"
            variant="secondary"
            onPress={shareSettlement}
          />
        )}
      </View>

      {settlements.length > 0 && (
        <View style={styles.history}>
          <CardTitle title="還款紀錄" hint="點一下可以刪除" />
          {[...settlements].reverse().map((settlement) => {
            const label = `${nameOf(settlement.fromId)} → ${nameOf(settlement.toId)}`;
            return (
              <Pressable
                key={settlement.id}
                accessibilityRole="button"
                accessibilityLabel={`${label} ${money(settlement.amountMinor)}`}
                accessibilityHint="刪除這筆還款"
                onPress={() => confirmDeleteSettlement(settlement)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <View style={styles.historyRow}>
                  <View style={styles.historyMain}>
                    <Text style={[styles.historyLabel, { color: theme.text }]}>
                      {label}
                    </Text>
                    <Text
                      style={[styles.historyWhen, { color: theme.textMuted }]}
                    >
                      {formatLocalDateTime(settlement.settledAt)}
                    </Text>
                  </View>
                  <Text style={[styles.historyLabel, { color: theme.text }]}>
                    {money(settlement.amountMinor)}
                  </Text>
                </View>
                <DashedLine dotted />
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingTop: 16,
    paddingHorizontal: 14,
  },
  section: {
    gap: 10,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
  },
  balanceName: {
    width: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  bar: {
    flex: 1,
    height: 14,
  },
  barFill: {
    position: "absolute",
    top: 1,
    height: 12,
    borderRadius: 4,
    opacity: 0.85,
  },
  balanceValue: {
    width: 72,
    textAlign: "right",
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  clear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 15,
  },
  clearStamp: {
    transform: [{ rotate: "-12deg" }],
  },
  clearText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 23,
  },
  transfer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
    backgroundColor: "#FFFDF8",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 15,
    boxShadow:
      "0px 0px 0px 1.2px rgba(58,51,45,0.3), 1px 2px 0px rgba(58,51,45,0.08)",
  },
  transferMain: {
    flex: 1,
    gap: 3,
  },
  transferWho: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  transferName: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  transferAmount: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  history: {
    gap: 4,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  historyMain: {
    flex: 1,
    gap: 1,
  },
  historyLabel: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
  },
  historyWhen: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
});
