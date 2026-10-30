import { StyleSheet, Text, View } from "react-native";

import { formatMinorAmount } from "../../../domain/ledger";
import { fonts } from "../../../shared/ui/fonts";
import { WashFill } from "../../../shared/ui/handDrawn";
import { useTheme } from "../../../shared/ui/theme";

/** 個人花費的兩種來源：藍（藍色封面的深色）是個人、山吹是分帳負擔 */
const PERSONAL = "#3C5A86";
const SHARED = "#E2B45A";

/**
 * 個人花費的組成：上面一條依比例分成兩段的長條（沒有花費時不畫），下面是兩種來源的金額。
 * 個人分頁的入口與個人記帳明細共用。
 */
export function PersonalSplit({
  personalMinor,
  sharedMinor,
}: {
  personalMinor: number;
  sharedMinor: number;
}) {
  const theme = useTheme();
  const total = personalMinor + sharedMinor;
  const money = (minor: number) => `TWD ${formatMinorAmount(minor, "TWD")}`;
  const percent = (minor: number) => Math.round((minor / total) * 100);
  return (
    <>
      {total > 0 && (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`個人花費占 ${percent(personalMinor)}%，分帳負擔占 ${percent(sharedMinor)}%`}
          style={styles.bar}
        >
          {personalMinor > 0 && (
            <View style={{ flex: personalMinor }}>
              <WashFill color={PERSONAL} radius={7} />
            </View>
          )}
          {sharedMinor > 0 && (
            <View style={{ flex: sharedMinor }}>
              <WashFill color={SHARED} radius={7} />
            </View>
          )}
        </View>
      )}
      <View style={styles.legend}>
        <View style={styles.key}>
          <View style={[styles.swatch, { backgroundColor: PERSONAL }]} />
          <Text style={[styles.keyText, { color: theme.text }]}>
            個人 {money(personalMinor)}
          </Text>
        </View>
        <View style={styles.key}>
          <View style={[styles.swatch, { backgroundColor: SHARED }]} />
          <Text style={[styles.keyText, { color: theme.text }]}>
            分帳負擔 {money(sharedMinor)}
          </Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: 3,
    height: 14,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 4,
  },
  key: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  keyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
});
