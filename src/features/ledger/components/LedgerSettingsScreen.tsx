import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { Result } from "../../../domain/common/result";
import {
  coverFromId,
  rerollCover,
  TEXT_LIMITS,
  type MemberRecord,
} from "../../../domain/ledger";
import {
  Button,
  ButtonIcon,
  Card,
  CardTitle,
  ErrorText,
  Screen,
  SmallButton,
  TextField,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { DashedLine } from "../../../shared/ui/handDrawn";
import { MonthSwitcher } from "../../../shared/ui/MonthPicker";
import { PageHeader, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { useLedgerSummary } from "../hooks/useLedgerQueries";
import {
  addMember,
  changeLedgerCover,
  setLedgerTripMonth,
  deleteLedger,
  renameLedger,
  type LedgerCommandError,
} from "../services/ledgerCommands";
import { tripMonthOf } from "../services/ledgerOverview";
import {
  archiveMember,
  removeMember,
  renameMember,
  setSelfMember,
  unarchiveMember,
} from "../services/memberCommands";
import { shareExpensesCsv } from "../services/fileExports";
import { ArchivedTag, SelfBadge } from "./badges";
import { categoryLabel } from "./categories";
import { COVER_COLORS, coverTilt, describeCover } from "./coverStyles";
import { describeError } from "./messages";
import { NotebookCover } from "./NotebookCover";

export function LedgerSettingsScreen({ ledgerId }: { ledgerId: string }) {
  const theme = useTheme();
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const { data, error, reload } = useLedgerSummary(ledgerId);
  const [ledgerName, setLedgerName] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
  const { ledger, members, expenses, settlements } = data.value;
  const cover = ledger.cover ?? coverFromId(ledger.id);
  const palette = COVER_COLORS[cover.palette];

  /** 執行一個寫入動作；失敗時顯示訊息，成功後重新讀取（reloadAfter 為 false 時不讀取） */
  async function run(
    action: () => Promise<Result<unknown, LedgerCommandError>>,
    reloadAfter = true,
  ): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const result = await action();
      if (!result.ok) {
        setMessage(describeError(result.error));
        return false;
      }
      if (reloadAfter) reload();
      return true;
    } catch {
      setMessage("儲存失敗，請再試一次");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveLedgerName() {
    if (ledgerName === null) return;
    const saved = await run(() => renameLedger(deps, ledgerId, ledgerName));
    if (!saved) return;
    setLedgerName(null);
    toast(`帳本改名為「${ledgerName.trim()}」`);
  }

  async function saveNewMember() {
    const saved = await run(() => addMember(deps, ledgerId, newMemberName));
    if (!saved) return;
    setNewMemberName("");
    toast(`加入了 ${newMemberName.trim()}`);
  }

  async function remove(member: MemberRecord) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await removeMember(deps, member.id);
      if (result.ok) {
        setEditingId(null);
        reload();
        toast(`刪掉 ${member.name} 了`);
      } else if (result.error.code === "MEMBER_REFERENCED") {
        offerArchive(member);
      } else {
        setMessage(describeError(result.error));
      }
    } catch {
      setMessage("刪除失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  function offerArchive(member: MemberRecord) {
    Alert.alert(
      "無法刪除",
      `${member.name} 已經有消費或還款紀錄，刪除會讓帳目對不上。要改為封存嗎？封存後不能再加進新的消費，但舊紀錄會照常計算。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "封存",
          onPress: () => run(() => archiveMember(deps, member.id)),
        },
      ],
    );
  }

  function confirmRemove(member: MemberRecord) {
    Alert.alert("刪除成員", `確定要刪除 ${member.name} 嗎？`, [
      { text: "取消", style: "cancel" },
      { text: "刪除", style: "destructive", onPress: () => remove(member) },
    ]);
  }

  async function exportCsv() {
    if (!data?.ok) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await shareExpensesCsv(
        data.value,
        categoryLabel,
        new Date(),
      );
      if (!result.ok) setMessage(describeError(result.error));
    } catch {
      setMessage("匯出失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteLedger() {
    const counts = `${expenses.length} 筆消費、${settlements.length} 筆還款`;
    Alert.alert(
      "刪除帳本",
      `確定要刪除「${ledger.name}」嗎？帳本裡的成員、${counts}都會一起刪除，無法復原。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: async () => {
            // 刪除後不重新讀取，避免畫面閃過「找不到這本帳本」
            const deleted = await run(
              () => deleteLedger(deps, ledgerId),
              false,
            );
            if (!deleted) return;
            router.dismissTo("/ledgers");
            toast(`刪掉「${ledger.name}」了`);
          },
        },
      ],
    );
  }

  const nameDraft = ledgerName ?? ledger.name;
  const nameChanged =
    nameDraft.trim() !== "" && nameDraft.trim() !== ledger.name;
  const tripMonth = tripMonthOf(ledger, expenses);
  const autoMonth = tripMonthOf({ ...ledger, tripMonth: null }, expenses);
  const monthLabel = (month: string) =>
    `${month.slice(0, 4)} 年 ${Number(month.slice(5, 7))} 月`;
  const setTripMonth = (month: string | null) =>
    run(() => setLedgerTripMonth(deps, ledgerId, month));

  return (
    <Screen
      header={
        <PageHeader
          backLabel={ledger.name}
          onBack={router.back}
          kicker="Settings"
          title="帳本設定"
          divider
        />
      }
      contentStyle={styles.content}
    >
      <ErrorText message={message} />

      <Card style={styles.coverCard}>
        <NotebookCover
          cover={cover}
          title={ledger.name}
          caption={tripMonthOf(ledger, expenses).replace("-", ".")}
          width={124}
          tilt={coverTilt(ledger.id)}
        />
        <View style={styles.coverSide}>
          <CardTitle title="封面" />
          <Text style={[styles.body, { color: theme.textMuted }]}>
            {describeCover(cover)}。之後會開放自己挑樣式和顏色。
          </Text>
          <View style={styles.coverButtons}>
            <SmallButton
              title="換一個封面"
              icon={<DiceIcon color={theme.text} />}
              disabled={busy}
              onPress={() =>
                run(() => changeLedgerCover(deps, ledgerId, rerollCover(cover)))
              }
            />
            <SmallButton
              title="自訂封面 · 即將推出"
              disabled
              onPress={() => {}}
            />
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <CardTitle title="帳本名稱" />
        <TextField
          accessibilityLabel="帳本名稱"
          value={nameDraft}
          onChangeText={setLedgerName}
          maxLength={TEXT_LIMITS.ledgerName}
        />
        {nameChanged && (
          <View style={styles.end}>
            <SmallButton
              title="儲存名稱"
              variant="primary"
              onPress={saveLedgerName}
              disabled={busy}
            />
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <CardTitle
          title="旅行月份"
          hint={ledger.tripMonth === null ? "自動判斷" : "手動指定"}
        />
        <MonthSwitcher
          value={tripMonth}
          onChange={setTripMonth}
          label="旅行月份"
          pickerTitle="選擇旅行月份"
          disabled={busy}
        />
        <Text style={[styles.body, { color: theme.textMuted }]}>
          {ledger.tripMonth !== null
            ? "書架會固定把這本帳本放在這個月份。"
            : expenses.length > 0
              ? "依最早一筆消費的月份放在書架上。出發前先記了預付款的話，可以按左右箭頭手動指定。"
              : "還沒有消費，先用建立帳本的月份；記下第一筆消費後會改用消費的月份。"}
        </Text>
        {ledger.tripMonth !== null && (
          <View style={styles.start}>
            <SmallButton
              title={`改回自動判斷（${monthLabel(autoMonth)}）`}
              onPress={() => setTripMonth(null)}
              disabled={busy}
            />
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <CardTitle title="成員" hint="點一下可以編輯" />
        {members.map((member) => {
          const open = member.id === editingId;
          const archived = member.archivedAt !== null;
          return (
            <View key={member.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${member.name}${member.isSelf ? "，是我" : ""}${archived ? "，已封存" : ""}`}
                accessibilityHint={open ? "收合" : "編輯這位成員"}
                onPress={() => {
                  setMessage(null);
                  setEditingId(open ? null : member.id);
                }}
                style={styles.memberRow}
              >
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: archived ? "#E6E1DA" : palette.tint },
                  ]}
                >
                  <Text
                    style={[
                      styles.avatarText,
                      { color: archived ? "#7A7066" : theme.text },
                    ]}
                  >
                    {member.name.slice(0, 1)}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.memberName,
                    { color: archived ? "#7A7066" : theme.text },
                  ]}
                >
                  {member.name}
                </Text>
                {member.isSelf && <SelfBadge size={24} />}
                {archived && <ArchivedTag />}
                <Svg
                  width={16}
                  height={16}
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke={theme.textMuted}
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
                >
                  <Path d="M4.8 7l4.3 4.1 4.2-4.2" />
                </Svg>
              </Pressable>
              {open && (
                <MemberEditor
                  member={member}
                  busy={busy}
                  onRename={(name) =>
                    run(() => renameMember(deps, member.id, name)).then(
                      (saved) => saved && setEditingId(null),
                    )
                  }
                  onToggleArchive={() =>
                    run(() =>
                      archived
                        ? unarchiveMember(deps, member.id)
                        : archiveMember(deps, member.id),
                    )
                  }
                  onRemove={() => confirmRemove(member)}
                  onToggleSelf={() =>
                    run(() =>
                      setSelfMember(
                        deps,
                        ledgerId,
                        member.isSelf ? null : member.id,
                      ),
                    )
                  }
                />
              )}
              <DashedLine dotted />
            </View>
          );
        })}
        <View style={styles.addRow}>
          <View style={styles.grow}>
            <TextField
              accessibilityLabel="新成員的名字"
              placeholder="新成員的名字"
              value={newMemberName}
              onChangeText={setNewMemberName}
              maxLength={TEXT_LIMITS.memberName}
              onSubmitEditing={saveNewMember}
              returnKeyType="done"
            />
          </View>
          <SmallButton
            title="新增"
            onPress={saveNewMember}
            disabled={busy || newMemberName.trim() === ""}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <CardTitle title="匯出" />
        <Text style={[styles.body, { color: theme.text }]}>
          把消費明細匯出成 CSV，可以用 Excel 或 Google
          試算表開啟，包含每個人分攤的新台幣金額。
        </Text>
        <Button
          title="匯出消費明細（CSV）"
          variant="secondary"
          onPress={exportCsv}
          disabled={busy || expenses.length === 0}
          icon={(color) => <ButtonIcon color={color} paths={SHEET_ICON} />}
        />
      </Card>

      <View style={styles.danger}>
        <CardTitle title="危險操作" color={theme.negative} />
        <Text style={[styles.body, { color: "#5E554C" }]}>
          刪除後，帳本裡的成員、{expenses.length} 筆消費和 {settlements.length}{" "}
          筆還款都會一起刪除，無法復原。
        </Text>
        <Button
          title="刪除這本帳本"
          onPress={confirmDeleteLedger}
          disabled={busy}
        />
      </View>
    </Screen>
  );
}

function MemberEditor({
  member,
  busy,
  onRename,
  onToggleArchive,
  onRemove,
  onToggleSelf,
}: {
  member: MemberRecord;
  busy: boolean;
  onRename: (name: string) => void;
  onToggleArchive: () => void;
  onRemove: () => void;
  onToggleSelf: () => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(member.name);
  const archived = member.archivedAt !== null;
  return (
    <View style={[styles.editor, { backgroundColor: theme.background }]}>
      <Text style={[styles.editorLabel, { color: theme.text }]}>名字</Text>
      <View style={styles.addRow}>
        <View style={styles.grow}>
          <TextField
            accessibilityLabel="名字"
            value={name}
            onChangeText={setName}
            maxLength={TEXT_LIMITS.memberName}
          />
        </View>
        <SmallButton
          title="儲存名字"
          variant="primary"
          onPress={() => onRename(name)}
          disabled={busy || name.trim() === "" || name === member.name}
        />
      </View>
      <View style={styles.toggles}>
        <SmallButton
          title={member.isSelf ? "取消設為我" : "這是我"}
          icon={<SelfBadge size={20} />}
          onPress={onToggleSelf}
          disabled={busy}
        />
        <SmallButton
          title={archived ? "取消封存" : "封存"}
          onPress={onToggleArchive}
          disabled={busy}
        />
      </View>
      <Text style={[styles.hint, { color: theme.textMuted }]}>
        {member.isSelf
          ? "「我」負擔的金額會算進個人記帳。"
          : "設為「我」之後，負擔的金額會算進個人記帳。"}
        {archived
          ? "封存中：不能加進新的消費，舊紀錄照常計算。"
          : "封存後不能再加進新的消費，舊紀錄照常計算。"}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRemove}
        disabled={busy}
        style={styles.removeLink}
      >
        <Text style={[styles.removeText, { color: theme.negative }]}>
          刪除這位成員
        </Text>
      </Pressable>
    </View>
  );
}

function DiceIcon({ color }: { color: string }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    >
      <Path d="M5.6 3.1h6.9c1.4 0 2.5 1.1 2.4 2.5l-.1 6.9c0 1.3-1.1 2.4-2.4 2.4H5.5c-1.3 0-2.4-1.1-2.4-2.4V5.6c0-1.4 1.1-2.5 2.5-2.5z" />
      <Circle cx={6.4} cy={6.4} r={0.9} fill={color} stroke="none" />
      <Circle cx={9} cy={9} r={0.9} fill={color} stroke="none" />
      <Circle cx={11.6} cy={11.6} r={0.9} fill={color} stroke="none" />
    </Svg>
  );
}

/** 匯出 CSV：折角的試算表 */
const SHEET_ICON = [
  "M6.5 3h8.1l4.1 4.1v12.7c0 .7-.5 1.1-1.1 1.1H6.5c-.7 0-1.1-.4-1.1-1.1V4.1c0-.7.4-1.1 1.1-1.1z",
  "M14.2 3.1v4.2h4.3",
  "M8.3 12h7.4M8.3 15.3h7.4M12 9.8v8.7",
];

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    gap: 18,
    paddingTop: 18,
    paddingHorizontal: 14,
    paddingBottom: 44,
  },
  card: {
    paddingVertical: 16,
  },
  coverCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  coverSide: {
    flex: 1,
    gap: 8,
  },
  coverButtons: {
    alignItems: "flex-start",
    gap: 8,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 22,
  },
  end: {
    alignItems: "flex-end",
  },
  start: {
    alignItems: "flex-start",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 54,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 16.5,
    borderBottomRightRadius: 18.7,
    borderBottomLeftRadius: 17.3,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  memberName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15.5,
  },
  editor: {
    gap: 10,
    marginLeft: 46,
    marginBottom: 14,
    padding: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 13,
  },
  editorLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  toggles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
  },
  removeLink: {
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center",
  },
  removeText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    textDecorationLine: "underline",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  grow: {
    flex: 1,
  },
  danger: {
    gap: 10,
    padding: 16,
    borderWidth: 1.6,
    borderStyle: "dashed",
    borderColor: "rgba(163,69,46,0.55)",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 16,
  },
});
