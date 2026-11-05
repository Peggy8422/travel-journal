import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { Result } from "../../../domain/common/result";
import { TEXT_LIMITS } from "../../../domain/ledger";
import {
  ACTIVE_CRITERIA_LIMIT,
  type RatingCriterionRecord,
} from "../../../domain/places";
import { notifyDataChanged } from "../../../shared/hooks/useFocusedQuery";
import {
  ErrorText,
  Screen,
  SmallButton,
  TextField,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { DashedLine } from "../../../shared/ui/handDrawn";
import { PageHeader, PageMessage } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { describeError } from "../../ledger/components/messages";
import { useCriteria } from "../hooks/usePlaceQueries";
import {
  addCriterion,
  archiveCriterion,
  moveCriterion,
  renameCriterion,
  restoreCriterion,
  type PlaceCommandError,
} from "../services/placeCommands";

/**
 * 評分項目：使用中的可以改名、調整順序、封存，最下面新增；封存的可以拿回來。
 * 每個動作都馬上存，錯誤寫在那一列下面。導覽列隱藏，頁首自己畫。
 */
export function CriteriaScreen() {
  const theme = useTheme();
  const deps = useLedgerCommandDeps();
  const { data, error } = useCriteria();
  const [draft, setDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{
    id: string;
    message: string;
  } | null>(null);

  if (error) {
    return <PageMessage onBack={router.back} text="讀取評分項目失敗" />;
  }
  const active = data?.filter((c) => c.archivedAt === null) ?? [];
  const archived = data?.filter((c) => c.archivedAt !== null) ?? [];
  const full = active.length >= ACTIVE_CRITERIA_LIMIT;

  /** 跑一個指令：成功就重讀，失敗把訊息寫在那一列下面 */
  async function run(
    id: string,
    task: () => Promise<Result<unknown, PlaceCommandError>>,
  ): Promise<boolean> {
    setRowError(null);
    try {
      const result = await task();
      if (!result.ok) {
        setRowError({ id, message: describeError(result.error) });
        return false;
      }
      notifyDataChanged();
      return true;
    } catch {
      setRowError({ id, message: "儲存失敗，請再試一次" });
      return false;
    }
  }

  async function add() {
    setAddError(null);
    try {
      const result = await addCriterion(deps, draft);
      if (!result.ok) {
        setAddError(describeError(result.error));
        return;
      }
      setDraft("");
      notifyDataChanged();
    } catch {
      setAddError("儲存失敗，請再試一次");
    }
  }

  return (
    <Screen
      header={
        <PageHeader onBack={router.back} kicker="Ratings" title="評分項目" />
      }
      contentStyle={styles.content}
    >
      <Text style={[styles.intro, { color: theme.textMuted }]}>
        去過的地點用這些項目打分數，每項 1～5，最多 {ACTIVE_CRITERIA_LIMIT}{" "}
        個。封存的項目不會出現在評分表單，已經打的分數照樣保留。
      </Text>

      <View style={styles.list}>
        {active.map((criterion, i) => (
          <CriterionRow
            key={`${criterion.id}:${criterion.label}`}
            criterion={criterion}
            first={i === 0}
            last={i === active.length - 1}
            error={rowError?.id === criterion.id ? rowError.message : null}
            onRename={(label) =>
              run(criterion.id, () =>
                renameCriterion(deps, criterion.id, label),
              )
            }
            onMove={(step) =>
              run(criterion.id, () => moveCriterion(deps, criterion.id, step))
            }
            onArchive={() =>
              run(criterion.id, () => archiveCriterion(deps, criterion.id))
            }
          />
        ))}
      </View>

      <View style={styles.add}>
        <View style={styles.addField}>
          <TextField
            placeholder={full ? "已經有 5 個了" : "新增項目，例如：服務"}
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              setAddError(null);
            }}
            editable={!full}
            maxLength={TEXT_LIMITS.ratingLabel}
            returnKeyType="done"
            onSubmitEditing={add}
            error={addError}
          />
        </View>
        <SmallButton
          title="新增"
          variant="primary"
          disabled={full || draft.trim() === ""}
          onPress={add}
        />
      </View>

      {archived.length > 0 && (
        <View style={styles.list}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            已封存
          </Text>
          <DashedLine />
          {archived.map((criterion) => (
            <View key={criterion.id} style={styles.archivedRow}>
              <View style={styles.archivedLine}>
                <Text
                  style={[styles.archivedLabel, { color: theme.textMuted }]}
                >
                  {criterion.label}
                </Text>
                <SmallButton
                  title="拿回來用"
                  disabled={full}
                  onPress={() =>
                    run(criterion.id, () =>
                      restoreCriterion(deps, criterion.id),
                    )
                  }
                />
              </View>
              <ErrorText
                message={
                  rowError?.id === criterion.id ? rowError.message : null
                }
              />
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function CriterionRow({
  criterion,
  first,
  last,
  error,
  onRename,
  onMove,
  onArchive,
}: {
  criterion: RatingCriterionRecord;
  first: boolean;
  last: boolean;
  error: string | null;
  onRename: (label: string) => Promise<boolean>;
  onMove: (step: -1 | 1) => void;
  onArchive: () => void;
}) {
  const theme = useTheme();
  const [label, setLabel] = useState(criterion.label);

  function commit() {
    if (label.trim() === criterion.label) {
      setLabel(criterion.label);
      return;
    }
    void onRename(label);
  }

  return (
    <View style={styles.rowWrap}>
      <View style={[styles.row, { backgroundColor: theme.surface }]}>
        <TextInput
          accessibilityLabel={`評分項目「${criterion.label}」的名稱`}
          value={label}
          onChangeText={setLabel}
          onEndEditing={commit}
          returnKeyType="done"
          maxLength={Math.max(TEXT_LIMITS.ratingLabel, criterion.label.length)}
          style={[styles.rowInput, { color: theme.text }]}
        />
        <ArrowButton
          label={`把「${criterion.label}」往前移`}
          up
          disabled={first}
          onPress={() => onMove(-1)}
        />
        <ArrowButton
          label={`把「${criterion.label}」往後移`}
          up={false}
          disabled={last}
          onPress={() => onMove(1)}
        />
        <SmallButton
          title="封存"
          accessibilityLabel={`封存「${criterion.label}」`}
          onPress={onArchive}
        />
      </View>
      <ErrorText message={error} />
    </View>
  );
}

function ArrowButton({
  label,
  up,
  disabled,
  onPress,
}: {
  label: string;
  up: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrow,
        { opacity: disabled ? 0.25 : pressed ? 0.6 : 1 },
      ]}
    >
      <Svg
        width={16}
        height={16}
        viewBox="0 0 16 16"
        fill="none"
        stroke={theme.text}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d={up ? "M3.5 10l4.5-4.6 4.5 4.6" : "M3.5 6l4.5 4.6 4.5-4.6"} />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
  },
  intro: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    lineHeight: 22,
  },
  list: {
    gap: 10,
  },
  rowWrap: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minHeight: 48,
    paddingLeft: 14,
    paddingRight: 6,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 13,
    borderBottomLeftRadius: 17,
    boxShadow: "0px 0px 0px 1.2px rgba(58,51,45,0.3)",
  },
  rowInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  arrow: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  add: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  addField: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  archivedRow: {
    gap: 4,
  },
  archivedLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 44,
  },
  archivedLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
