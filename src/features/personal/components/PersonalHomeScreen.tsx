import { router } from "expo-router";
import { Pressable, View } from "react-native";

import {
  formatMinorAmount,
  summarizePersonalMonth,
} from "../../../domain/ledger";
import { Label, Row, Screen, Section } from "../../../shared/ui/components";
import { useTheme } from "../../../shared/ui/theme";
import { usePersonalSpending } from "../../ledger/hooks/usePersonalQueries";
import { toLocalIsoString } from "../../ledger/services/localTimestamp";

/**
 * 「個人」分頁的入口：列出個人功能，點進去才是各自的畫面。
 * 目前有個人記帳；旅遊手帳之後會放在這裡。
 */
export function PersonalHomeScreen() {
  const { data } = usePersonalSpending();
  const month = toLocalIsoString(new Date()).slice(0, 7);
  // 讀取中或讀取失敗時只是不顯示金額，入口本身仍然可以點
  const monthTotal =
    data?.ok === true
      ? summarizePersonalMonth(data.value.entries, month).totalMinor
      : undefined;

  return (
    <Screen>
      <Section title="個人功能">
        <EntryRow
          title="個人記帳"
          description={
            monthTotal === undefined
              ? "自己的花費，以及在分帳帳本裡負擔的部分"
              : `本月花費 TWD ${formatMinorAmount(monthTotal, "TWD")}`
          }
          onPress={() => router.push("/personal/spending")}
        />
        <EntryRow
          title="旅遊手帳"
          description="準備中"
          // 之後接上旅遊手帳時再開放
        />
      </Section>
    </Screen>
  );
}

function EntryRow({
  title,
  description,
  onPress,
}: {
  title: string;
  description: string;
  /** 省略代表還不能使用 */
  onPress?: () => void;
}) {
  const theme = useTheme();
  const disabled = onPress === undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Row>
        <View style={{ flex: 1 }}>
          <Label>{title}</Label>
          <Label muted>{description}</Label>
        </View>
        {!disabled && <Label color={theme.textMuted}>›</Label>}
      </Row>
    </Pressable>
  );
}
