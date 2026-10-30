import { router, Stack } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

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
import { useFieldScroller } from "../../../shared/hooks/useFieldScroller";
import {
  Button,
  Chip,
  ErrorText,
  Label,
  Screen,
  SmallButton,
  TextButton,
  TextField,
} from "../../../shared/ui/components";
import {
  DateTimeField,
  formatDateTime,
} from "../../../shared/ui/DateTimeField";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { DashedLine, ReceiptPaper } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
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
  perHeadRange,
  previewBaseAmount,
  previewRemaining,
  resolveOccurredAt,
  toPlaceFields,
  type PlaceDraft,
} from "../services/expenseFormLogic";
import type { ExpenseInput } from "../services/ledgerCommands";
import { categoryLabel } from "./categories";
import { CategoryIcon } from "./CategoryIcon";
import { currencyLabel } from "./currencies";
import { basisLabel } from "./fxLabels";
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

/**
 * 新增／編輯消費（帳本與個人記帳共用），整張畫成一張收據：
 * 上面是金額與名稱，中間是時間、分類、分攤，下面是地點、備註與合計。
 * 導覽列左右放「取消」「儲存」，收據下方也有一顆儲存。
 */
export function ExpenseForm({
  baseCurrency,
  members,
  initial,
  receiptTitle,
  notice,
  onSubmit,
  footer,
  hidePeople = false,
}: {
  baseCurrency: CurrencyCode;
  /** 可以選的成員，依加入順序 */
  members: readonly MemberRecord[];
  initial: ExpenseFormInitial;
  /** 收據抬頭下的小字，例如帳本名稱 */
  receiptTitle: string;
  /** 顯示在儲存按鈕上方的提醒 */
  notice?: string;
  /** 儲存；成功回傳 null 並關閉畫面，失敗回傳要顯示的錯誤訊息 */
  onSubmit: (input: ExpenseInput) => Promise<string | null>;
  footer?: ReactNode;
  /** 個人消費：付款人與分攤固定是「我」，不顯示這兩個區塊 */
  hidePeople?: boolean;
}) {
  const theme = useTheme();
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
  const [choosingCurrency, setChoosingCurrency] = useState(false);
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
  /** 欄位自己的錯誤，寫在那一欄下面；儲存時有錯會把那一欄捲進畫面 */
  const [fieldError, setFieldError] = useState<{
    field: FormField;
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const scroller = useFieldScroller();
  const errorFor = (field: FormField) =>
    fieldError?.field === field ? fieldError.message : null;
  /** 改了那一欄就收起它的錯誤 */
  const clearError = (field: FormField) =>
    setFieldError((current) => (current?.field === field ? null : current));

  const isForeign = currency !== baseCurrency;
  const fxState = useFxRateResolution(
    currency,
    occurredAt,
    isForeign && storedFx === undefined,
  );
  const fx = chooseExpenseFx({
    isForeign,
    manualRate,
    storedFx,
    resolution: fxState.status === "done" ? fxState.result : undefined,
  });

  function selectCurrency(next: CurrencyCode) {
    setCurrency(next);
    setChoosingCurrency(false);
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
    clearError("split");
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

  function fail(field: FormField, message: string) {
    setFieldError({ field, message });
    scroller.scrollTo(field);
  }

  async function submit() {
    Keyboard.dismiss();
    setFieldError(null);
    // 依畫面由上到下檢查，捲過去的是最上面那個有錯的欄位
    const amount = parseAmountInput(amountText, currency);
    if (!amount.ok) return fail("amount", describeError(amount.error));
    if (fx === undefined) return fail("fx", "請輸入匯率");
    if (title.trim() === "") return fail("title", "請輸入消費名稱");
    if (!payerId) return fail("payer", "請選擇付款人");
    const memberOrder = members.map((m) => m.id);
    const split = buildSplitRule(
      splitKind === "equal"
        ? { kind: "equal", participantIds }
        : { kind: "exact", shareTexts },
      memberOrder,
      currency,
    );
    if (!split.ok) return fail("split", describeError(split.error));
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
      // 不屬於某一欄的錯誤用彈窗：「儲存」在頁首，寫在頁尾會看不到
      if (failure) {
        Alert.alert("無法儲存", failure);
        return;
      }
      router.back();
    } catch {
      Alert.alert("無法儲存", "儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  const money = (minor: number, code: CurrencyCode) =>
    `${code} ${formatMinorAmount(minor, code)}`;
  const memberLabel = (m: MemberRecord) =>
    `${m.name}${m.isSelf ? "（我）" : ""}${m.archivedAt ? "（已封存）" : ""}`;
  // 清單以外的舊分類（例如早期的自由文字）也要能看到並保留
  const categoryOptions: readonly string[] =
    category !== null && !isExpenseCategory(category)
      ? [...EXPENSE_CATEGORIES, category]
      : EXPENSE_CATEGORIES;
  const amount = parseAmountInput(amountText, currency);
  const baseTotal = previewBaseAmount(amountText, currency, baseCurrency, fx);
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
    <Screen
      contentStyle={styles.content}
      scrollRef={scroller.scrollRef}
      contentRef={scroller.contentRef}
    >
      <Stack.Screen
        options={{
          headerLeft: () => (
            <HeaderAction title="取消" onPress={() => router.back()} />
          ),
          headerRight: () => (
            <HeaderAction
              title="儲存"
              strong
              disabled={saving}
              onPress={submit}
            />
          ),
        }}
      />

      <ReceiptPaper style={styles.receipt}>
        <View style={styles.receiptHead}>
          <Text style={[styles.receiptKicker, { color: theme.textMuted }]}>
            RECEIPT
          </Text>
          <Text style={[styles.receiptTitle, { color: "#5E554C" }]}>
            {receiptTitle}
          </Text>
        </View>
        <DashedLine opacity={0.3} />

        <View ref={scroller.field("amount")} style={styles.block}>
          <FieldLabel>金額</FieldLabel>
          <View style={styles.amountRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`幣別：${currencyLabel(currency)}，點一下更換`}
              accessibilityState={{ expanded: choosingCurrency }}
              onPress={() => setChoosingCurrency((open) => !open)}
              style={[styles.currency, { backgroundColor: theme.background }]}
            >
              <Text style={[styles.currencyText, { color: theme.text }]}>
                {currency}
              </Text>
              <Chevron color={theme.text} up={choosingCurrency} />
            </Pressable>
            <View style={styles.grow}>
              <TextField
                accessibilityLabel={`金額（${currency}）`}
                placeholder="0"
                keyboardType="decimal-pad"
                value={amountText}
                onChangeText={(text) => {
                  setAmountText(text);
                  clearError("amount");
                }}
                style={[styles.amountInput, { borderColor: theme.text }]}
                error={errorFor("amount")}
              />
            </View>
          </View>
          {choosingCurrency && (
            <View style={styles.wrap}>
              {SUPPORTED_CURRENCIES.map((code) => (
                <Chip
                  key={code}
                  label={currencyLabel(code)}
                  selected={code === currency}
                  onPress={() => selectCurrency(code)}
                />
              ))}
            </View>
          )}
          {isForeign && (
            <View
              ref={scroller.field("fx")}
              style={[styles.fxBox, { backgroundColor: theme.background }]}
            >
              {baseTotal !== undefined && (
                <Text style={[styles.converted, { color: theme.text }]}>
                  ≈ {money(baseTotal, baseCurrency)}
                </Text>
              )}
              <FxRateInfo
                currency={currency}
                baseCurrency={baseCurrency}
                fxState={fxState}
                storedFx={storedFx}
                onRequery={() => setStoredFx(undefined)}
                manualRate={manualRate}
                onManualRateChange={(rate) => {
                  setManualRate(rate);
                  clearError("fx");
                }}
              />
              <ErrorText message={errorFor("fx")} />
            </View>
          )}
        </View>

        <View ref={scroller.field("title")}>
          <TextField
            label="消費名稱"
            strongLabel
            placeholder="例如：午餐拉麵"
            value={title}
            onChangeText={(text) => {
              setTitle(text);
              clearError("title");
            }}
            maxLength={TEXT_LIMITS.expenseTitle}
            error={errorFor("title")}
          />
        </View>

        <DashedLine opacity={0.3} />
        <View style={styles.tight}>
          <DateTimeField
            label="消費時間"
            strongLabel
            value={occurredAtDate}
            onChange={changeOccurredAt}
            maximumDate={openedAt}
          />
          <Text style={[styles.small, { color: theme.textMuted }]}>
            記錄時間 {formatDateTime(initial.recordedAt ?? openedAt)}
          </Text>
        </View>

        <View style={styles.block}>
          <FieldLabel>分類</FieldLabel>
          <View style={styles.categories}>
            {categoryOptions.map((code) => {
              const selected = code === category;
              const label = categoryLabel(code);
              return (
                <Pressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  // 再點一次取消，變回未分類
                  onPress={() => setCategory(selected ? null : code)}
                  style={styles.categoryCell}
                >
                  <CategoryIcon
                    category={code}
                    size={38}
                    background={selected ? undefined : theme.background}
                    ring={selected}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.categoryLabel,
                      {
                        color: theme.text,
                        fontFamily: selected ? fonts.bold : fonts.regular,
                      },
                    ]}
                  >
                    {/* 格子窄，清單內的分類只寫前兩個字（門票娛樂 → 門票） */}
                    {isExpenseCategory(code) ? label.slice(0, 2) : label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!hidePeople && (
          <>
            <DashedLine opacity={0.3} />
            <View ref={scroller.field("payer")} style={styles.block}>
              <FieldLabel>付款人</FieldLabel>
              <View style={styles.wrap}>
                {members.map((m) => (
                  <Chip
                    key={m.id}
                    label={memberLabel(m)}
                    selected={m.id === payerId}
                    onPress={() => {
                      setPayerId(m.id);
                      clearError("payer");
                    }}
                  />
                ))}
              </View>
              <ErrorText message={errorFor("payer")} />
            </View>
            <View ref={scroller.field("split")} style={styles.block}>
              <FieldLabel>分攤方式</FieldLabel>
              <View
                style={[styles.segments, { backgroundColor: theme.background }]}
              >
                <Segment
                  title="平均分攤"
                  selected={splitKind === "equal"}
                  onPress={() => {
                    setSplitKind("equal");
                    clearError("split");
                  }}
                />
                <Segment
                  title="指定金額"
                  selected={splitKind === "exact"}
                  onPress={() => {
                    setSplitKind("exact");
                    clearError("split");
                  }}
                />
              </View>
              {splitKind === "equal" ? (
                <>
                  <View style={styles.wrap}>
                    {members.map((m) => (
                      <CheckPill
                        key={m.id}
                        label={memberLabel(m)}
                        checked={participantIds.includes(m.id)}
                        onPress={() => toggleParticipant(m.id)}
                      />
                    ))}
                  </View>
                  <Text style={[styles.hint, { color: "#5E554C" }]}>
                    {perHeadText({
                      count: participantIds.length,
                      totalMinor: amount.ok ? amount.value : undefined,
                      currency,
                      baseTotal: isForeign ? baseTotal : undefined,
                      baseCurrency,
                    })}
                  </Text>
                </>
              ) : (
                <>
                  {members.map((m) => (
                    <View key={m.id} style={styles.shareRow}>
                      <Text
                        numberOfLines={1}
                        style={[styles.shareName, { color: theme.text }]}
                      >
                        {memberLabel(m)}
                      </Text>
                      <TextField
                        accessibilityLabel={`${m.name} 分攤的金額`}
                        placeholder="不分攤"
                        keyboardType="decimal-pad"
                        value={shareTexts[m.id] ?? ""}
                        onChangeText={(text) => {
                          setShareTexts((texts) => ({
                            ...texts,
                            [m.id]: text,
                          }));
                          clearError("split");
                        }}
                        style={styles.shareInput}
                      />
                    </View>
                  ))}
                  <RemainingLabel remaining={remaining} currency={currency} />
                </>
              )}
              <ErrorText message={errorFor("split")} />
            </View>
          </>
        )}

        <DashedLine opacity={0.3} />
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

        <TextField
          label="備註"
          strongLabel
          placeholder="例如：誰沒吃甜點、收據放在誰那裡"
          value={noteText}
          onChangeText={setNoteText}
          maxLength={TEXT_LIMITS.note}
          multiline
          style={styles.note}
        />

        {/* 收據的合計：上面一條雙線 */}
        <View style={styles.totalRule} />
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: theme.text }]}>合計</Text>
          <View style={styles.totalSide}>
            <Text style={[styles.total, { color: theme.text }]}>
              {amount.ok ? money(amount.value, currency) : `${currency} —`}
            </Text>
            {isForeign && baseTotal !== undefined && (
              <Text style={[styles.small, { color: theme.textMuted }]}>
                ≈ {money(baseTotal, baseCurrency)}
              </Text>
            )}
          </View>
        </View>
      </ReceiptPaper>

      {notice && <Label muted>{notice}</Label>}
      <Button title="儲存" onPress={submit} disabled={saving} />
      {footer}
    </Screen>
  );
}

/** 儲存前檢查、錯誤寫在欄位下面的欄位 */
type FormField = "amount" | "fx" | "title" | "payer" | "split";

/** 「每人 JPY 1,000（≈ TWD 210）」；除不盡時寫成範圍，例如 333～334 */
function perHeadText({
  count,
  totalMinor,
  currency,
  baseTotal,
  baseCurrency,
}: {
  count: number;
  totalMinor: number | undefined;
  currency: CurrencyCode;
  baseTotal: number | undefined;
  baseCurrency: CurrencyCode;
}): string {
  if (count === 0) return "至少要選一個人分攤";
  if (totalMinor === undefined) return "輸入金額後會顯示每人分攤多少";
  const format = (total: number, code: CurrencyCode) => {
    const range = perHeadRange(total, count);
    if (!range) return "";
    const min = formatMinorAmount(range.min, code);
    return range.min === range.max
      ? `${code} ${min}`
      : `${code} ${min}～${formatMinorAmount(range.max, code)}`;
  };
  const converted =
    baseTotal === undefined ? "" : `（≈ ${format(baseTotal, baseCurrency)}）`;
  return `每人 ${format(totalMinor, currency)}${converted}`;
}

function FieldLabel({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text style={[styles.fieldLabel, { color: theme.text }]}>{children}</Text>
  );
}

/** 導覽列左右的文字按鈕（取消、儲存） */
function HeaderAction({
  title,
  onPress,
  strong = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  strong?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? 0.6 : 1,
        paddingHorizontal: 4,
      })}
    >
      <Text
        style={[
          styles.headerAction,
          strong
            ? { color: theme.primary, fontFamily: fonts.bold }
            : { color: "#5E554C" },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** 分攤方式的兩段切換：選中的那段是白紙加細框 */
function Segment({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.segment, selected && styles.segmentSelected]}
    >
      <Text
        style={[
          styles.segmentText,
          {
            color: theme.text,
            fontFamily: selected ? fonts.bold : fonts.regular,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** 參與平均分攤的人：前面一個手繪方框，勾選時打朱色的勾 */
function CheckPill({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[styles.pill, checked ? styles.pillOn : styles.pillOff]}
    >
      <View style={styles.checkbox}>
        {checked && (
          <Svg
            width={12}
            height={12}
            viewBox="0 0 16 16"
            fill="none"
            stroke={theme.primary}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M3 8.6l3.2 3.1 6.8-7.4" />
          </Svg>
        )}
      </View>
      <Text style={[styles.pillText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

function Chevron({ color, up }: { color: string; up: boolean }) {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 18 18"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={up ? { transform: [{ rotate: "180deg" }] } : undefined}
    >
      <Path d="M4.8 7l4.3 4.1 4.2-4.2" />
    </Svg>
  );
}

function PinIcon({ color }: { color: string }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 18 18"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9 16.2c-3-3.3-4.6-5.8-4.6-8A4.6 4.6 0 0 1 9 3.6a4.6 4.6 0 0 1 4.6 4.6c0 2.2-1.6 4.7-4.6 8z" />
      <Circle cx={9} cy={8.2} r={1.6} />
    </Svg>
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
  const theme = useTheme();
  const locating = locateState.status === "locating";
  const located =
    locateState.status === "done" && locateState.result.ok
      ? locateState.result.value
      : undefined;

  return (
    <View style={styles.block}>
      <TextField
        label="地點"
        strongLabel
        placeholder="例如：一蘭 渋谷店"
        value={place.placeName}
        onChangeText={onChangeName}
        maxLength={TEXT_LIMITS.placeName}
      />
      {place.location ? (
        <View style={styles.located}>
          <PinIcon color={LOCATED} />
          <Text style={[styles.small, { color: LOCATED }]}>
            已記錄座標，這筆消費會出現在地圖上
          </Text>
        </View>
      ) : (
        <Text style={[styles.small, { color: theme.textMuted }]}>
          記錄座標後，這筆消費會出現在地圖上
        </Text>
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
      <View style={styles.wrap}>
        <SmallButton
          title={place.location ? "重新定位" : "使用目前位置"}
          icon={<PinIcon color={theme.text} />}
          onPress={onLocate}
          disabled={locating}
        />
        <SmallButton
          title={place.location ? "在地圖上調整" : "在地圖上選擇"}
          onPress={onPickOnMap}
          disabled={locating}
        />
        {(place.location !== null || place.placeName !== "") && (
          <SmallButton title="清除地點" onPress={onClear} />
        )}
      </View>
    </View>
  );
}

function RemainingLabel({
  remaining,
  currency,
}: {
  remaining: number | undefined;
  currency: CurrencyCode;
}) {
  const theme = useTheme();
  if (remaining === undefined) {
    return (
      <Text style={[styles.hint, { color: "#5E554C" }]}>
        輸入總金額與每人金額後，會顯示還剩多少沒分配
      </Text>
    );
  }
  if (remaining === 0) {
    return <Text style={[styles.hint, { color: "#5E554C" }]}>已全部分配</Text>;
  }
  const amount = `${currency} ${formatMinorAmount(Math.abs(remaining), currency)}`;
  return (
    <Text style={[styles.hint, { color: theme.negative }]}>
      {remaining > 0 ? `還剩 ${amount} 沒分配` : `超出 ${amount}`}
    </Text>
  );
}

/** 外幣時收據裡的匯率小框：臺銀匯率、查詢狀態，或手動輸入的匯率 */
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
          <TextButton
            title={`改回臺銀匯率 ${botRate}`}
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
        <View style={styles.links}>
          <TextButton
            title="手動修改匯率"
            keepKeyboard
            onPress={() => editManually(storedFx.rateToBase)}
          />
          <TextButton title="重新查詢臺銀匯率" onPress={onRequery} />
        </View>
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
      <TextButton
        title="手動修改匯率"
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
    <Text style={[styles.fxText, { color: "#5E554C" }]}>
      1 {currency} = {rate} {baseCurrency}
      {"\n"}
      {detail}
    </Text>
  );
}

/** 已記錄座標的提示色（若竹深色），在收據紙上約 5:1 */
const LOCATED = "#3F6E62";

const styles = StyleSheet.create({
  content: {
    gap: 12,
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 40,
  },
  receipt: {
    gap: 16,
    paddingTop: 26,
    paddingBottom: 30,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  receiptHead: {
    alignItems: "center",
    gap: 2,
    paddingBottom: 2,
  },
  receiptKicker: {
    fontFamily: fonts.accent,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 2,
    paddingRight: accentOverhang(22),
  },
  receiptTitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  block: {
    gap: 8,
  },
  tight: {
    gap: 2,
  },
  grow: {
    flex: 1,
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  currency: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 10,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 21,
    borderBottomLeftRadius: 19,
  },
  currencyText: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  amountInput: {
    minHeight: 52,
    borderBottomWidth: 1.8,
    fontFamily: fonts.bold,
    fontSize: 32,
    textAlign: "right",
  },
  fxBox: {
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 13,
  },
  converted: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  fxText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 20,
  },
  links: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  categoryCell: {
    width: "16.66%",
    alignItems: "center",
    gap: 3,
    minHeight: 60,
    paddingVertical: 4,
  },
  categoryLabel: {
    fontSize: 11.5,
  },
  segments: {
    flexDirection: "row",
    gap: 3,
    padding: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 13,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 11,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 12,
    borderBottomLeftRadius: 10,
  },
  segmentSelected: {
    backgroundColor: "#FFFDF8",
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.45)",
  },
  segmentText: {
    fontSize: 14,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 40,
    paddingLeft: 10,
    paddingRight: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 17,
    borderBottomRightRadius: 19,
    borderBottomLeftRadius: 18,
  },
  pillOn: {
    backgroundColor: "#FFFDF8",
    boxShadow: "0px 0px 0px 1.3px rgba(58,51,45,0.6)",
  },
  pillOff: {
    boxShadow: "inset 0px 0px 0px 1.2px rgba(58,51,45,0.3)",
  },
  checkbox: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.4,
    borderColor: "rgba(58,51,45,0.7)",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 6,
  },
  pillText: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  shareName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  shareInput: {
    width: 120,
    minHeight: 40,
    fontSize: 15,
    textAlign: "right",
  },
  located: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  note: {
    minHeight: 72,
    fontSize: 15,
    textAlignVertical: "top",
  },
  totalRule: {
    height: 4,
    marginTop: 2,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(58,51,45,0.5)",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: -6,
  },
  totalLabel: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  totalSide: {
    alignItems: "flex-end",
  },
  total: {
    fontFamily: fonts.bold,
    fontSize: 20,
  },
  headerAction: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
