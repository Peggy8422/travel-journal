import { router } from "expo-router";
import { Pressable } from "react-native";

import {
  Button,
  ErrorText,
  Label,
  Row,
  Screen,
  Section,
} from "../../../shared/ui/components";
import { useLedgerList } from "../hooks/useLedgerQueries";

export function LedgerListScreen() {
  const { data: ledgers, error } = useLedgerList();

  return (
    <Screen>
      <Button title="建立帳本" onPress={() => router.push("/ledger/new")} />
      <ErrorText message={error ? "讀取帳本失敗" : null} />
      {ledgers && ledgers.length === 0 && (
        <Label muted>還沒有帳本，建立一本開始記帳吧。</Label>
      )}
      {ledgers && ledgers.length > 0 && (
        <Section title="我的帳本">
          {ledgers.map((ledger) => (
            <Pressable
              key={ledger.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/ledger/[id]",
                  params: { id: ledger.id },
                })
              }
            >
              <Row>
                <Label>{ledger.name}</Label>
                <Label muted>{ledger.createdAt.slice(0, 10)}</Label>
              </Row>
            </Pressable>
          ))}
        </Section>
      )}
    </Screen>
  );
}
