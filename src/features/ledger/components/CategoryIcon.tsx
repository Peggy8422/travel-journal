import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import {
  isExpenseCategory,
  type ExpenseCategory,
} from "../../../domain/ledger";
import { useTheme } from "../../../shared/ui/theme";
import { categoryColor, categoryTint } from "./categories";

/** 各分類的手繪圖示（18 × 18），未分類與清單以外的舊分類用「其他」的三個點 */
const ICON_PATHS: Readonly<Record<ExpenseCategory, readonly string[]>> = {
  food: [
    "M2.6 9.4h12.8c-.1 3.6-2.9 6.2-6.4 6.2S2.7 13 2.6 9.4z",
    "M8.5 7.6L13.6 2.5M10.9 7.7l4.6-3.9",
  ],
  transport: [
    "M5.2 2.8h7.6c1.3 0 2.2.9 2.2 2.2v6.7c0 1.2-1 2.1-2.2 2.1H5.2C4 13.8 3 12.9 3 11.7V5c0-1.3.9-2.2 2.2-2.2z",
    "M3.2 8.4h11.6",
    "M6.2 13.8l-1.6 3M11.8 13.8l1.6 3",
  ],
  lodging: [
    "M2.6 9.2L9 3.6l6.4 5.5",
    "M4.4 8v7.6h9.2V8",
    "M7.6 15.5v-3.6h2.8v3.6",
  ],
  shopping: [
    "M3.8 6.6h10.4l-1 9H4.8z",
    "M6.6 6.6V5.2C6.6 3.8 7.7 2.7 9 2.7s2.4 1.1 2.4 2.5v1.4",
  ],
  entertainment: [
    "M2.6 5.4h12.8v2.3c-1 .2-1.6.8-1.6 1.7s.6 1.5 1.6 1.7v2.4H2.6v-2.4c1-.2 1.6-.8 1.6-1.7s-.6-1.5-1.6-1.7z",
  ],
  other: [],
};

/**
 * 分類圖示：分類淡色的圓底加手繪線條（消費列、表單的分類選擇）。
 * background 可以換掉圓底的顏色，ring 會在外圈描一圈分類色（表單裡選中的分類）。
 */
export function CategoryIcon({
  category,
  size = 34,
  background,
  ring = false,
}: {
  category: string | null;
  size?: number;
  background?: string;
  ring?: boolean;
}) {
  const theme = useTheme();
  const known =
    category !== null && isExpenseCategory(category) ? category : "other";
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background ?? categoryTint(category, theme),
        boxShadow: ring
          ? `0px 0px 0px 2px ${categoryColor(category, theme)}`
          : undefined,
        borderTopLeftRadius: size / 2,
        borderTopRightRadius: size * 0.46,
        borderBottomRightRadius: size * 0.52,
        borderBottomLeftRadius: size * 0.48,
      }}
    >
      <Svg
        width={size * 0.53}
        height={size * 0.53}
        viewBox="0 0 18 18"
        fill="none"
        stroke={theme.text}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {known === "other" ? (
          <Path d="M4.5 9h.1M9 9h.1M13.5 9h.1" strokeWidth={2.4} />
        ) : (
          ICON_PATHS[known].map((d) => <Path key={d} d={d} strokeWidth={1.4} />)
        )}
        {known === "entertainment" && (
          <Path d="M10.6 5.8v7.6" strokeWidth={1.4} strokeDasharray="1.5 2" />
        )}
      </Svg>
    </View>
  );
}
