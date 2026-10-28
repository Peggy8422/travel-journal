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
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "./fonts";
import { useTheme } from "./theme";

/** 提示停留的時間；新的提示會取代舊的並重新計時 */
const DURATION_MS = 2400;

const ToastContext = createContext<(message: string) => void>(() => {});

/**
 * 操作完成後的短提示（例如「加入了 小安」），掛在最外層的 layout，
 * 所以換頁（例如刪除帳本後回到書架）也看得到。錯誤訊息仍放在畫面上，不用提示。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const show = useCallback(
    (message: string) =>
      setToast((prev) => ({ id: (prev?.id ?? 0) + 1, message })),
    [],
  );

  useEffect(() => {
    if (!toast) return;
    AccessibilityInfo.announceForAccessibility(toast.message);
    const timer = setTimeout(() => setToast(null), DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <ToastNote key={toast.id} message={toast.message} />}
    </ToastContext.Provider>
  );
}

/** 回傳顯示提示的函式 */
export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

/** 墨色小紙條，從下方淡入，稍微歪一點 */
function ToastNote({ message }: { message: string }) {
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
      style={[styles.layer, { bottom: insets.bottom + 104 }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
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
    pointerEvents: "none",
  },
  note: {
    maxWidth: 300,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 9,
    borderBottomLeftRadius: 13,
    boxShadow: "0px 6px 16px rgba(58,51,45,0.25)",
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
