import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, View } from "react-native";

import type { MemberRecord } from "../../../domain/ledger";
import {
  Button,
  ErrorText,
  Label,
  MessageScreen,
  Row,
  Screen,
  Section,
  TextField,
} from "../../../shared/ui/components";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { useLedgerSummary } from "../hooks/useLedgerQueries";
import {
  addMember,
  deleteLedger,
  renameLedger,
  type LedgerCommandError,
} from "../services/ledgerCommands";
import {
  archiveMember,
  removeMember,
  renameMember,
  unarchiveMember,
} from "../services/memberCommands";
import type { Result } from "../../../domain/common/result";
import { describeError } from "./messages";

export function LedgerSettingsScreen({ ledgerId }: { ledgerId: string }) {
  const deps = useLedgerCommandDeps();
  const { data, error, reload } = useLedgerSummary(ledgerId);
  const [ledgerName, setLedgerName] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <MessageScreen text="讀取帳本失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;
  const { ledger, members, expenses, settlements } = data.value;

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
    if (saved) setLedgerName(null);
  }

  async function saveNewMember() {
    const saved = await run(() => addMember(deps, ledgerId, newMemberName));
    if (saved) setNewMemberName("");
  }

  async function remove(member: MemberRecord) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await removeMember(deps, member.id);
      if (result.ok) {
        setEditingId(null);
        reload();
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
            if (deleted) router.dismissTo("/ledgers");
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <Section title="帳本名稱">
        <TextField
          value={ledgerName ?? ledger.name}
          onChangeText={setLedgerName}
        />
        {ledgerName !== null && ledgerName !== ledger.name && (
          <Button title="儲存名稱" onPress={saveLedgerName} disabled={busy} />
        )}
      </Section>

      <Section title="成員（點一下可編輯）">
        {members.map((member) =>
          member.id === editingId ? (
            <MemberEditor
              key={member.id}
              member={member}
              busy={busy}
              onRename={(name) =>
                run(() => renameMember(deps, member.id, name)).then(
                  (saved) => saved && setEditingId(null),
                )
              }
              onToggleArchive={() =>
                run(() =>
                  member.archivedAt
                    ? unarchiveMember(deps, member.id)
                    : archiveMember(deps, member.id),
                )
              }
              onRemove={() => confirmRemove(member)}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <Pressable
              key={member.id}
              accessibilityRole="button"
              onPress={() => {
                setMessage(null);
                setEditingId(member.id);
              }}
            >
              <Row>
                <Label>{member.name}</Label>
                {member.archivedAt && <Label muted>已封存</Label>}
              </Row>
            </Pressable>
          ),
        )}
        <Row>
          <View style={{ flex: 1 }}>
            <TextField
              placeholder="新成員名字"
              value={newMemberName}
              onChangeText={setNewMemberName}
            />
          </View>
          <Button
            title="新增"
            variant="secondary"
            onPress={saveNewMember}
            disabled={busy || newMemberName.trim() === ""}
          />
        </Row>
      </Section>

      <ErrorText message={message} />

      <Section title="危險操作">
        <Button
          title="刪除這本帳本"
          variant="danger"
          onPress={confirmDeleteLedger}
          disabled={busy}
        />
      </Section>
    </Screen>
  );
}

function MemberEditor({
  member,
  busy,
  onRename,
  onToggleArchive,
  onRemove,
  onClose,
}: {
  member: MemberRecord;
  busy: boolean;
  onRename: (name: string) => void;
  onToggleArchive: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member.name);
  return (
    <View style={{ gap: 8, paddingVertical: 4 }}>
      <TextField label="名字" value={name} onChangeText={setName} />
      <Row>
        <View style={{ flex: 1 }}>
          <Button
            title="儲存名字"
            onPress={() => onRename(name)}
            disabled={busy || name.trim() === "" || name === member.name}
          />
        </View>
        <Button title="完成" variant="secondary" onPress={onClose} />
      </Row>
      <Button
        title={member.archivedAt ? "取消封存" : "封存（不能再加進新消費）"}
        variant="secondary"
        onPress={onToggleArchive}
        disabled={busy}
      />
      <Button
        title="刪除成員"
        variant="danger"
        onPress={onRemove}
        disabled={busy}
      />
    </View>
  );
}
