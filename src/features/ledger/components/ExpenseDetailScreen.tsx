import { router } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { formatMinorAmount, type CurrencyCode } from "../../../domain/ledger";
import { CloseButton, SmallButton } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import {
  DashedLine,
  PaperBackground,
  ReceiptPaper,
} from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { useExpenseDetail } from "../hooks/useLedgerQueries";
import { formatLocalDate } from "../services/localTimestamp";
import { SelfBadge, SettledTag } from "./badges";
import { categoryLabel } from "./categories";
import { CategoryIcon } from "./CategoryIcon";
import { describeStoredFx } from "./fxLabels";
import { describeError } from "./messages";

/**
 * 消費明細（只能看）：從下面升起的卡片，所有點消費的地方都先到這裡。
 * 要修改按右上角「編輯」，進原本的收據表單；在表單裡刪掉這筆後回到這裡會自動收起。
 */
export function ExpenseDetailScreen({ expenseId }: { expenseId: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { data, error } = useExpenseDetail(expenseId);
  const gone = data?.ok === false && data.error.code === "EXPENSE_NOT_FOUND";

  useEffect(() => {
    if (gone && router.canGoBack()) router.back();
  }, [gone]);

  if (error || (data && !data.ok)) {
    return (
      <Sheet>
        <View style={styles.top}>
          <View style={styles.flex} />
          <CloseButton onPress={router.back} />
        </View>
        <Text style={[styles.message, { color: theme.textMuted }]}>
          {data && !data.ok ? describeError(data.error) : "讀取消費失敗"}
        </Text>
      </Sheet>
    );
  }
  if (!data) return <Sheet>{null}</Sheet>;

  const { expense, ledger, payer, baseMinor, shares, status } = data.value;
  const personal = ledger.kind === "personal";
  const base = ledger.baseCurrency;
  const time = `${formatLocalDate(expense.occurredAt.slice(0, 10))} ${expense.occurredAt.slice(11, 16)}`;

  function edit() {
    if (personal) {
      router.push({
        pathname: "/personal/expense/[expenseId]",
        params: { expenseId },
      });
    } else {
      router.push({
        pathname: "/ledger/[id]/expense/[expenseId]",
        params: { id: ledger.id, expenseId },
      });
    }
  }

  return (
    <Sheet bottom={insets.bottom}>
      <View style={styles.top}>
        <Text
          numberOfLines={1}
          style={[styles.ledger, { color: theme.textMuted }]}
        >
          {personal ? "個人記帳" : ledger.name}
        </Text>
        <SmallButton
          title="編輯"
          accessibilityLabel="編輯這筆消費"
          onPress={edit}
          icon={
            <Svg
              width={15}
              height={15}
              viewBox="0 0 16 16"
              fill="none"
              stroke={theme.text}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M10.6 2.9l2.5 2.5-7.4 7.4-3.1.6.6-3.1z" />
              <Path d="M9.2 4.3l2.5 2.5" />
            </Svg>
          }
        />
        <CloseButton onPress={router.back} />
      </View>

      <ReceiptPaper style={styles.receipt}>
        <View style={styles.titleRow}>
          <CategoryIcon category={expense.category} size={40} />
          <View style={styles.flex}>
            <Text
              accessibilityRole="header"
              style={[styles.title, { color: theme.text }]}
            >
              {expense.title}
            </Text>
            <Text style={[styles.small, { color: theme.textMuted }]}>
              {categoryLabel(expense.category)}
            </Text>
          </View>
          {status === "settled" ? (
            <SettledTag />
          ) : status === "offset" ? (
            <Text style={[styles.small, { color: theme.textMuted }]}>
              已抵銷
            </Text>
          ) : null}
        </View>

        <DashedLine />
        <View style={styles.amountBlock}>
          <Text style={[styles.amount, { color: theme.text }]}>
            {money(expense.amountMinor, expense.currency)}
          </Text>
          {expense.currency !== base && (
            <Text style={[styles.converted, { color: theme.text }]}>
              ≈ {money(baseMinor, base)}
            </Text>
          )}
          {expense.fx && (
            <Text style={[styles.small, { color: theme.textMuted }]}>
              {describeStoredFx(expense.fx, expense.currency, base)}
            </Text>
          )}
        </View>
        <DashedLine />

        <DetailRow label="時間" value={time} />
        {(expense.placeName !== null || expense.location !== null) && (
          <DetailRow label="地點" value={expense.placeName ?? "已記錄位置"} />
        )}
        {!personal && payer && (
          <DetailRow
            label="付款人"
            value={payer.name}
            badge={payer.isSelf ? <SelfBadge /> : undefined}
          />
        )}
        {!personal && (
          <View style={styles.shares}>
            <Text style={[styles.label, { color: theme.textMuted }]}>
              分攤（{shares.length} 人）
            </Text>
            {shares.map(({ member, amountMinor }) => (
              <View key={member.id} style={styles.shareRow}>
                <Text style={[styles.value, { color: theme.text }]}>
                  {member.name}
                </Text>
                {member.isSelf && <SelfBadge />}
                <View style={styles.dots}>
                  <DashedLine dotted opacity={0.3} />
                </View>
                <Text
                  style={[
                    styles.value,
                    {
                      color: theme.text,
                      fontFamily: member.isSelf ? fonts.bold : fonts.regular,
                    },
                  ]}
                >
                  {money(amountMinor, base)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {expense.note !== null && (
          <View style={styles.note}>
            <Text style={[styles.label, { color: theme.textMuted }]}>備註</Text>
            <Text style={[styles.noteText, { color: theme.text }]}>
              {expense.note}
            </Text>
          </View>
        )}
      </ReceiptPaper>
    </Sheet>
  );
}

function money(minor: number, currency: CurrencyCode): string {
  return `${currency} ${formatMinorAmount(minor, currency)}`;
}

/** 卡片本體：紙紋底、可以捲動（停在半高時內容比卡片長） */
function Sheet({
  children,
  bottom = 0,
}: {
  children: ReactNode;
  bottom?: number;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 28 }]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** 收據上的一行：左邊小標，右邊內容 */
function DetailRow({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row} accessible>
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      <View style={styles.rowValue}>
        <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        {badge}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    gap: 14,
    paddingTop: 22,
    paddingHorizontal: 18,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ledger: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  message: {
    marginTop: 12,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 25,
  },
  receipt: {
    gap: 12,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 26,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 27,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 19,
  },
  amountBlock: {
    alignItems: "flex-end",
    gap: 2,
  },
  amount: {
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: 36,
  },
  converted: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  rowValue: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 22,
  },
  value: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "right",
  },
  shares: {
    gap: 6,
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 8,
  },
  dots: {
    flex: 1,
    marginHorizontal: 4,
  },
  note: {
    gap: 2,
  },
  noteText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
  },
});
