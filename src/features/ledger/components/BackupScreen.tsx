import { useState } from "react";
import { Alert } from "react-native";

import {
  Button,
  ErrorText,
  Label,
  Screen,
  Section,
} from "../../../shared/ui/components";
import { useDatabase } from "../../database/DatabaseProvider";
import { pickAndRestoreBackup, shareBackup } from "../services/fileExports";
import { describeError, describeRestoreReport } from "./messages";

export function BackupScreen() {
  const db = useDatabase();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportBackup() {
    setBusy(true);
    setMessage(null);
    try {
      await shareBackup(db, new Date());
    } catch {
      setMessage("匯出失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await pickAndRestoreBackup(db);
      if (result === null) return;
      if (!result.ok) {
        setMessage(describeError(result.error));
        return;
      }
      Alert.alert("還原完成", describeRestoreReport(result.value));
    } catch {
      setMessage("讀取檔案失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Section title="備份">
        <Label muted>
          所有帳本的資料都只存在這支手機上，換手機或刪除 App
          就會消失。建議出發前和回國後各備份一次，存到雲端硬碟或傳給自己。
        </Label>
        <Label muted>備份包含所有帳本、成員、消費與還款（含已刪除的）。</Label>
        <Button title="匯出備份檔" onPress={exportBackup} disabled={busy} />
      </Section>

      <Section title="還原">
        <Label muted>
          選擇之前匯出的備份檔。手機上已經有的帳本會略過，不會被覆蓋。
        </Label>
        <Button
          title="選擇備份檔還原"
          variant="secondary"
          onPress={restore}
          disabled={busy}
        />
      </Section>

      <ErrorText message={message} />
    </Screen>
  );
}
