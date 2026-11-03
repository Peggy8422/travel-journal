import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "./fonts";
import { useTheme } from "./theme";

/** 提示停留的時間；新的提示會取代舊的並重新計時 */
const DURATION_MS = 2400;
/** 帶按鈕的提示（例如刪除後的「復原」）多留一點時間讓人按 */
const ACTION_DURATION_MS = 5000;

/** 提示右邊的按鈕，例如刪除後的「復原」 */
export interface ToastAction {
  readonly label: string;
  readonly onPress: () => void;
}

type ShowToast = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast>(() => {});

/**
 * 操作完成後的短提示（例如「加入了 小安」），掛在最外層的 layout，
 * 所以換頁（例如刪除帳本後回到書架）也看得到。錯誤訊息仍放在畫面上，不用提示。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    action?: ToastAction;
  } | null>(null);
  const show = useCallback<ShowToast>(
    (message, action) =>
      setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message, action })),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(
      toast.action
        ? `${toast.message}，可以按「${toast.action.label}」`
        : toast.message,
    );
    const timer = setTimeout(
      () => setToast(null),
      toast.action ? ACTION_DURATION_MS : DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <ToastNote
          key={toast.id}
          message={toast.message}
          action={
            toast.action && {
              label: toast.action.label,
              onPress: () => {
                setToast(null);
                toast.action?.onPress();
              },
            }
          }
        />
      )}
    </ToastContext.Provider>
  );
}

/** 回傳顯示提示的函式；第二個參數可以加一個按鈕（例如刪除後的「復原」） */
export function useToast(): ShowToast {
  return useContext(ToastContext);
}

/** 墨色小紙條，從下方淡入，稍微歪一點 */
function ToastNote({
  message,
  action,
}: {
  message: string;
  action?: ToastAction;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // 動畫值只建立一次；用 useState 而不是 useRef，render 時讀取才不會違反 refs 的規則
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  return (
    <View
      style={[
        styles.layer,
        { bottom: insets.bottom + 104 },
        // Only a note with a button takes touches; a plain one lets taps through
        { pointerEvents: action ? "box-none" : "none" },
      ]}
      // A plain note is announced instead; a note with a button must stay reachable
      importantForAccessibility={action ? "auto" : "no-hide-descendants"}
      accessibilityElementsHidden={!action}
    >
      <Animated.View
        style={[
          styles.note,
          {
            backgroundColor: theme.text,
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
              { rotate: "-1deg" },
            ],
          },
        ]}
      >
        <Text style={[styles.text, { color: theme.surface }]}>{message}</Text>
        {action && (
          <Pressable
            accessibilityRole="button"
            onPress={action.onPress}
            hitSlop={8}
            style={({ pressed }) => [
              styles.action,
              { borderColor: theme.surface, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.actionText, { color: theme.surface }]}>
              {action.label}
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  note: {
    maxWidth: 300,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 13,
    boxShadow: "0px 6px 16px rgba(58,51,45,0.25)",
  },
  text: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  action: {
    minHeight: 32,
    paddingHorizontal: 10,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 16,
  },
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
});
