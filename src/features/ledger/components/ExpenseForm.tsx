import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, ScrollView, View } from "react-native";

import {
  EXPENSE_CATEGORIES,
  formatMinorAmount,
  isExpenseCategory,
  parseAmountInput,
  remainingToAllocate,
  SUPPORTED_CURRENCIES,
  TEXT_LIMITS,
  toAmountInput,
  type CurrencyCode,
  type ExpenseFx,
  type GeoPoint,
  type MemberId,
  type MemberRecord,
  type SplitRule,
} from "../../../domain/ledger";
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
import {
  DateTimeField,
  formatDateTime,
} from "../../../shared/ui/DateTimeField";
import {
  useCurrentPlace,
  type CurrentPlaceState,
} from "../hooks/useCurrentPlace";
import {
  useFxRateResolution,
  type FxRateState,
} from "../hooks/useFxRateResolution";
import {
  applyLocatedPlace,
  buildSplitRule,
  chooseExpenseFx,
  initialPlaceDraft,
  normalizeNote,
  previewRemaining,
  resolveOccurredAt,
  toPlaceFields,
  type PlaceDraft,
} from "../services/expenseFormLogic";
import type { ExpenseInput } from "../services/ledgerCommands";
import { categoryLabel } from "./categories";
import { LocationPickerModal } from "./LocationPickerModal";
import {
  describeAllocationGap,
  describeError,
  describeManualReason,
} from "./messages";

/** 表單初始值。新增時大多是空白，編輯時來自原本的消費 */
export interface ExpenseFormInitial {
  readonly title: string;
  readonly amountText: string;
  readonly currency: CurrencyCode;
  readonly payerId: MemberId | undefined;
  readonly split: SplitRule;
  readonly category: string | null;
  /** 編輯時傳入原本的消費時間；沒有修改時間就原樣保存，不換成目前裝置的時區 */
  readonly occurredAt?: string;
  /** 編輯時傳入原本的記錄時間；新增時省略，顯示開啟畫面的時間 */
  readonly recordedAt?: Date;
  /** 編輯時傳入原本的匯率；幣別與時間都沒改就沿用，不重新查詢 */
  readonly fx?: ExpenseFx | null;
  readonly placeName: string | null;
  readonly location: GeoPoint | null;
  readonly note: string | null;
}

export function ExpenseForm({
  baseCurrency,
  members,
  initial,
  notice,
  onSubmit,
  footer,
  hidePeople = false,
}: {
  baseCurrency: CurrencyCode;
  /** 可以選的成員，依加入順序 */
  members: readonly MemberRecord[];
  initial: ExpenseFormInitial;
  /** 顯示在儲存按鈕上方的提醒 */
  notice?: string;
  /** 儲存；成功回傳 null 並關閉畫面，失敗回傳要顯示的錯誤訊息 */
  onSubmit: (input: ExpenseInput) => Promise<string | null>;
  footer?: ReactNode;
  /** 個人消費：付款人與分攤固定是「我」，不顯示這兩個區塊 */
  hidePeople?: boolean;
}) {
  const [openedAt] = useState(() => new Date());
  const [occurredAtDate, setOccurredAtDate] = useState(() =>
    initial.occurredAt ? new Date(initial.occurredAt) : openedAt,
  );
  const [occurredAtTouched, setOccurredAtTouched] = useState(false);
  // 新增或改過時間時，存成選擇當下裝置時區的時間，出國時就是當地時間
  const occurredAt = resolveOccurredAt(
    initial.occurredAt,
    occurredAtTouched,
    occurredAtDate,
  );

  const [title, setTitle] = useState(initial.title);
  const [amountText, setAmountText] = useState(initial.amountText);
  const [currency, setCurrency] = useState(initial.currency);
  const [payerId, setPayerId] = useState(initial.payerId);
  const [category, setCategory] = useState(initial.category);
  const [noteText, setNoteText] = useState(initial.note ?? "");
  const [splitKind, setSplitKind] = useState(initial.split.kind);
  // 兩種分攤方式各自保留輸入，切換時不會清掉另一邊
  const [participantIds, setParticipantIds] = useState<readonly MemberId[]>(
    () =>
      initial.split.kind === "equal"
        ? initial.split.participantIds
        : members.filter((m) => m.archivedAt === null).map((m) => m.id),
  );
  const [shareTexts, setShareTexts] = useState<Record<MemberId, string>>(() =>
    initial.split.kind === "exact"
      ? Object.fromEntries(
          initial.split.shares.map((s) => [
            s.memberId,
            toAmountInput(s.amountMinor, initial.currency),
          ]),
        )
      : {},
  );
  const [storedFx, setStoredFx] = useState(
    initial.fx && initial.fx.source !== "manual" ? initial.fx : undefined,
  );
  const [manualRate, setManualRate] = useState<string | null>(
    initial.fx?.source === "manual" ? initial.fx.rateToBase : null,
  );
  const [place, setPlace] = useState(() =>
    initialPlaceDraft(initial.placeName, initial.location),
  );
  const currentPlace = useCurrentPlace();
  const [pickingPlace, setPickingPlace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isForeign = currency !== baseCurrency;
  const fxState = useFxRateResolution(
    currency,
    occurredAt,
    isForeign && storedFx === undefined,
  );

  function selectCurrency(next: CurrencyCode) {
    setCurrency(next);
    setManualRate(null);
    setStoredFx(undefined);
  }

  function changeOccurredAt(date: Date) {
    setOccurredAtDate(date);
    setOccurredAtTouched(true);
    // 時間改了，原本的臺銀報價日期可能不再適用
    setStoredFx(undefined);
  }

  function toggleParticipant(id: MemberId) {
    setParticipantIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  async function fillCurrentPlace() {
    const result = await currentPlace.locate();
    if (result?.ok) setPlace((draft) => applyLocatedPlace(draft, result.value));
  }

  async function fillPickedPlace(point: GeoPoint) {
    setPickingPlace(false);
    // Keep the point even if the name lookup is slow or fails
    setPlace((draft) => ({ ...draft, location: point }));
    const result = await currentPlace.describe(point);
    if (result?.ok) setPlace((draft) => applyLocatedPlace(draft, result.value));
  }

  async function submit() {
    setError(null);
    if (title.trim() === "") return setError("請輸入消費名稱");
    if (!payerId) return setError("請選擇付款人");
    const amount = parseAmountInput(amountText, currency);
    if (!amount.ok) return setError(describeError(amount.error));
    const fx = chooseExpenseFx({
      isForeign,
      manualRate,
      storedFx,
      resolution: fxState.status === "done" ? fxState.result : undefined,
    });
    if (fx === undefined) return setError("請輸入匯率");
    const memberOrder = members.map((m) => m.id);
    const split = buildSplitRule(
      splitKind === "equal"
        ? { kind: "equal", participantIds }
        : { kind: "exact", shareTexts },
      memberOrder,
      currency,
    );
    if (!split.ok) return setError(describeError(split.error));
    if (split.value.kind === "exact") {
      const gap = describeAllocationGap(
        remainingToAllocate(amount.value, split.value.shares),
        currency,
      );
      if (gap) {
        Alert.alert("分攤金額不符", gap);
        return;
      }
    }

    setSaving(true);
    try {
      const failure = await onSubmit({
        payerId,
        amountMinor: amount.value,
        currency,
        fx,
        split: split.value,
        title: title.trim(),
        note: normalizeNote(noteText),
        ...toPlaceFields(place),
        category,
        occurredAt,
      });
      if (failure) {
        setError(failure);
        return;
      }
      router.back();
    } catch {
      setError("儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  const memberLabel = (m: MemberRecord) =>
    m.archivedAt ? `${m.name}（已封存）` : m.name;
  // 清單以外的舊分類（例如早期的自由文字）也要能看到並保留
  const categoryOptions: readonly string[] =
    category !== null && !isExpenseCategory(category)
      ? [...EXPENSE_CATEGORIES, category]
      : EXPENSE_CATEGORIES;
  const remaining =
    splitKind === "exact"
      ? previewRemaining(
          amountText,
          shareTexts,
          members.map((m) => m.id),
          currency,
        )
      : undefined;

  return (
    <Screen>
      <TextField
        label="消費名稱"
        placeholder="例如：午餐拉麵"
        value={title}
        onChangeText={setTitle}
        maxLength={TEXT_LIMITS.expenseTitle}
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
          onChange={changeOccurredAt}
          maximumDate={openedAt}
        />
        <Row>
          <Label muted>記錄時間</Label>
          <Label muted>{formatDateTime(initial.recordedAt ?? openedAt)}</Label>
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
            storedFx={storedFx}
            onRequery={() => setStoredFx(undefined)}
            manualRate={manualRate}
            onManualRateChange={setManualRate}
          />
        </Section>
      )}

      {!hidePeople && (
        <>
          <Section title="付款人">
            <ChipGroup>
              {members.map((m) => (
                <Chip
                  key={m.id}
                  label={memberLabel(m)}
                  selected={m.id === payerId}
                  onPress={() => setPayerId(m.id)}
                />
              ))}
            </ChipGroup>
          </Section>

          <Section title="分攤方式">
            <ChipGroup>
              <Chip
                label="平均分攤"
                selected={splitKind === "equal"}
                onPress={() => setSplitKind("equal")}
              />
              <Chip
                label="指定金額"
                selected={splitKind === "exact"}
                onPress={() => setSplitKind("exact")}
              />
            </ChipGroup>
            {splitKind === "equal" ? (
              <ChipGroup>
                {members.map((m) => (
                  <Chip
                    key={m.id}
                    label={memberLabel(m)}
                    selected={participantIds.includes(m.id)}
                    onPress={() => toggleParticipant(m.id)}
                  />
                ))}
              </ChipGroup>
            ) : (
              <>
                {members.map((m) => (
                  <Row key={m.id}>
                    <View style={{ flex: 1 }}>
                      <Label>{memberLabel(m)}</Label>
                    </View>
                    <TextField
                      placeholder="不分攤"
                      keyboardType="decimal-pad"
                      value={shareTexts[m.id] ?? ""}
                      onChangeText={(text) =>
                        setShareTexts((texts) => ({ ...texts, [m.id]: text }))
                      }
                      style={{ width: 120, textAlign: "right" }}
                    />
                  </Row>
                ))}
                <RemainingLabel remaining={remaining} currency={currency} />
              </>
            )}
          </Section>
        </>
      )}

      <Section title="分類">
        <ChipGroup>
          {categoryOptions.map((code) => (
            <Chip
              key={code}
              label={categoryLabel(code)}
              selected={code === category}
              // 再點一次取消，變回未分類
              onPress={() => setCategory(code === category ? null : code)}
            />
          ))}
        </ChipGroup>
      </Section>

      <Section title="地點">
        <PlaceFields
          place={place}
          onChangeName={(placeName) =>
            setPlace((draft) => ({ ...draft, placeName }))
          }
          onClear={() => setPlace(initialPlaceDraft(null, null))}
          locateState={currentPlace.state}
          onLocate={fillCurrentPlace}
          onPickOnMap={() => setPickingPlace(true)}
        />
        <LocationPickerModal
          visible={pickingPlace}
          initialPoint={place.location}
          loadStartPoint={currentPlace.startPoint}
          onCancel={() => setPickingPlace(false)}
          onConfirm={fillPickedPlace}
        />
      </Section>

      <TextField
        label="備註"
        placeholder="例如：誰沒吃甜點、收據放在誰那裡"
        value={noteText}
        onChangeText={setNoteText}
        maxLength={TEXT_LIMITS.note}
        multiline
        style={{ minHeight: 72, textAlignVertical: "top" }}
      />

      {notice && <Label muted>{notice}</Label>}
      <ErrorText message={error} />
      <Button title="儲存" onPress={submit} disabled={saving} />
      {footer}
    </Screen>
  );
}

function PlaceFields({
  place,
  onChangeName,
  onClear,
  locateState,
  onLocate,
  onPickOnMap,
}: {
  place: PlaceDraft;
  onChangeName: (name: string) => void;
  onClear: () => void;
  locateState: CurrentPlaceState;
  onLocate: () => void;
  onPickOnMap: () => void;
}) {
  const locating = locateState.status === "locating";
  const located =
    locateState.status === "done" && locateState.result.ok
      ? locateState.result.value
      : undefined;

  return (
    <>
      <TextField
        label="地名"
        placeholder="例如：一蘭 渋谷店"
        value={place.placeName}
        onChangeText={onChangeName}
        maxLength={TEXT_LIMITS.placeName}
      />
      {place.location ? (
        <Label muted>
          已記錄座標 {place.location.latitude.toFixed(5)},{" "}
          {place.location.longitude.toFixed(5)}
        </Label>
      ) : (
        <Label muted>記錄座標後，這筆消費會出現在地圖上</Label>
      )}
      {locating && <Label muted>取得地點中…</Label>}
      {locateState.status === "done" && !locateState.result.ok && (
        <ErrorText message={describeError(locateState.result.error)} />
      )}
      {located?.approximate && (
        <Label muted>目前無法精確定位，使用的是最近一次的位置</Label>
      )}
      {located?.placeNameLookupFailed && (
        <Label muted>查不到地名（可能沒有網路），請自行輸入</Label>
      )}
      <Button
        title={place.location ? "重新定位" : "使用目前位置"}
        variant="secondary"
        onPress={onLocate}
        disabled={locating}
      />
      <Button
        title={place.location ? "在地圖上調整" : "在地圖上選擇"}
        variant="secondary"
        onPress={onPickOnMap}
        disabled={locating}
      />
      {(place.location !== null || place.placeName !== "") && (
        <Button title="清除地點" variant="secondary" onPress={onClear} />
      )}
    </>
  );
}

function RemainingLabel({
  remaining,
  currency,
}: {
  remaining: number | undefined;
  currency: CurrencyCode;
}) {
  if (remaining === undefined) {
    return <Label muted>輸入總金額與每人金額後，會顯示還剩多少沒分配</Label>;
  }
  if (remaining === 0) return <Label muted>已全部分配</Label>;
  const amount = `${currency} ${formatMinorAmount(Math.abs(remaining), currency)}`;
  return (
    <ErrorText
      message={remaining > 0 ? `還剩 ${amount} 沒分配` : `超出 ${amount}`}
    />
  );
}

function FxRateInfo({
  currency,
  baseCurrency,
  fxState,
  storedFx,
  onRequery,
  manualRate,
  onManualRateChange,
}: {
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  fxState: FxRateState;
  /** 編輯時沿用的臺銀匯率 */
  storedFx: (ExpenseFx & { source: "bot-live" | "bot-cached" }) | undefined;
  onRequery: () => void;
  manualRate: string | null;
  onManualRateChange: (rate: string | null) => void;
}) {
  // 按「手動修改匯率」才自動聚焦；查詢失敗時直接出現的欄位不搶焦點，免得一打開表單就跳鍵盤
  const [focusManual, setFocusManual] = useState(false);
  const editManually = (rate: string) => {
    setFocusManual(true);
    onManualRateChange(rate);
  };
  const manualField = (
    <TextField
      label={`1 ${currency} = ? ${baseCurrency}`}
      placeholder="例如 0.2134"
      keyboardType="decimal-pad"
      value={manualRate ?? ""}
      onChangeText={onManualRateChange}
      autoFocus={focusManual}
    />
  );

  // 可以「改回」的臺銀匯率：編輯時原本存的，或這次查到的
  const resolved =
    fxState.status === "done" &&
    fxState.result.ok &&
    fxState.result.value.status === "resolved"
      ? fxState.result.value
      : undefined;
  const botRate = storedFx?.rateToBase ?? resolved?.rate;

  if (manualRate !== null) {
    return (
      <>
        {manualField}
        {botRate !== undefined && (
          <Button
            title={`改回臺銀匯率 ${botRate}`}
            variant="secondary"
            onPress={() => {
              setFocusManual(false);
              onManualRateChange(null);
            }}
          />
        )}
      </>
    );
  }

  if (storedFx) {
    return (
      <>
        <BotRateText
          currency={currency}
          baseCurrency={baseCurrency}
          rate={storedFx.rateToBase}
          detail={`臺灣銀行 ${storedFx.quoteDate} ${basisLabel(storedFx.basis)}中價（原本的匯率）`}
        />
        <Button
          title="手動修改匯率"
          variant="secondary"
          keepKeyboard
          onPress={() => editManually(storedFx.rateToBase)}
        />
        <Button
          title="重新查詢臺銀匯率"
          variant="secondary"
          onPress={onRequery}
        />
      </>
    );
  }

  if (fxState.status === "idle" || fxState.status === "loading") {
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

  const source = resolution.source === "bot-live" ? "" : "，離線快取";
  return (
    <>
      <BotRateText
        currency={currency}
        baseCurrency={baseCurrency}
        rate={resolution.rate}
        detail={`臺灣銀行 ${resolution.quoteDate} ${basisLabel(resolution.basis)}中價${source}`}
      />
      <Button
        title="手動修改匯率"
        variant="secondary"
        keepKeyboard
        onPress={() => editManually(resolution.rate)}
      />
    </>
  );
}

function BotRateText({
  currency,
  baseCurrency,
  rate,
  detail,
}: {
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  rate: string;
  detail: string;
}) {
  return (
    <>
      <Label>
        1 {currency} = {rate} {baseCurrency}
      </Label>
      <Label muted>{detail}</Label>
    </>
  );
}

function basisLabel(basis: "spot" | "cash"): string {
  return basis === "spot" ? "即期" : "現金";
}
