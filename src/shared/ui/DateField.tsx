import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useState, type ReactNode } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { fonts } from "./fonts";
import { useTheme } from "./theme";

/**
 * 只選日期的欄位：左邊是標題，右邊是手繪框的按鈕（文字由呼叫端決定，旁邊可以加小字）。
 * iOS 點下去從下面升起系統的月曆，點一天就收起；Android 用系統的日期對話框。
 * 日期用裝置當地的年月日，時間部分不重要。
 */
export function DateField({
  label,
  value,
  text,
  accessory,
  accessibilityLabel,
  onChange,
}: {
  label: string;
  value: Date;
  /** 按鈕上的日期文字，例如「2025/11/22（六）」 */
  text: string;
  /** 日期後面的小字，例如「Day 2」 */
  accessory?: ReactNode;
  accessibilityLabel: string;
  onChange: (date: Date) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  function press() {
    Keyboard.dismiss();
    if (Platform.OS === "ios") {
      setOpen(true);
      return;
    }
    // onValueChange 只在使用者選定時觸發；取消時保留原值
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      onValueChange: (_event, date) => onChange(date),
    });
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={press}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <CalendarIcon color={theme.text} />
        <Text style={[styles.text, { color: theme.text }]}>{text}</Text>
        {accessory}
      </Pressable>

      {open && (
        <Modal
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="關閉月曆"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.surface,
                paddingBottom: insets.bottom + 12,
              },
            ]}
          >
            <View style={styles.header}>
              <Text
                accessibilityRole="header"
                style={[styles.title, { color: theme.text }]}
              >
                {label}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setOpen(false)}
                hitSlop={8}
                style={styles.cancel}
              >
                <Text style={[styles.cancelText, { color: theme.textMuted }]}>
                  取消
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={value}
              mode="date"
              display="inline"
              locale="zh-TW"
              accentColor={theme.primary}
              themeVariant="light"
              onValueChange={(_event, date) => {
                setOpen(false);
                onChange(date);
              }}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M5 5.5h14c.8 0 1.5.7 1.5 1.5v11.5c0 .8-.7 1.5-1.5 1.5H5c-.8 0-1.5-.7-1.5-1.5V7c0-.8.7-1.5 1.5-1.5zM3.6 10h16.8M8 3.5v4M16 3.5v4" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 40,
    paddingLeft: 11,
    paddingRight: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 17,
    borderBottomRightRadius: 19,
    borderBottomLeftRadius: 18,
    boxShadow: "0px 0px 0px 1.3px rgba(58,51,45,0.55)",
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(58,51,45,0.3)",
  },
  sheet: {
    gap: 4,
    paddingTop: 16,
    paddingHorizontal: 12,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 22,
    boxShadow: "0px -4px 18px rgba(58,51,45,0.18)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  cancel: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cancelText: {
    fontFamily: fonts.regular,
    fontSize: 15,
  },
});
