import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { pickCoverPhoto } from "../../../data/files/coverPhotoStore";
import {
  JOURNAL_TAPES,
  type JournalCover as Cover,
  type JournalTape,
} from "../../../domain/journal";
import { ErrorText, SmallButton } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { DashedLine } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";
import { appCoverPhotos } from "../../ledger/services/appCoverPhotos";
import { saveCoverPhoto } from "../../ledger/services/coverPhotos";
import type { EntryFormJournal } from "../services/entryCommands";
import type { LedgerChoice } from "../services/journalCommands";
import { JournalCover } from "./JournalCover";
import { ledgerDotColor, TAPE_COLORS } from "./tapes";

/*
 * 建立手帳與手帳設定共用的欄位：封面（照片、紙膠帶）、綁定帳本的清單；
 * 還有編輯日記時挑手帳的清單。
 */

/**
 * 封面照片：剛挑的照片先放在暫存檔，按下建立或儲存時才用 commit 存進 App；
 * 中途離開就不會留下照片（之後由 tidyCoverPhotos 清掉）。
 */
export function useJournalPhoto(saved: string | null) {
  const [photo, setPhoto] = useState(saved);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    setError(null);
    setBusy(true);
    try {
      const uri = await pickCoverPhoto();
      if (uri !== null) setPendingUri(uri);
    } catch {
      setError("讀不到這張照片，換一張試試");
    } finally {
      setBusy(false);
    }
  }

  return {
    /** 有沒有照片（剛挑的或原本存好的） */
    hasPhoto: pendingUri !== null || photo !== null,
    /** 原本存好的檔名，和這次有沒有換照片無關 */
    savedName: photo,
    pendingUri,
    busy,
    error,
    pick,
    clear() {
      setPendingUri(null);
      setPhoto(null);
    },
    /** 存檔前呼叫：剛挑的照片存進 App，回傳要記在封面上的檔名 */
    async commit(newId: () => string): Promise<string | null> {
      if (pendingUri === null) return photo;
      return saveCoverPhoto(appCoverPhotos, newId, pendingUri);
    },
  };
}

export type JournalPhoto = ReturnType<typeof useJournalPhoto>;

/** 封面預覽加上換照片、拿掉照片、紙膠帶顏色 */
export function JournalCoverEditor({
  tape,
  onTape,
  photo,
  title,
  caption,
  width = 120,
}: {
  tape: JournalTape;
  onTape: (tape: JournalTape) => void;
  photo: JournalPhoto;
  title: string;
  caption: string;
  width?: number;
}) {
  const theme = useTheme();
  const cover: Cover = {
    tape,
    photo: photo.pendingUri === null ? photo.savedName : null,
  };
  return (
    <View style={styles.coverEditor}>
      <JournalCover
        cover={cover}
        title={title}
        caption={caption}
        width={width}
        tilt={-1.5}
        photoUri={photo.pendingUri ?? undefined}
      />
      <View style={styles.coverControls}>
        <Text style={[styles.fieldTitle, { color: theme.text }]}>封面</Text>
        <View style={styles.buttons}>
          <SmallButton
            title={photo.hasPhoto ? "換一張照片" : "選封面照片"}
            onPress={() => void photo.pick()}
            disabled={photo.busy}
          />
          {photo.hasPhoto && (
            <SmallButton title="不要照片" onPress={photo.clear} />
          )}
        </View>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="紙膠帶顏色"
          style={styles.tapes}
        >
          {JOURNAL_TAPES.map((code) => {
            const selected = code === tape;
            return (
              <Pressable
                key={code}
                accessibilityRole="radio"
                accessibilityLabel={`${TAPE_COLORS[code].name}色紙膠帶`}
                accessibilityState={{ selected }}
                onPress={() => onTape(code)}
                style={styles.tapeButton}
              >
                <View
                  style={[
                    styles.tapeDot,
                    { backgroundColor: TAPE_COLORS[code].color },
                    selected ? styles.tapeSelected : styles.tapeIdle,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
        <ErrorText message={photo.error} />
      </View>
    </View>
  );
}

/** 綁定帳本的清單：第一列是「不綁帳本」，已經綁給別本手帳的帳本不能選 */
export function LedgerChoiceList({
  choices,
  selected,
  onSelect,
}: {
  choices: readonly LedgerChoice[];
  selected: string | null;
  onSelect: (choice: LedgerChoice | null) => void;
}) {
  const theme = useTheme();
  const rows = [null, ...choices];
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.list, { backgroundColor: theme.surface }]}
    >
      {rows.map((choice, index) => {
        const id = choice?.ledger.id ?? null;
        const isSelected = id === selected;
        const taken = choice?.takenBy ?? null;
        const sub = taken
          ? `已經有手帳「${taken}」`
          : choice
            ? choice.tripMonth.replace("-", ".")
            : null;
        return (
          <View key={id ?? "none"}>
            {index > 0 && <DashedLine dotted />}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: !!taken }}
              disabled={!!taken}
              onPress={() => onSelect(choice)}
              style={({ pressed }) => [
                styles.row,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.ledgerDot,
                  choice
                    ? { backgroundColor: ledgerDotColor(choice.ledger) }
                    : { borderWidth: 1.3, borderColor: theme.pencil },
                ]}
              />
              <View style={styles.rowText}>
                <Text
                  style={[
                    styles.rowName,
                    { color: taken ? theme.textMuted : theme.text },
                  ]}
                >
                  {choice ? choice.ledger.name : "不綁帳本"}
                </Text>
                {sub && (
                  <Text style={[styles.rowSub, { color: theme.textMuted }]}>
                    {sub}
                  </Text>
                )}
              </View>
              {isSelected && <CheckIcon color={theme.primary} />}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/** 編輯日記時挑這篇日記要收在哪本手帳；圓點是手帳封面的紙膠帶色 */
export function JournalChoiceList({
  choices,
  selected,
  onSelect,
}: {
  choices: readonly EntryFormJournal[];
  selected: string;
  onSelect: (choice: EntryFormJournal) => void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.list, { backgroundColor: theme.surface }]}
    >
      {choices.map((choice, index) => {
        const { journal, ledger } = choice;
        const isSelected = journal.id === selected;
        return (
          <View key={journal.id}>
            {index > 0 && <DashedLine dotted />}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(choice)}
              style={({ pressed }) => [
                styles.row,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View
                style={[
                  styles.ledgerDot,
                  { backgroundColor: TAPE_COLORS[journal.cover.tape].color },
                ]}
              />
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: theme.text }]}>
                  {journal.name}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textMuted }]}>
                  {choice.otherDates.length} 篇日記
                  {ledger ? `・帳本「${ledger.name}」` : ""}
                </Text>
              </View>
              {isSelected && <CheckIcon color={theme.primary} />}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

/** 名稱欄下面的黃色提示：名稱還是舊帳本的名稱時，建議改成新綁定的帳本名稱 */
export function RenameSuggestion({
  oldName,
  newName,
  onAccept,
}: {
  oldName: string;
  newName: string;
  onAccept: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.suggestion}>
      <Text style={[styles.suggestionText, { color: theme.text }]}>
        名稱還是「{oldName}」，要改成「{newName}」嗎？
      </Text>
      <SmallButton title="改成帳本名稱" onPress={onAccept} />
    </View>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 8.6l3.2 3.1 6.8-7.4" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  coverEditor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  coverControls: {
    flex: 1,
    gap: 10,
  },
  fieldTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tapes: {
    flexDirection: "row",
    marginLeft: -8,
  },
  tapeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tapeDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  tapeIdle: {
    boxShadow: "0px 0px 0px 1px rgba(58,51,45,0.25)",
  },
  tapeSelected: {
    boxShadow: "0px 0px 0px 2.5px #FBF8F1, 0px 0px 0px 4.2px #3A332D",
  },
  list: {
    borderRadius: 14,
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.3)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  ledgerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  rowSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    backgroundColor: "#F3E0B4",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 15,
  },
  suggestionText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 21,
  },
});
