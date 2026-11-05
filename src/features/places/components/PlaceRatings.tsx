import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  RATING_SCORE,
  type PlaceRating,
  type RatingCriterionRecord,
} from "../../../domain/places";
import { fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";

const SCORES = Array.from(
  { length: RATING_SCORE.max - RATING_SCORE.min + 1 },
  (_, i) => RATING_SCORE.min + i,
);

/** 每顆點的圓角都不太一樣，看起來像手蓋的印 */
const DOT_SHAPES = [
  [9, 8, 10, 7.5],
  [8, 10, 8.5, 9],
  [10, 8.5, 9, 8],
  [8.5, 9, 7.5, 10],
  [9.5, 7.5, 10, 8.5],
] as const;

/**
 * 1～5 顆朱色小印。onChange 有給時可以點：點已經選的那一顆會清掉分數（沒打分數）。
 */
export function ScoreDots({
  score,
  label,
  size = 18,
  onChange,
}: {
  score: number | null;
  /** 評分項目名稱，給讀螢幕用 */
  label: string;
  size?: number;
  onChange?: (score: number | null) => void;
}) {
  const theme = useTheme();
  const dots = SCORES.map((value, i) => {
    const on = score !== null && value <= score;
    const [tl, tr, br, bl] = DOT_SHAPES[i % DOT_SHAPES.length]!;
    const ratio = size / 18;
    return (
      <View
        key={value}
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderTopLeftRadius: tl * ratio,
            borderTopRightRadius: tr * ratio,
            borderBottomRightRadius: br * ratio,
            borderBottomLeftRadius: bl * ratio,
            borderColor: on ? theme.primary : theme.pencil,
            backgroundColor: on ? theme.primary : "transparent",
            opacity: on ? 0.88 : 1,
          },
        ]}
      />
    );
  });

  if (!onChange) {
    return (
      <View
        accessible
        accessibilityLabel={
          score === null ? `${label}：沒打分數` : `${label}：${score} 分`
        }
        style={styles.row}
      >
        {dots}
      </View>
    );
  }
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: score === null ? "沒打分數" : `${score} 分` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        const current = score ?? 0;
        if (event.nativeEvent.actionName === "increment") {
          onChange(Math.min(RATING_SCORE.max, current + 1));
        } else {
          onChange(current <= RATING_SCORE.min ? null : current - 1);
        }
      }}
      style={styles.row}
    >
      {SCORES.map((value, i) => (
        <Pressable
          key={value}
          hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
          onPress={() => onChange(value === score ? null : value)}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          {dots[i]}
        </Pressable>
      ))}
    </View>
  );
}

const HEART =
  "M12 20.2c-4.9-3.3-8.3-6.4-8.3-10.1 0-2.6 2-4.5 4.4-4.5 1.6 0 3 .8 3.9 2.2.9-1.4 2.3-2.2 3.9-2.2 2.4 0 4.4 1.9 4.4 4.5 0 3.7-3.4 6.8-8.3 10.1z";

/** 「還想再去」的心；on 時塗朱色 */
export function RevisitHeart({
  on,
  size = 18,
}: {
  on: boolean;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={on ? theme.primary : "none"}
      fillOpacity={0.88}
      stroke={on ? theme.primary : theme.pencil}
      strokeWidth={1.6}
      strokeLinejoin="round"
    >
      <Path d={HEART} />
    </Svg>
  );
}

/** 地點頁上的分數：一個評分項目一列，封存的項目後面註明 */
export function RatingList({
  ratings,
  criteria,
}: {
  ratings: readonly PlaceRating[];
  criteria: readonly RatingCriterionRecord[];
}) {
  const theme = useTheme();
  const rows = ratings.flatMap((rating) => {
    const criterion = criteria.find((c) => c.id === rating.criterionId);
    return criterion ? [{ criterion, score: rating.score }] : [];
  });
  return (
    <View style={styles.list}>
      {rows.map(({ criterion, score }) => (
        <View key={criterion.id} style={styles.listRow}>
          <Text style={[styles.listLabel, { color: theme.text }]}>
            {criterion.label}
            {criterion.archivedAt !== null && (
              <Text style={{ color: theme.textMuted }}>（已封存）</Text>
            )}
          </Text>
          <ScoreDots score={score} label={criterion.label} />
        </View>
      ))}
    </View>
  );
}

/** 清單上的一行分數，例如「好吃 5 · 氣氛 4」；沒打分數時回傳 null */
export function ratingSummary(
  ratings: readonly PlaceRating[],
  criteria: readonly RatingCriterionRecord[],
): string | null {
  const parts = ratings.flatMap((rating) => {
    const criterion = criteria.find((c) => c.id === rating.criterionId);
    return criterion ? [`${criterion.label} ${rating.score}`] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    borderWidth: 1.4,
  },
  list: {
    gap: 8,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 28,
  },
  listLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
