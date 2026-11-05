import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { createDeviceLocator } from "../../../data/location/deviceLocator";
import { TEXT_LIMITS, type GeoPoint } from "../../../domain/ledger";
import {
  PLACE_KINDS,
  PLACE_PHOTO_LIMIT,
  type PlaceKind,
  type PlaceStatus,
} from "../../../domain/places";
import { useFieldScroller } from "../../../shared/hooks/useFieldScroller";
import { notifyDataChanged } from "../../../shared/hooks/useFocusedQuery";
import {
  Chip,
  ChipGroup,
  ErrorText,
  HeaderAction,
  Label,
  MessageScreen,
  Screen,
  SmallButton,
  TextButton,
  TextField,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import {
  EntryPhotoField,
  useEntryPhotos,
} from "../../journal/components/EntryPhotos";
import { GlobeIcon, PlacePinIcon } from "../../journal/components/EntryPlaces";
import { LocationPickerModal } from "../../ledger/components/LocationPickerModal";
import { describeError } from "../../ledger/components/messages";
import { useCurrentPlace } from "../../ledger/hooks/useCurrentPlace";
import { tidyCoverPhotos } from "../../ledger/services/appCoverPhotos";
import { usePlaceForm } from "../hooks/usePlaceQueries";
import {
  addPlace,
  cityOf,
  deletePlace,
  restorePlace,
  updatePlace,
  type PlaceForm,
  type PlaceInput,
} from "../services/placeCommands";
import { PLACE_KIND_STYLES, PLACE_STATUS_LABELS } from "./placeKinds";
import { RevisitHeart, ScoreDots } from "./PlaceRatings";

type FormField = "location" | "name" | "city" | "photos" | "note";

const locator = createDeviceLocator();

/** 自動帶入的文字：使用者還沒自己改過時，換地點會跟著換 */
interface AutoText {
  readonly text: string;
  readonly auto: boolean;
}

/** 截到字數上限，免得儲存時被擋 */
function fit(text: string | null, max: number): string {
  return text?.slice(0, max).trim() ?? "";
}

/** 收藏地點（placeId 為 null）與編輯地點共用的 modal，保留原生導覽列放取消、儲存 */
export function PlaceFormScreen({ placeId }: { placeId: string | null }) {
  const { data, error } = usePlaceForm(placeId);
  if (error) return <MessageScreen text="讀取地點失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;
  // Mounted once the data is in, so the fields start from it
  return <Form form={data.value} />;
}

function Form({ form }: { form: PlaceForm }) {
  const theme = useTheme();
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const scroller = useFieldScroller();
  const currentPlace = useCurrentPlace(locator);
  const { place, criteria } = form;
  const [location, setLocation] = useState<GeoPoint | null>(
    place?.location ?? null,
  );
  const [name, setName] = useState<AutoText>({
    text: place?.name ?? "",
    auto: false,
  });
  const [city, setCity] = useState<AutoText>({
    text: place?.city ?? "",
    auto: false,
  });
  const [kind, setKind] = useState<PlaceKind>(place?.kind ?? "restaurant");
  const [status, setStatus] = useState<PlaceStatus>(place?.status ?? "want");
  const [note, setNote] = useState(place?.note ?? "");
  const [scores, setScores] = useState<ReadonlyMap<string, number>>(
    () => new Map(place?.ratings.map((r) => [r.criterionId, r.score])),
  );
  const [revisit, setRevisit] = useState(place?.revisit ?? false);
  const photos = useEntryPhotos(place?.photos ?? [], PLACE_PHOTO_LIMIT);
  const [picking, setPicking] = useState(false);
  const [fieldError, setFieldError] = useState<{
    field: FormField;
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const errorFor = (field: FormField) =>
    fieldError?.field === field ? fieldError.message : null;
  const clearError = (field: FormField) =>
    setFieldError((e) => (e?.field === field ? null : e));

  // Archived criteria stay on the form only where this place already has a score
  const shownCriteria = criteria.filter(
    (c) => c.archivedAt === null || scores.has(c.id),
  );
  const locateState = currentPlace.state;
  const busy = locateState.status === "locating";

  /** 選了地點：名稱、城市還沒自己改過的話跟著換 */
  function placeAt(point: GeoPoint, placeName: string | null) {
    setLocation(point);
    clearError("location");
    const suggested = fit(placeName, TEXT_LIMITS.placeName);
    if (suggested !== "") {
      setName((n) =>
        n.text === "" || n.auto ? { text: suggested, auto: true } : n,
      );
      clearError("name");
    }
    void cityOf(locator, point).then((found) => {
      const text = fit(found, TEXT_LIMITS.city);
      if (text === "") return;
      setCity((c) => (c.text === "" || c.auto ? { text, auto: true } : c));
    });
  }

  async function locateHere() {
    const result = await currentPlace.locate();
    if (result?.ok) placeAt(result.value.location, result.value.placeName);
  }

  async function picked(point: GeoPoint, placeName: string | null) {
    setPicking(false);
    // A search result already has its name; a tapped point needs a lookup
    if (placeName !== null) {
      placeAt(point, placeName);
      return;
    }
    placeAt(point, null);
    const result = await currentPlace.describe(point);
    if (result?.ok) placeAt(point, result.value.placeName);
  }

  function fail(field: FormField, message: string) {
    setFieldError({ field, message });
    scroller.scrollTo(field);
  }

  async function submit() {
    Keyboard.dismiss();
    setFieldError(null);
    // 由上到下檢查：地點在最上面
    if (location === null) return fail("location", "請先選地點");
    setSaving(true);
    try {
      const input: PlaceInput = {
        name: name.text,
        location,
        city: city.text,
        kind,
        status,
        note,
        ratings: [...scores.entries()].map(([criterionId, score]) => ({
          criterionId,
          score,
        })),
        revisit,
        photos: await photos.commit(deps.newId),
      };
      const result = place
        ? await updatePlace(deps, place.id, input)
        : await addPlace(deps, input);
      if (!result.ok) {
        const error = result.error;
        if (
          error.code === "EMPTY_PLACE_NAME" ||
          (error.code === "TEXT_TOO_LONG" && error.field === "placeName")
        ) {
          return fail("name", describeError(error));
        }
        if (error.code === "TEXT_TOO_LONG" && error.field === "city") {
          return fail("city", describeError(error));
        }
        if (error.code === "TOO_MANY_PHOTOS") {
          return fail("photos", describeError(error));
        }
        if (error.code === "TEXT_TOO_LONG" && error.field === "placeNote") {
          return fail("note", describeError(error));
        }
        // 不屬於某一欄的錯誤用彈窗：「儲存」在頁首
        Alert.alert("無法儲存", describeError(error));
        return;
      }
      // Photos taken off this place are no longer used by anything
      tidyCoverPhotos(deps.db);
      if (place) {
        router.back();
        toast("已儲存");
      } else {
        router.replace({
          pathname: "/places/[id]",
          params: { id: result.value.id },
        });
        toast(`收藏了「${result.value.name}」`);
      }
    } catch {
      Alert.alert("無法儲存", "儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!place) return;
    Alert.alert(
      "刪除地點",
      `確定要刪除「${place.name}」嗎？之後可以在收藏清單最下面的「最近刪除」還原。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => remove(place.id, place.name),
        },
      ],
    );
  }

  async function remove(id: string, title: string) {
    try {
      const result = await deletePlace(deps, id);
      if (!result.ok) {
        Alert.alert("無法刪除", describeError(result.error));
        return;
      }
      // The place page is gone too, so go back to the list
      router.dismissTo("/places");
      toast(`刪掉「${title}」了`, {
        label: "復原",
        onPress: () => undoDelete(id, title),
      });
    } catch {
      Alert.alert("無法刪除", "刪除失敗，請再試一次");
    }
  }

  /** 提示紙條上的「復原」：這時已經離開這個畫面，失敗用彈窗告知 */
  async function undoDelete(id: string, title: string) {
    try {
      const result = await restorePlace(deps, id);
      if (!result.ok) {
        Alert.alert("無法復原", describeError(result.error));
        return;
      }
      notifyDataChanged();
      toast(`「${title}」放回來了`);
    } catch {
      Alert.alert(
        "無法復原",
        "復原失敗，可以到收藏清單最下面的「最近刪除」再試一次",
      );
    }
  }

  const located =
    locateState.status === "done" && locateState.result.ok
      ? locateState.result.value
      : undefined;
  const suggestions = form.cities
    .filter((c) => c !== city.text.trim())
    .slice(0, 6);

  return (
    <Screen
      contentStyle={styles.content}
      scrollRef={scroller.scrollRef}
      contentRef={scroller.contentRef}
    >
      <Stack.Screen
        options={{
          title: place ? "編輯地點" : "收藏地點",
          headerLeft: () => (
            <HeaderAction title="取消" onPress={() => router.back()} />
          ),
          headerRight: () => (
            <HeaderAction
              title="儲存"
              strong
              disabled={saving || photos.busy || busy}
              onPress={submit}
            />
          ),
        }}
      />

      <View ref={scroller.field("location")} style={styles.group}>
        <Text style={[styles.label, { color: theme.text }]}>地點</Text>
        {location && (
          <View style={[styles.located, { backgroundColor: theme.surface }]}>
            <PlacePinIcon size={18} filled />
            <Text style={[styles.locatedText, { color: theme.text }]}>
              已選好位置
            </Text>
          </View>
        )}
        <View style={styles.buttons}>
          <SmallButton
            title={location ? "在地圖上調整" : "搜尋或在地圖上選"}
            variant={location ? "outline" : "primary"}
            icon={
              <GlobeIcon
                size={16}
                color={location ? theme.text : theme.onPrimary}
              />
            }
            onPress={() => setPicking(true)}
            disabled={busy}
          />
          <SmallButton
            title="目前位置"
            icon={<PlacePinIcon size={16} color={theme.text} />}
            onPress={locateHere}
            disabled={busy}
          />
        </View>
        {busy && <Label muted>取得地點中…</Label>}
        {locateState.status === "done" && !locateState.result.ok && (
          <ErrorText message={describeError(locateState.result.error)} />
        )}
        {located?.approximate && (
          <Label muted>目前無法精確定位，使用的是最近一次的位置</Label>
        )}
        <ErrorText message={errorFor("location")} />
      </View>

      <View ref={scroller.field("name")}>
        <TextField
          label="名稱"
          strongLabel
          placeholder="店名或地名，例如：本家 第一旭"
          value={name.text}
          onChangeText={(text) => {
            setName({ text, auto: false });
            clearError("name");
          }}
          maxLength={TEXT_LIMITS.placeName}
          error={errorFor("name")}
        />
      </View>

      <View ref={scroller.field("city")} style={styles.group}>
        <TextField
          label="城市"
          strongLabel
          placeholder="例如：京都市（選了地點會自動帶入）"
          value={city.text}
          onChangeText={(text) => {
            setCity({ text, auto: false });
            clearError("city");
          }}
          maxLength={TEXT_LIMITS.city}
          error={errorFor("city")}
        />
        {suggestions.length > 0 && (
          <ChipGroup>
            {suggestions.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={false}
                onPress={() => setCity({ text: c, auto: false })}
              />
            ))}
          </ChipGroup>
        )}
      </View>

      <View accessibilityRole="radiogroup" style={styles.group}>
        <Text style={[styles.label, { color: theme.text }]}>類型</Text>
        <ChipGroup>
          {PLACE_KINDS.map((k) => (
            <Chip
              key={k}
              label={PLACE_KIND_STYLES[k].label}
              dot={PLACE_KIND_STYLES[k].color}
              selected={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </ChipGroup>
      </View>

      <View accessibilityRole="radiogroup" style={styles.group}>
        <Text style={[styles.label, { color: theme.text }]}>狀態</Text>
        <ChipGroup>
          {(["want", "visited"] as const).map((s) => (
            <Chip
              key={s}
              label={PLACE_STATUS_LABELS[s]}
              selected={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
        </ChipGroup>
      </View>

      {status === "visited" && (
        <View style={styles.group}>
          <Text style={[styles.label, { color: theme.text }]}>我的評分</Text>
          {shownCriteria.map((criterion) => (
            <View key={criterion.id} style={styles.scoreRow}>
              <Text style={[styles.scoreLabel, { color: theme.text }]}>
                {criterion.label}
                {criterion.archivedAt !== null && (
                  <Text style={{ color: theme.textMuted }}>（已封存）</Text>
                )}
              </Text>
              <ScoreDots
                score={scores.get(criterion.id) ?? null}
                label={criterion.label}
                size={24}
                onChange={(score) =>
                  setScores((current) => {
                    const next = new Map(current);
                    if (score === null) next.delete(criterion.id);
                    else next.set(criterion.id, score);
                    return next;
                  })
                }
              />
            </View>
          ))}
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: revisit }}
            onPress={() => setRevisit((r) => !r)}
            style={({ pressed }) => [
              styles.revisit,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <RevisitHeart on={revisit} size={24} />
            <Text style={[styles.scoreLabel, { color: theme.text }]}>
              還想再去
            </Text>
          </Pressable>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            點同一顆可以取消，不想評的項目可以不打。
          </Text>
          <TextButton
            title="調整評分項目"
            onPress={() => router.push("/places/criteria")}
          />
        </View>
      )}

      <View ref={scroller.field("note")}>
        <TextField
          label={status === "visited" ? "心得" : "想去的理由"}
          strongLabel
          placeholder={
            status === "visited"
              ? "點了什麼、好不好吃、要不要排隊……"
              : "誰推薦的、想吃什麼、營業時間……"
          }
          value={note}
          onChangeText={(text) => {
            setNote(text);
            clearError("note");
          }}
          maxLength={TEXT_LIMITS.placeNote}
          multiline
          error={errorFor("note")}
        />
      </View>

      <View ref={scroller.field("photos")}>
        <EntryPhotoField photos={photos} error={errorFor("photos")} />
      </View>

      {place && (
        <TextButton
          title="刪除這個地點"
          color={theme.negative}
          align="center"
          onPress={confirmDelete}
        />
      )}

      <LocationPickerModal
        visible={picking}
        initialPoint={location}
        loadStartPoint={currentPlace.startPoint}
        onCancel={() => setPicking(false)}
        onConfirm={picked}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
  },
  group: {
    gap: 8,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  located: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 17,
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.3)",
  },
  locatedText: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 40,
  },
  scoreLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  revisit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    lineHeight: 19,
  },
});
