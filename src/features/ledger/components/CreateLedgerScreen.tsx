import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import {
  Button,
  ErrorText,
  Row,
  Screen,
  Section,
  TextField,
} from "../../../shared/ui/components";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { createLedger } from "../services/ledgerCommands";
import { describeError } from "./messages";

export function CreateLedgerScreen() {
  const deps = useLedgerCommandDeps();
  const [name, setName] = useState("");
  const [memberNames, setMemberNames] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setMemberName = (index: number, value: string) =>
    setMemberNames((names) => names.map((n, i) => (i === index ? value : n)));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const result = await createLedger(deps, {
        name,
        // 沒填的欄位直接略過
        memberNames: memberNames.filter((n) => n.trim() !== ""),
      });
      if (!result.ok) {
        setError(describeError(result.error));
        return;
      }
      router.replace({
        pathname: "/ledger/[id]",
        params: { id: result.value.ledger.id },
      });
    } catch {
      setError("建立失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TextField
        label="帳本名稱"
        placeholder="例如：東京五日遊"
        value={name}
        onChangeText={setName}
      />
      <Section title="成員（依加入順序）">
        {memberNames.map((memberName, index) => (
          <Row key={index}>
            <View style={{ flex: 1 }}>
              <TextField
                placeholder={`成員 ${index + 1}`}
                value={memberName}
                onChangeText={(value) => setMemberName(index, value)}
              />
            </View>
            {memberNames.length > 1 && (
              <Button
                title="移除"
                variant="secondary"
                onPress={() =>
                  setMemberNames((names) => names.filter((_, i) => i !== index))
                }
              />
            )}
          </Row>
        ))}
        <Button
          title="新增成員"
          variant="secondary"
          onPress={() => setMemberNames((names) => [...names, ""])}
        />
      </Section>
      <ErrorText message={error} />
      <Button title="建立" onPress={submit} disabled={saving} />
    </Screen>
  );
}
