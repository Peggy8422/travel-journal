import { router } from "expo-router";
import { Pressable, View } from "react-native";

import {
  Button,
  ErrorText,
  Label,
  Row,
  Screen,
  Section,
} from "../../../shared/ui/components";
import { formatMinorAmount } from "../../../domain/ledger";
import { useLedgerList } from "../hooks/useLedgerQueries";
import type { LedgerOverview } from "../services/ledgerOverview";

export function LedgerListScreen() {
  const { data: overviews, error } = useLedgerList();

  return (
    <Screen>
      <Button title="建立帳本" onPress={() => router.push("/ledger/new")} />
      <Button
        title="備份與還原"
        variant="secondary"
        onPress={() => router.push("/backup")}
      />
      <ErrorText message={error ? "讀取帳本失敗" : null} />
      {overviews && overviews.length === 0 && (
        <Label muted>還沒有帳本，建立一本開始記帳吧。</Label>
      )}
      {overviews && overviews.length > 0 && (
        <Section title="我的帳本">
          {overviews.map((overview) => (
            <Pressable
              key={overview.ledger.id}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/ledger/[id]",
                  params: { id: overview.ledger.id },
                })
              }
            >
              <Row>
                {/* 名稱太長時換行，不把日期擠出畫面 */}
                <View style={{ flex: 1 }}>
                  <Label>{overview.ledger.name}</Label>
                  <Label muted>{describeOverview(overview)}</Label>
                </View>
                <Label muted>{overview.ledger.createdAt.slice(0, 10)}</Label>
              </Row>
            </Pressable>
          ))}
        </Section>
      )}
    </Screen>
  );
}

/** 例如「TWD 14,020 · 3 人 · 還有 2 筆待還款」 */
function describeOverview(overview: LedgerOverview): string {
  if (overview.kind === "invalid") return "資料有誤，請打開帳本查看";
  const base = overview.ledger.baseCurrency;
  const people = `${overview.activeMemberCount} 人`;
  if (overview.expenseCount === 0) return `${people} · 還沒有消費`;
  const total = `${base} ${formatMinorAmount(overview.totalBaseMinor, base)}`;
  const status =
    overview.pendingTransferCount === 0
      ? "已結清"
      : `還有 ${overview.pendingTransferCount} 筆待還款`;
  return `${total} · ${people} · ${status}`;
}
