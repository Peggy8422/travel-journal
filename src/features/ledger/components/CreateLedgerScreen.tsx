import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { randomCover, rerollCover } from "../../../domain/ledger";
import {
  Button,
  Chip,
  ChipGroup,
  ErrorText,
  Label,
  Row,
  Screen,
  Section,
  TextField,
} from "../../../shared/ui/components";
import { spacing } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { createLedger } from "../services/ledgerCommands";
import { toLocalIsoString } from "../services/localTimestamp";
import { describeCover } from "./coverStyles";
import { describeError } from "./messages";
import { NotebookCover } from "./NotebookCover";

export function CreateLedgerScreen() {
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const [name, setName] = useState("");
  const [memberNames, setMemberNames] = useState(["", ""]);
  /** 哪一個成員欄位是「我」（memberNames 的索引），null 代表不指定 */
  const [selfField, setSelfField] = useState<number | null>(null);
  // 一打開就隨機抽一個封面；之後會開放自訂
  const [cover, setCover] = useState(() => randomCover());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setMemberName = (index: number, value: string) =>
    setMemberNames((names) => names.map((n, i) => (i === index ? value : n)));

  function removeMemberField(index: number) {
    setMemberNames((names) => names.filter((_, i) => i !== index));
    // 移除的是「我」就取消；移除前面的欄位時，「我」的位置往前移
    setSelfField((field) =>
      field === null || field === index
        ? null
        : field > index
          ? field - 1
          : field,
    );
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      // 沒填的欄位直接略過，「我」要換算成略過空白後的位置
      const filled = memberNames
        .map((memberName, field) => ({ memberName, field }))
        .filter(({ memberName }) => memberName.trim() !== "");
      const selfIndex = filled.findIndex(({ field }) => field === selfField);
      const result = await createLedger(deps, {
        name,
        memberNames: filled.map(({ memberName }) => memberName),
        selfIndex: selfIndex === -1 ? undefined : selfIndex,
        cover,
      });
      if (!result.ok) {
        setError(describeError(result.error));
        return;
      }
      router.replace({
        pathname: "/ledger/[id]",
        params: { id: result.value.ledger.id },
      });
      toast(`建立了「${result.value.ledger.name}」`);
    } catch {
      setError("建立失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.coverPreview}>
        <NotebookCover
          cover={cover}
          title={name.trim() || "新的帳本"}
          caption={toLocalIsoString(new Date()).slice(0, 7).replace("-", ".")}
          width={150}
          tilt={-1}
        />
        <Label muted>{`隨機抽到：${describeCover(cover)}`}</Label>
        <View style={styles.coverActions}>
          <Button
            title="換一個封面"
            variant="secondary"
            onPress={() => setCover((current) => rerollCover(current))}
          />
          <Button
            title="自訂 · 即將推出"
            variant="secondary"
            disabled
            onPress={() => {}}
          />
        </View>
      </View>
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
                onPress={() => removeMemberField(index)}
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
      {memberNames.some((n) => n.trim() !== "") && (
        <Section title="哪一位是你？">
          <Label muted>
            指定後，你在這本帳本負擔的金額會算進「個人」分頁。也可以之後再到帳本設定指定。
          </Label>
          <ChipGroup>
            {memberNames.map((memberName, index) =>
              memberName.trim() === "" ? null : (
                <Chip
                  key={index}
                  label={memberName.trim()}
                  selected={selfField === index}
                  // 再點一次取消
                  onPress={() =>
                    setSelfField((field) => (field === index ? null : index))
                  }
                />
              ),
            )}
          </ChipGroup>
        </Section>
      )}
      <ErrorText message={error} />
      <Button title="建立" onPress={submit} disabled={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverPreview: {
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  coverActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
