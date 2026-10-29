import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Button, Card, ErrorText, Screen } from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { SketchFrame, WashiTape } from "../../../shared/ui/handDrawn";
import { PageHeader } from "../../../shared/ui/PageHeader";
import { useTheme } from "../../../shared/ui/theme";
import { useDatabase } from "../../database/DatabaseProvider";
import { pickAndRestoreBackup, shareBackup } from "../services/fileExports";
import { describeError, describeRestoreReport } from "./messages";

export function BackupScreen() {
  const theme = useTheme();
  const db = useDatabase();
  const [busy, setBusy] = useState<"export" | "restore" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function exportBackup() {
    setBusy("export");
    setMessage(null);
    try {
      await shareBackup(db, new Date());
    } catch {
      setMessage("匯出失敗，請再試一次");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    setMessage(null);
    try {
      const result = await pickAndRestoreBackup(db);
      if (result === null) return;
      if (!result.ok) {
        setMessage(describeError(result.error));
        return;
      }
      Alert.alert("還原完成", describeRestoreReport(result.value));
    } catch {
      setMessage("讀取檔案失敗，請再試一次");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen
      header={
        <PageHeader
          backLabel="帳本"
          onBack={router.back}
          kicker="Backup"
          title="備份與還原"
        />
      }
      contentStyle={styles.content}
    >
      <ErrorText message={message} />

      <BackupCard
        title="匯出備份"
        icon={<BoxIcon direction="up" />}
        iconTint="#DFE6CD"
        tape={{ color: "#9DB07A", tilt: -4, side: "left" }}
      >
        <Text style={[styles.body, { color: theme.text }]}>
          帳本和個人記帳的資料都只存在這支手機上，換手機或刪除 App
          就會消失。建議出發前和回國後各備份一次，存到雲端硬碟或傳給自己。
        </Text>
        <Text style={[styles.small, { color: theme.textMuted }]}>
          備份包含所有帳本（成員、消費、還款，含已刪除的）和個人記帳。
        </Text>
        <Button
          title={busy === "export" ? "準備備份檔中…" : "匯出備份檔"}
          onPress={exportBackup}
          disabled={busy !== null}
        />
      </BackupCard>

      <BackupCard
        title="還原"
        icon={<BoxIcon direction="down" />}
        iconTint="#D3DDEA"
        tape={{ color: "#6683AA", tilt: 5, side: "right" }}
      >
        <Text style={[styles.body, { color: theme.text }]}>
          選擇之前匯出的備份檔。手機上已經有的帳本會略過，不會被覆蓋；個人記帳只會補進手機上還沒有的消費。
        </Text>
        <Button
          title={busy === "restore" ? "讀取備份檔中…" : "選擇備份檔還原"}
          variant="secondary"
          onPress={restore}
          disabled={busy !== null}
        />
      </BackupCard>
    </Screen>
  );
}

/** 備份頁的紙卡：鉛筆框、角上一段紙膠帶、標題前一個圓形圖示 */
function BackupCard({
  title,
  icon,
  iconTint,
  tape,
  children,
}: {
  title: string;
  icon: ReactNode;
  iconTint: string;
  tape: { color: string; tilt: number; side: "left" | "right" };
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.card}>
      <SketchFrame radius={12} strokeWidth={1.2} />
      <View
        style={[
          styles.tape,
          tape.side === "left" ? { left: 22 } : { right: 26 },
        ]}
      >
        <WashiTape color={tape.color} tilt={tape.tilt} opacity={0.85} />
      </View>
      <View style={styles.cardHead}>
        <View style={[styles.icon, { backgroundColor: iconTint }]}>{icon}</View>
        <Text
          accessibilityRole="header"
          style={[styles.cardTitle, { color: theme.text }]}
        >
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}

/** 收納箱加箭頭：往上是匯出，往下是還原 */
function BoxIcon({ direction }: { direction: "up" | "down" }) {
  const theme = useTheme();
  return (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 22 22"
      fill="none"
      stroke={theme.text}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M4 8.5h14v9.3c0 .7-.5 1.2-1.2 1.2H5.2c-.7 0-1.2-.5-1.2-1.2z" />
      <Path d="M3.2 5.2h15.6v3.3H3.2z" />
      <Path
        d={
          direction === "up"
            ? "M11 16v-5M8.8 13.2L11 11l2.2 2.2"
            : "M11 11v5M8.8 13.8L11 16l2.2-2.2"
        }
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  card: {
    gap: 12,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  tape: {
    position: "absolute",
    top: -8,
    width: 60,
    height: 17,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 20.7,
    borderBottomRightRadius: 22.9,
    borderBottomLeftRadius: 21.1,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 14.5,
    lineHeight: 25,
  },
  small: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 22,
  },
});
