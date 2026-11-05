import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { Result } from "../../../domain/common/result";
import { formatMinorAmount, type ExpenseRecord } from "../../../domain/ledger";
import { notifyDataChanged } from "../../../shared/hooks/useFocusedQuery";
import { ErrorText, SmallButton } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { DashedLine } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { useDeletedExpenses } from "../hooks/useLedgerQueries";
import { useDeletedPersonalExpenses } from "../hooks/usePersonalQueries";
import { restoreExpense } from "../services/ledgerCommands";
import { toLocalIsoString } from "../services/localTimestamp";
import { restorePersonalExpense } from "../services/personalCommands";
import { describeError, type DisplayableError } from "./messages";

/** 帳本內頁消費列表最下面的「最近刪除」；沒有刪除的消費時不顯示 */
export function DeletedExpensesFold({ ledgerId }: { ledgerId: string }) {
  const deps = useLedgerCommandDeps();
  const { data } = useDeletedExpenses(ledgerId);
  return (
    <DeletedFold
      items={data?.map(expenseItem)}
      hint="還原後會放回帳本"
      restore={(id) => restoreExpense(deps, id)}
    />
  );
}

/** 個人記帳明細最下面的「最近刪除」；沒有刪除的消費時不顯示 */
export function DeletedPersonalExpensesFold() {
  const deps = useLedgerCommandDeps();
  const { data } = useDeletedPersonalExpenses();
  return (
    <DeletedFold
      items={data?.map(expenseItem)}
      hint="還原後會放回個人記帳"
      restore={(id) => restorePersonalExpense(deps, id)}
    />
  );
}

/** 「最近刪除」裡的一列 */
export interface DeletedItem {
  readonly id: string;
  readonly title: string;
  /** 標題下面的小字（例如金額），後面會接刪除的日期 */
  readonly detail: string | null;
  readonly deletedAt: string | null;
}

function expenseItem(expense: ExpenseRecord): DeletedItem {
  return {
    id: expense.id,
    title: expense.title,
    detail: `${expense.currency} ${formatMinorAmount(expense.amountMinor, expense.currency)}`,
    deletedAt: expense.deletedAt,
  };
}

/**
 * 平常只是一行淡色的「最近刪除 N 筆」，點一下在原地展開，每筆都能還原。
 * 偶爾才用得到，所以不搶列表的版面。
 */
export function DeletedFold({
  items,
  hint,
  restore,
  unit = "筆",
}: {
  items: readonly DeletedItem[] | undefined;
  hint: string;
  restore: (id: string) => Promise<Result<void, DisplayableError>>;
  /** 「最近刪除 3 筆」的量詞 */
  unit?: string;
}) {
  const theme = useTheme();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

  async function restoreOne(item: DeletedItem) {
    setError(null);
    setBusyId(item.id);
    try {
      const result = await restore(item.id);
      if (!result.ok) {
        setError(describeError(result.error));
        return;
      }
      // The list above and its totals change too, not just this fold
      notifyDataChanged();
      toast(`「${item.title}」放回來了`);
    } catch {
      setError("還原失敗，請再試一次");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.fold}>
      <DashedLine opacity={0.35} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`最近刪除 ${items.length} ${unit}`}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [styles.toggle, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.toggleText, { color: theme.textMuted }]}>
          最近刪除 {items.length} {unit}
        </Text>
        <Svg
          width={14}
          height={14}
          viewBox="0 0 18 18"
          fill="none"
          stroke={theme.textMuted}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}
        >
          <Path d="M7 4.6l4.3 4.3L7 13.2" />
        </Svg>
      </Pressable>
      {open && (
        <View style={styles.list}>
          <Text style={[styles.hint, { color: theme.textMuted }]}>{hint}</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.text}>
                <Text
                  numberOfLines={1}
                  style={[styles.title, { color: theme.text }]}
                >
                  {item.title}
                </Text>
                <Text style={[styles.sub, { color: theme.textMuted }]}>
                  {[
                    item.detail,
                    item.deletedAt && `${deletedDay(item.deletedAt)} 刪除`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <SmallButton
                title="還原"
                accessibilityLabel={`還原「${item.title}」`}
                disabled={busyId !== null}
                onPress={() => restoreOne(item)}
              />
            </View>
          ))}
          <ErrorText message={error} />
        </View>
      )}
    </View>
  );
}

/** 刪除的日期（手機的當地時間），例如 11/2 */
function deletedDay(deletedAt: string): string {
  const local = toLocalIsoString(new Date(deletedAt));
  return `${Number(local.slice(5, 7))}/${Number(local.slice(8, 10))}`;
}

const styles = StyleSheet.create({
  fold: {
    marginTop: 18,
  },
  toggle: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  toggleText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  list: {
    gap: 12,
    paddingTop: 2,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    opacity: 0.85,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
});
