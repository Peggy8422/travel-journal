import { StyleSheet, Text, View } from "react-native";

import { fonts } from "../../../shared/ui/fonts";
import { useTheme } from "../../../shared/ui/theme";

const STAMP = "#B5452B";

/** 成員名字旁邊的「我」：朱色小圓章，稍微歪一點 */
export function SelfBadge({ size = 18 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="我"
      style={[
        styles.self,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text
        style={[
          styles.selfText,
          { color: theme.primary, fontSize: size * 0.58 },
        ]}
      >
        我
      </Text>
    </View>
  );
}

/** 消費列右下的「已結清」：朱色細框小章 */
export function SettledTag() {
  const theme = useTheme();
  return (
    <View style={styles.settled}>
      <Text style={[styles.settledText, { color: theme.primary }]}>已結清</Text>
    </View>
  );
}

/** 「已封存」：虛線框的小標籤 */
export function ArchivedTag() {
  return (
    <View style={styles.archived}>
      <Text style={styles.archivedText}>已封存</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  self: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.4,
    borderColor: STAMP,
    transform: [{ rotate: "-10deg" }],
  },
  selfText: {
    fontFamily: fonts.bold,
  },
  settled: {
    marginTop: 2,
    paddingHorizontal: 6,
    borderWidth: 1.3,
    borderColor: STAMP,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 8,
    transform: [{ rotate: "-4deg" }],
  },
  settledText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
  },
  archived: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderWidth: 1.2,
    borderStyle: "dashed",
    borderColor: "rgba(58,51,45,0.5)",
    borderRadius: 10,
  },
  archivedText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#5E554C",
  },
});
