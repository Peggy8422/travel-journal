import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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
import { spacing, useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { describeError } from "../../ledger/components/messages";
import { tidyCoverPhotos } from "../../ledger/services/appCoverPhotos";
import { toLocalIsoString } from "../../ledger/services/localTimestamp";
import { useLedgerChoices } from "../hooks/useJournalQueries";
import { createJournal } from "../services/journalCommands";
import {
  JournalCoverEditor,
  LedgerChoiceList,
  useJournalPhoto,
} from "./JournalFields";

/**
 * 建立手帳：封面、名稱、要不要綁一本帳本。
 * 還沒自己打過名稱時，名稱跟著選的帳本填入（改成不綁就清空），打過字之後就不再動它。
 */
export function CreateJournalScreen() {
  const theme = useTheme();
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const scroller = useFieldScroller();
  const { data: choices } = useLedgerChoices(null);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const [tape, setTape] = useState<JournalTape>("sakura");
  const photo = useJournalPhoto(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setError(null);
    if (name.trim() === "") {
      setNameError("先幫手帳取個名字");
      scroller.scrollTo("name");
      return;
    }
    setSaving(true);
    try {
      const coverPhoto = await photo.commit(deps.newId);
      const result = await createJournal(deps, {
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
      // 選過又換掉的照片在這裡清掉
      tidyCoverPhotos(deps.db);
      router.replace({
        pathname: "/journal/[id]",
        params: { id: result.value.id },
      });
      toast(`建立了「${result.value.name}」`);
    } catch {
      setError("建立失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  const follows = ledgerId !== null && !nameTouched;
  return (
    <Screen scrollRef={scroller.scrollRef} contentRef={scroller.contentRef}>
      <JournalCoverEditor
        tape={tape}
        onTape={setTape}
        photo={photo}
        title={name.trim() || "新手帳"}
        caption={toLocalIsoString(new Date()).slice(0, 7).replace("-", ".")}
      />
      <View ref={scroller.field("name")} style={styles.field}>
        <TextField
          label="手帳名稱"
          strongLabel
          placeholder="例如：一個人的台南"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setNameTouched(true);
            setNameError(null);
          }}
          maxLength={TEXT_LIMITS.journalName}
          error={nameError}
        />
        {follows && !nameError && (
          <Label muted>先用帳本的名稱，可以直接改。</Label>
        )}
      </View>
      <View ref={scroller.field("ledger")} style={styles.field}>
        <Text style={[styles.title, { color: theme.text }]}>綁定帳本</Text>
        <Label muted>
          綁定後，每篇日記會列出那天這本帳本的消費。還沒自己取名的話，名稱會先填入帳本名稱。
        </Label>
        {choices && (
          <LedgerChoiceList
            choices={choices}
            selected={ledgerId}
            onSelect={(choice) => {
              setLedgerId(choice?.ledger.id ?? null);
              setLedgerError(null);
              if (!nameTouched) {
                setName(choice?.ledger.name ?? "");
                setNameError(null);
              }
            }}
          />
        )}
        <ErrorText message={ledgerError} />
      </View>
      <ErrorText message={error} />
      <Button
        title={saving ? "建立中…" : "建立手帳"}
        onPress={submit}
        disabled={saving || photo.busy}
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
