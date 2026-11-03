import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { JournalTape } from "../../../domain/journal";
import { TEXT_LIMITS } from "../../../domain/ledger";
import { useFieldScroller } from "../../../shared/hooks/useFieldScroller";
import {
  Button,
  ErrorText,
  Label,
  Screen,
  TextField,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { PageHeader, PageMessage } from "../../../shared/ui/PageHeader";
import { spacing, useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { describeError } from "../../ledger/components/messages";
import { tidyCoverPhotos } from "../../ledger/services/appCoverPhotos";
import { useJournal, useLedgerChoices } from "../hooks/useJournalQueries";
import {
  deleteJournal,
  updateJournal,
  type JournalDetail,
} from "../services/journalCommands";
import { journalCaption } from "../services/journalDates";
import {
  JournalCoverEditor,
  LedgerChoiceList,
  RenameSuggestion,
  useJournalPhoto,
} from "./JournalFields";

/** 手帳設定：封面、名稱、綁定的帳本一起按「儲存變更」，最下面可以刪除整本手帳 */
export function JournalSettingsScreen({ journalId }: { journalId: string }) {
  const { data, error } = useJournal(journalId);
  if (error) {
    return <PageMessage onBack={router.back} text="讀取手帳失敗" />;
  }
  if (!data) return <Screen>{null}</Screen>;
  if (!data.ok) {
    return (
      <PageMessage onBack={router.back} text={describeError(data.error)} />
    );
  }
  // 讀到之後才建立表單，欄位的初始值就是存好的設定
  return <SettingsForm detail={data.value} />;
}

function SettingsForm({ detail }: { detail: JournalDetail }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const scroller = useFieldScroller();
  const { journal, ledger: savedLedger } = detail;
  const { data: choices } = useLedgerChoices(journal.id);
  const [name, setName] = useState(journal.name);
  const [ledgerId, setLedgerId] = useState(journal.ledgerId);
  const [tape, setTape] = useState<JournalTape>(journal.cover.tape);
  const photo = useJournalPhoto(journal.cover.photo);
  const [nameError, setNameError] = useState<string | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const newLedger =
    choices?.find((c) => c.ledger.id === ledgerId)?.ledger ?? null;
  // 名稱還是原本帳本的名稱、又改綁到另一本帳本時，建議跟著改名；不按也可以直接儲存
  const suggestRename =
    savedLedger !== null &&
    newLedger !== null &&
    newLedger.id !== savedLedger.id &&
    name.trim() === savedLedger.name;
  const unchanged =
    name === journal.name &&
    ledgerId === journal.ledgerId &&
    tape === journal.cover.tape &&
    photo.pendingUri === null &&
    photo.savedName === journal.cover.photo;

  async function save() {
    setError(null);
    if (name.trim() === "") {
      setNameError("手帳名稱不能空白");
      scroller.scrollTo("name");
      return;
    }
    setBusy(true);
    try {
      const coverPhoto = await photo.commit(deps.newId);
      const result = await updateJournal(deps, journal.id, {
        name,
        ledgerId,
        cover: { tape, photo: coverPhoto },
      });
      if (!result.ok) {
        const message = describeError(result.error);
        if (result.error.code === "LEDGER_HAS_JOURNAL") {
          setLedgerError(message);
          scroller.scrollTo("ledger");
        } else if (
          result.error.code === "EMPTY_NAME" ||
          result.error.code === "TEXT_TOO_LONG"
        ) {
          setNameError(message);
          scroller.scrollTo("name");
        } else {
          setError(message);
        }
        return;
      }
      tidyCoverPhotos(deps.db);
      toast("已儲存手帳設定");
      router.back();
    } catch {
      setError("儲存失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    const count = detail.entries.length;
    Alert.alert(
      "刪除手帳",
      count > 0
        ? `「${journal.name}」和裡面的 ${count} 篇日記都會一起刪除，無法復原。`
        : `確定要刪除「${journal.name}」嗎？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => void remove(),
        },
      ],
    );
  }

  async function remove() {
    setBusy(true);
    try {
      const result = await deleteJournal(deps, journal.id);
      if (!result.ok) {
        Alert.alert("無法刪除手帳", describeError(result.error));
        return;
      }
      tidyCoverPhotos(deps.db);
      router.dismissTo("/journal");
      toast(`刪除了「${journal.name}」`);
    } catch {
      Alert.alert("無法刪除手帳", "刪除失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={
        <PageHeader onBack={router.back} kicker="Settings" title="手帳設定" />
      }
      scrollRef={scroller.scrollRef}
      contentRef={scroller.contentRef}
      contentStyle={{ paddingBottom: insets.bottom + spacing.xl }}
    >
      <JournalCoverEditor
        tape={tape}
        onTape={setTape}
        photo={photo}
        title={name.trim() || journal.name}
        caption={journalCaption(
          journal.createdAt,
          detail.firstDate,
          detail.lastDate,
        )}
      />
      <View ref={scroller.field("name")} style={styles.field}>
        <TextField
          label="手帳名稱"
          strongLabel
          value={name}
          onChangeText={(value) => {
            setName(value);
            setNameError(null);
          }}
          maxLength={TEXT_LIMITS.journalName}
          error={nameError}
        />
        {suggestRename && (
          <RenameSuggestion
            oldName={savedLedger.name}
            newName={newLedger.name}
            onAccept={() => {
              setName(newLedger.name);
              setNameError(null);
            }}
          />
        )}
      </View>
      <View ref={scroller.field("ledger")} style={styles.field}>
        <Text style={[styles.title, { color: theme.text }]}>綁定帳本</Text>
        <Label muted>改綁定只會換掉日記頁列出的消費，日記本身不會動。</Label>
        {choices && (
          <LedgerChoiceList
            choices={choices}
            selected={ledgerId}
            onSelect={(choice) => {
              setLedgerId(choice?.ledger.id ?? null);
              setLedgerError(null);
            }}
          />
        )}
        <ErrorText message={ledgerError} />
      </View>
      <ErrorText message={error} />
      <Button
        title={busy ? "處理中…" : "儲存變更"}
        onPress={save}
        disabled={busy || photo.busy || unchanged}
      />
      <Button
        title="刪除這本手帳"
        variant="danger"
        onPress={confirmDelete}
        disabled={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
});
