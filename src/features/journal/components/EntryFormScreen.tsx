import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Defs, Pattern, Rect } from "react-native-svg";

import {
  JOURNAL_MOODS,
  JOURNAL_WEATHERS,
  type JournalMood,
  type JournalWeather,
} from "../../../domain/journal";
import { TEXT_LIMITS } from "../../../domain/ledger";
import { useFieldScroller } from "../../../shared/hooks/useFieldScroller";
import { notifyDataChanged } from "../../../shared/hooks/useFocusedQuery";
import {
  ErrorText,
  HeaderAction,
  MessageScreen,
  Screen,
  TextButton,
  TextField,
} from "../../../shared/ui/components";
import { DateField } from "../../../shared/ui/DateField";
import { accentOverhang, fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";
import { useToast } from "../../../shared/ui/Toast";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { describeError } from "../../ledger/components/messages";
import { tidyCoverPhotos } from "../../ledger/services/appCoverPhotos";
import { useEntryForm } from "../hooks/useJournalQueries";
import {
  deleteEntry,
  restoreEntry,
  updateEntry,
  writeEntry,
  type EntryForm,
  type EntryInput,
} from "../services/entryCommands";
import {
  dayNumber,
  entryHeading,
  monthDayLabel,
  weekdayOf,
} from "../services/journalDates";
import { EntryPhotoField, useEntryPhotos } from "./EntryPhotos";
import { EntryPlaceField, useEntryPlaces } from "./EntryPlaces";
import { JournalStamp } from "./JournalStamp";
import { MOOD_STAMPS, STAMP_TILTS, WEATHER_STAMPS } from "./stamps";

type FormField = "title" | "photos" | "body" | "places";

/** 寫日記（entryId 為 null）與編輯日記共用的 modal，保留原生導覽列放取消、儲存 */
export function EntryFormScreen({
  journalId,
  entryId,
}: {
  journalId: string;
  entryId: string | null;
}) {
  const { data, error } = useEntryForm(journalId, entryId);
  if (error) return <MessageScreen text="讀取日記失敗" />;
  if (!data) return null;
  if (!data.ok) return <MessageScreen text={describeError(data.error)} />;
  // Mounted once the data is in, so the fields start from it
  return <Form form={data.value} />;
}

function Form({ form }: { form: EntryForm }) {
  const theme = useTheme();
  const deps = useLedgerCommandDeps();
  const toast = useToast();
  const scroller = useFieldScroller();
  const { journal, entry } = form;
  const [date, setDate] = useState(form.date);
  const [title, setTitle] = useState(entry?.title ?? "");
  const [body, setBody] = useState(entry?.body ?? "");
  const [weather, setWeather] = useState<JournalWeather | null>(
    entry?.weather ?? null,
  );
  const [mood, setMood] = useState<JournalMood | null>(entry?.mood ?? null);
  const photos = useEntryPhotos(entry?.photos ?? []);
  const places = useEntryPlaces(entry?.places ?? []);
  const [fieldError, setFieldError] = useState<{
    field: FormField;
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const errorFor = (field: FormField) =>
    fieldError?.field === field ? fieldError.message : null;

  // Day 1 is the earliest page, which may be the one being written
  const earliest = form.otherDates[0];
  const first = earliest !== undefined && earliest < date ? earliest : date;

  function fail(field: FormField, message: string) {
    setFieldError({ field, message });
    scroller.scrollTo(field);
  }

  async function submit() {
    Keyboard.dismiss();
    setFieldError(null);
    setSaving(true);
    try {
      const input: EntryInput = {
        date,
        title,
        body,
        weather,
        mood,
        photos: await photos.commit(deps.newId),
        places: places.toPlaces(),
      };
      const result = entry
        ? await updateEntry(deps, entry.id, input)
        : await writeEntry(deps, journal.id, input);
      if (!result.ok) {
        const error = result.error;
        if (error.code === "TEXT_TOO_LONG" && error.field === "entryTitle") {
          return fail("title", describeError(error));
        }
        if (error.code === "TOO_MANY_PHOTOS") {
          return fail("photos", describeError(error));
        }
        if (
          error.code === "EMPTY_ENTRY" ||
          (error.code === "TEXT_TOO_LONG" && error.field === "entryBody")
        ) {
          return fail("body", describeError(error));
        }
        if (
          error.code === "EMPTY_PLACE_NAME" ||
          (error.code === "TEXT_TOO_LONG" && error.field === "placeName")
        ) {
          return fail("places", describeError(error));
        }
        // 不屬於某一欄的錯誤用彈窗：「儲存」在頁首
        Alert.alert("無法儲存", describeError(error));
        return;
      }
      // Photos taken off this page are no longer used by anything
      tidyCoverPhotos(deps.db);
      if (entry) {
        router.back();
        toast("已儲存日記");
      } else {
        // The new page opens right away, like turning to it in the notebook
        router.replace({
          pathname: "/journal/[id]/entry/[entryId]",
          params: { id: journal.id, entryId: result.value.id },
        });
        toast("寫好了一篇日記");
      }
    } catch {
      Alert.alert("無法儲存", "儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!entry) return;
    const heading = entryHeading(entry);
    Alert.alert(
      "刪除日記",
      `確定要刪除「${heading}」嗎？之後可以在手帳最下面的「最近刪除」還原。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "刪除",
          style: "destructive",
          onPress: () => remove(entry.id, heading),
        },
      ],
    );
  }

  async function remove(id: string, heading: string) {
    try {
      const result = await deleteEntry(deps, id);
      if (!result.ok) {
        Alert.alert("無法刪除", describeError(result.error));
        return;
      }
      // The page itself is gone too, so go all the way back to the journal
      router.dismissTo({
        pathname: "/journal/[id]",
        params: { id: journal.id },
      });
      toast(`刪掉「${heading}」了`, {
        label: "復原",
        onPress: () => undoDelete(id, heading),
      });
    } catch {
      Alert.alert("無法刪除", "刪除失敗，請再試一次");
    }
  }

  /** 提示紙條上的「復原」：這時已經離開這個畫面，失敗用彈窗告知 */
  async function undoDelete(id: string, heading: string) {
    try {
      const result = await restoreEntry(deps, id);
      if (!result.ok) {
        Alert.alert("無法復原", describeError(result.error));
        return;
      }
      notifyDataChanged();
      toast(`「${heading}」放回來了`);
    } catch {
      Alert.alert(
        "無法復原",
        "復原失敗，可以到手帳最下面的「最近刪除」再試一次",
      );
    }
  }

  return (
    <Screen
      contentStyle={styles.content}
      scrollRef={scroller.scrollRef}
      contentRef={scroller.contentRef}
    >
      <Stack.Screen
        options={{
          title: entry ? "編輯日記" : "寫日記",
          headerLeft: () => (
            <HeaderAction title="取消" onPress={() => router.back()} />
          ),
          headerRight: () => (
            <HeaderAction
              title="儲存"
              strong
              disabled={saving || photos.busy || places.busy}
              onPress={submit}
            />
          ),
        }}
      />

      <DateField
        label="日期"
        value={toDeviceDate(date)}
        text={`${date.replace(/-/g, "/")}（${weekdayOf(date)}）`}
        accessibilityLabel={`日期：${monthDayLabel(date)}，點一下修改`}
        accessory={
          <Text style={[styles.dayN, { color: theme.primary }]}>
            Day {dayNumber(first, date)}
          </Text>
        }
        onChange={(picked) => setDate(fromDeviceDate(picked))}
      />

      <View ref={scroller.field("title")}>
        <TextField
          label="標題"
          strongLabel
          placeholder="今天的一句話，例如：雨中的清水寺"
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            setFieldError((e) => (e?.field === "title" ? null : e));
          }}
          maxLength={TEXT_LIMITS.entryTitle}
          error={errorFor("title")}
        />
      </View>

      <StampRow
        label="天氣"
        codes={JOURNAL_WEATHERS}
        names={WEATHER_STAMPS}
        selected={weather}
        onSelect={setWeather}
      />
      <View style={styles.group}>
        <StampRow
          label="心情"
          codes={JOURNAL_MOODS}
          names={MOOD_STAMPS}
          selected={mood}
          onSelect={setMood}
        />
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          再點一次可以取消，天氣和心情都可以不選。
        </Text>
      </View>

      <View ref={scroller.field("photos")}>
        <EntryPhotoField photos={photos} error={errorFor("photos")} />
      </View>

      <View ref={scroller.field("body")} style={styles.group}>
        <Text style={[styles.label, { color: theme.text }]}>日記</Text>
        <RuledInput
          value={body}
          onChangeText={(text) => {
            setBody(text);
            setFieldError((e) => (e?.field === "body" ? null : e));
          }}
          error={errorFor("body")}
        />
      </View>

      <View ref={scroller.field("places")}>
        <EntryPlaceField places={places} error={errorFor("places")} />
      </View>

      {entry && (
        <TextButton
          title="刪除這篇日記"
          color={theme.negative}
          align="center"
          onPress={confirmDelete}
        />
      )}
    </Screen>
  );
}

/** 一排五個印章，點了蓋上去，再點一次取消 */
function StampRow<Code extends JournalWeather | JournalMood>({
  label,
  codes,
  names,
  selected,
  onSelect,
}: {
  label: string;
  codes: readonly Code[];
  names: Readonly<Record<Code, { readonly label: string }>>;
  selected: Code | null;
  onSelect: (code: Code | null) => void;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View style={styles.stamps}>
        {codes.map((code, i) => {
          const on = selected === code;
          return (
            <Pressable
              key={code}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={names[code].label}
              onPress={() => onSelect(on ? null : code)}
              style={({ pressed }) => [
                styles.stampButton,
                {
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: on ? 1.08 : 1 }],
                },
              ]}
            >
              <JournalStamp
                code={code}
                size={50}
                inked={on}
                tilt={STAMP_TILTS[i % STAMP_TILTS.length]}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const LINE = 28;
const LINE_TOP = 6;

/**
 * 日記內容的輸入框：橫線信紙，一行對一條線。
 * 字數到八成以上在右下角顯示，到上限時下面寫出上限（同 TextField）。
 */
function RuledInput({
  value,
  onChangeText,
  error,
}: {
  value: string;
  onChangeText: (text: string) => void;
  error: string | null;
}) {
  const theme = useTheme();
  const max = TEXT_LIMITS.entryBody;
  const length = value.length;
  const full = length >= max;
  const message =
    error ||
    (length > max
      ? `超過 ${max} 字上限，請刪到 ${max} 字以內`
      : full
        ? `已達 ${max} 字上限`
        : null);
  return (
    <View style={styles.field}>
      <View style={styles.paper}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id="entryRules"
              patternUnits="userSpaceOnUse"
              x={0}
              y={LINE_TOP}
              width={8}
              height={LINE}
            >
              <Rect
                y={LINE - 1}
                width={8}
                height={1}
                fill="rgba(60,90,134,0.16)"
              />
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#entryRules)" />
        </Svg>
        <TextInput
          accessibilityLabel="日記"
          multiline
          value={value}
          onChangeText={onChangeText}
          maxLength={Math.max(max, length)}
          placeholder="今天去了哪裡、吃了什麼、看到什麼……"
          placeholderTextColor={theme.textMuted}
          textAlignVertical="top"
          style={[styles.bodyInput, { color: theme.text }]}
        />
      </View>
      {length >= max * 0.8 && (
        <Text
          accessibilityLabel={`已輸入 ${length} 字，上限 ${max} 字`}
          style={[
            styles.count,
            { color: full ? theme.negative : theme.textMuted },
          ]}
        >
          {length} / {max}
        </Text>
      )}
      <ErrorText message={message} />
    </View>
  );
}

/** 日記日期轉成裝置當地的那一天（中午，避開日光節約時間的切換） */
function toDeviceDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
}

function fromDeviceDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingTop: 18,
    paddingBottom: 40,
  },
  group: {
    gap: 8,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
  },
  dayN: {
    fontFamily: fonts.accent,
    fontSize: 15,
    paddingRight: accentOverhang(15),
  },
  stamps: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stampButton: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  field: {
    gap: 4,
  },
  paper: {
    minHeight: 224,
    backgroundColor: "#FFFDF8",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 12,
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.3)",
    overflow: "hidden",
  },
  bodyInput: {
    minHeight: 224,
    paddingHorizontal: 12,
    paddingTop: LINE_TOP,
    paddingBottom: LINE_TOP,
    fontFamily: fonts.regular,
    fontSize: 15.5,
    lineHeight: LINE,
  },
  count: {
    alignSelf: "flex-end",
    fontFamily: fonts.regular,
    fontSize: 12,
  },
});
