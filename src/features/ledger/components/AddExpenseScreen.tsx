import { router } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";

import {
  parseAmountInput,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
  type ExpenseFx,
  type MemberId,
  type MemberRecord,
} from "../../../domain/ledger";
import {
  Button,
  Chip,
  ChipGroup,
  ErrorText,
  Label,
  MessageScreen,
  Row,
  Screen,
  Section,
  TextField,
} from "../../../shared/ui/components";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { useFxRateResolution } from "../hooks/useFxRateResolution";
import { useLedgerSummary } from "../hooks/useLedgerQueries";
import { expenseFxFromResolution, manualFx } from "../services/expenseFx";
import { addExpense } from "../services/ledgerCommands";
import {
  DateTimeField,
  formatDateTime,
} from "../../../shared/ui/DateTimeField";
import { toLocalIsoString } from "../services/localTimestamp";
import { describeError, describeManualReason } from "./messages";

export function AddExpenseScreen({ ledgerId }: { ledgerId: string }) {
  const { data, error } = useLedgerSummary(ledgerId);

  if (error) return <MessageScreen text="讀取帳本失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;

  const { members, expenses, ledger } = data.value;
  const active = members.filter((m) => m.archivedAt === null);
  // 預設沿用上一筆消費的幣別，出國時通常連續記同一種外幣
  const lastCurrency = expenses.at(-1)?.currency ?? ledger.baseCurrency;

  return (
    <ExpenseForm
      ledgerId={ledgerId}
      baseCurrency={ledger.baseCurrency}
      activeMembers={active}
      initialCurrency={lastCurrency}
    />
  );
}

function ExpenseForm({
  ledgerId,
  baseCurrency,
  activeMembers,
  initialCurrency,
}: {
  ledgerId: string;
  baseCurrency: CurrencyCode;
  activeMembers: readonly MemberRecord[];
  initialCurrency: CurrencyCode;
}) {
  const deps = useLedgerCommandDeps();
  // 記錄時間只用來顯示；實際存入的 createdAt 由 addExpense 在儲存當下產生
  const [openedAt] = useState(() => new Date());
  const [occurredAtDate, setOccurredAtDate] = useState(openedAt);
  // 存成選擇當下裝置時區的時間，出國時就是當地時間
  const occurredAt = toLocalIsoString(occurredAtDate);
  const [title, setTitle] = useState("");
  const [amountText, setAmountText] = useState("");
  const [currency, setCurrency] = useState(initialCurrency);
  const [payerId, setPayerId] = useState<MemberId | undefined>(
    activeMembers[0]?.id,
  );
  const [participantIds, setParticipantIds] = useState<readonly MemberId[]>(
    () => activeMembers.map((m) => m.id),
  );
  const [manualRate, setManualRate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fxState = useFxRateResolution(currency, occurredAt);
  const isForeign = currency !== baseCurrency;

  function selectCurrency(next: CurrencyCode) {
    setCurrency(next);
    setManualRate(null);
  }

  function toggleParticipant(id: MemberId) {
    setParticipantIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  /** 決定要存的匯率；回傳 undefined 代表還缺匯率 */
  function chooseFx(): ExpenseFx | null | undefined {
    if (!isForeign) return null;
    if (manualRate !== null) return manualFx(manualRate.trim());
    if (fxState.status !== "done" || !fxState.result.ok) return undefined;
    return expenseFxFromResolution(fxState.result.value);
  }

  async function submit() {
    setError(null);
    if (title.trim() === "") return setError("請輸入消費名稱");
    if (!payerId) return setError("請選擇付款人");
    const amount = parseAmountInput(amountText, currency);
    if (!amount.ok) return setError(describeError(amount.error));
    const fx = chooseFx();
    if (fx === undefined) return setError("請輸入匯率");

    setSaving(true);
    try {
      const result = await addExpense(deps, ledgerId, {
        payerId,
        amountMinor: amount.value,
        currency,
        fx,
        split: {
          kind: "equal",
          // 依成員加入順序，讓資料與顯示一致
          participantIds: activeMembers
            .map((m) => m.id)
            .filter((id) => participantIds.includes(id)),
        },
        title: title.trim(),
        note: null,
        category: null,
        placeName: null,
        location: null,
        occurredAt,
      });
      if (!result.ok) {
        setError(describeError(result.error));
        return;
      }
      router.back();
    } catch {
      setError("儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <TextField
        label="消費名稱"
        placeholder="例如：午餐拉麵"
        value={title}
        onChangeText={setTitle}
      />
      <TextField
        label={`金額（${currency}）`}
        placeholder="0"
        keyboardType="decimal-pad"
        value={amountText}
        onChangeText={setAmountText}
      />

      <Section title="時間">
        <DateTimeField
          label="消費時間"
          value={occurredAtDate}
          onChange={setOccurredAtDate}
          maximumDate={openedAt}
        />
        <Row>
          <Label muted>記錄時間</Label>
          <Label muted>{formatDateTime(openedAt)}</Label>
        </Row>
      </Section>

      <Section title="幣別">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ChipGroup>
            {SUPPORTED_CURRENCIES.map((code) => (
              <Chip
                key={code}
                label={code}
                selected={code === currency}
                onPress={() => selectCurrency(code)}
              />
            ))}
          </ChipGroup>
        </ScrollView>
      </Section>

      {isForeign && (
        <Section title="匯率">
          <FxRateInfo
            currency={currency}
            baseCurrency={baseCurrency}
            fxState={fxState}
            manualRate={manualRate}
            onManualRateChange={setManualRate}
          />
        </Section>
      )}

      <Section title="付款人">
        <ChipGroup>
          {activeMembers.map((m) => (
            <Chip
              key={m.id}
              label={m.name}
              selected={m.id === payerId}
              onPress={() => setPayerId(m.id)}
            />
          ))}
        </ChipGroup>
      </Section>

      <Section title="平均分攤給">
        <ChipGroup>
          {activeMembers.map((m) => (
            <Chip
              key={m.id}
              label={m.name}
              selected={participantIds.includes(m.id)}
              onPress={() => toggleParticipant(m.id)}
            />
          ))}
        </ChipGroup>
      </Section>

      <ErrorText message={error} />
      <Button title="儲存" onPress={submit} disabled={saving} />
    </Screen>
  );
}

function FxRateInfo({
  currency,
  baseCurrency,
  fxState,
  manualRate,
  onManualRateChange,
}: {
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  fxState: ReturnType<typeof useFxRateResolution>;
  manualRate: string | null;
  onManualRateChange: (rate: string | null) => void;
}) {
  const manualField = (
    <TextField
      label={`1 ${currency} = ? ${baseCurrency}`}
      placeholder="例如 0.2134"
      keyboardType="decimal-pad"
      value={manualRate ?? ""}
      onChangeText={onManualRateChange}
    />
  );

  if (fxState.status === "loading") {
    return <Label muted>查詢臺灣銀行匯率中…</Label>;
  }
  if (!fxState.result.ok) {
    return (
      <>
        <ErrorText message={describeError(fxState.result.error)} />
        {manualField}
      </>
    );
  }

  const resolution = fxState.result.value;
  if (resolution.status === "manual-required") {
    return (
      <>
        <Label muted>
          {describeManualReason(resolution.reason)}，請手動輸入
        </Label>
        {manualField}
      </>
    );
  }
  if (resolution.status !== "resolved") return null;

  if (manualRate !== null) {
    return (
      <>
        {manualField}
        <Button
          title={`改回臺銀匯率 ${resolution.rate}`}
          variant="secondary"
          onPress={() => onManualRateChange(null)}
        />
      </>
    );
  }
  const source = resolution.source === "bot-live" ? "" : "，離線快取";
  const basis = resolution.basis === "spot" ? "即期" : "現金";
  return (
    <>
      <Label>
        1 {currency} = {resolution.rate} {baseCurrency}
      </Label>
      <Label muted>
        臺灣銀行 {resolution.quoteDate} {basis}中價{source}
      </Label>
      <Button
        title="手動修改匯率"
        variant="secondary"
        onPress={() => onManualRateChange(resolution.rate)}
      />
    </>
  );
}
