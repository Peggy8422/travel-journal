import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Label } from "./components";
import { spacing, useTheme } from "./theme";

/**
 * 日期時間欄位。iOS 用系統的精簡型選擇器；Android 沒有日期時間合一的選擇器，
 * 點擊後先選日期、再選時間。
 */
export function DateTimeField({
  label,
  value,
  onChange,
  maximumDate,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  maximumDate?: Date;
}) {
  const theme = useTheme();

  if (Platform.OS === "ios") {
    return (
      <View style={styles.row}>
        <Label muted>{label}</Label>
        <DateTimePicker
          value={value}
          mode="datetime"
          display="compact"
          locale="zh-TW"
          maximumDate={maximumDate}
          themeVariant={theme.isDark ? "dark" : "light"}
          onValueChange={(_event, date) => onChange(date)}
        />
      </View>
    );
  }

  // onValueChange 只在使用者選定時觸發；取消（onDismiss）時保留原值，不需處理
  function openAndroidPicker() {
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      maximumDate,
      onValueChange: (_event, date) => {
        DateTimePickerAndroid.open({
          value: date,
          mode: "time",
          is24Hour: true,
          onValueChange: (_timeEvent, dateTime) => {
            // 時間選擇器不受 maximumDate 限制，選到未來時改用上限
            onChange(
              maximumDate && dateTime > maximumDate ? maximumDate : dateTime,
            );
          },
        });
      },
    });
  }

  return (
    <View style={styles.row}>
      <Label muted>{label}</Label>
      <Pressable
        accessibilityRole="button"
        onPress={openAndroidPicker}
        style={[styles.androidValue, { backgroundColor: theme.chip }]}
      >
        <Text style={{ color: theme.text }}>{formatDateTime(value)}</Text>
      </Pressable>
    </View>
  );
}

/** 依裝置時區顯示，例如 "2026/10/12 12:05" */
export function formatDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: 44,
  },
  androidValue: {
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
});
