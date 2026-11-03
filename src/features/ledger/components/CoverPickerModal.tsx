import { useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import {
  COVER_PALETTES,
  COVER_PATTERNS,
  COVER_STYLES,
  type LedgerCover,
} from "../../../domain/ledger";
import { pickCoverPhoto } from "../../../data/files/coverPhotoStore";
import {
  Chip,
  ChipGroup,
  ErrorText,
  SmallButton,
} from "../../../shared/ui/components";
import { fonts } from "../../../shared/ui/fonts";
import { PaperBackground } from "../../../shared/ui/handDrawn";
import { spacing, useTheme } from "../../../shared/ui/theme";
import {
  COVER_COLORS,
  COVER_PATTERN_NAMES,
  COVER_STYLE_NAMES,
  describeCover,
} from "./coverStyles";
import { useLedgerCommandDeps } from "../../database/DatabaseProvider";
import { appCoverPhotos } from "../services/appCoverPhotos";
import { saveCoverPhoto } from "../services/coverPhotos";
import { NotebookCover } from "./NotebookCover";

/**
 * 自訂封面：分別挑樣式、配色、和柄花紋（只有和柄樣式才看得到花紋），上方即時預覽。
 * 樣式選「照片」會打開相簿，配色就變成書背的顏色。照片按「完成」才存進 App，
 * 交回的封面帶著存好的檔名。和 LocationPickerModal 一樣用 Modal，不用跨畫面傳值。
 */
export function CoverPickerModal({
  visible,
  initialCover,
  title,
  caption,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initialCover: LedgerCover;
  /** 預覽封面上的帳本名稱 */
  title: string;
  /** 預覽封面上的小字（旅行月份） */
  caption: string;
  onCancel: () => void;
  onConfirm: (cover: LedgerCover) => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      {/* A modal is a separate native window, so it needs its own provider for insets */}
      <SafeAreaProvider>
        {visible && (
          <PickerContent
            initialCover={initialCover}
            title={title}
            caption={caption}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        )}
      </SafeAreaProvider>
    </Modal>
  );
}

function PickerContent({
  initialCover,
  title,
  caption,
  onCancel,
  onConfirm,
}: {
  initialCover: LedgerCover;
  title: string;
  caption: string;
  onCancel: () => void;
  onConfirm: (cover: LedgerCover) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const deps = useLedgerCommandDeps();
  const [cover, setCover] = useState(initialCover);
  /** 已經存好的照片（原本的照片封面）；換成其他樣式再換回來時沿用 */
  const [savedPhoto] = useState(initialCover.photo);
  /** 這次剛挑的照片（壓縮後的暫存檔），按「完成」才存進 App */
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const patch = (next: Partial<LedgerCover>) =>
    setCover((current) => ({ ...current, ...next }));
  const isPhoto = cover.style === "photo";
  const hasPhoto = pendingUri !== null || savedPhoto !== undefined;
  /** 預覽與縮圖用：照片樣式帶上照片，其他樣式不帶 */
  const withPhoto = (style: LedgerCover["style"]): LedgerCover =>
    style === "photo"
      ? { ...cover, style, photo: savedPhoto }
      : { style, palette: cover.palette, pattern: cover.pattern };

  async function choosePhoto() {
    setError(null);
    setBusy(true);
    try {
      const uri = await pickCoverPhoto();
      if (uri === null) return;
      setPendingUri(uri);
      patch({ style: "photo" });
    } catch {
      setError("讀不到這張照片，換一張試試");
    } finally {
      setBusy(false);
    }
  }

  function selectStyle(style: LedgerCover["style"]) {
    if (style === "photo" && !hasPhoto) {
      void choosePhoto();
      return;
    }
    patch({ style });
  }

  async function confirm() {
    if (!isPhoto) {
      onConfirm(withPhoto(cover.style));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const photo = pendingUri
        ? await saveCoverPhoto(appCoverPhotos, deps.newId, pendingUri)
        : savedPhoto;
      onConfirm({ ...cover, photo });
    } catch {
      setError("照片存不起來，請再試一次");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <PaperBackground />
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <HeaderButton title="取消" onPress={onCancel} />
        <Text
          accessibilityRole="header"
          style={[styles.headerTitle, { color: theme.text }]}
        >
          自訂封面
        </Text>
        <HeaderButton
          title="完成"
          bold
          disabled={busy}
          onPress={() => void confirm()}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <View style={styles.preview}>
          <NotebookCover
            cover={withPhoto(cover.style)}
            photoUri={isPhoto ? (pendingUri ?? undefined) : undefined}
            title={title}
            caption={caption}
            width={140}
            tilt={-1}
          />
          <Text style={[styles.description, { color: theme.textMuted }]}>
            {describeCover(cover)}
          </Text>
        </View>

        <Section title="樣式">
          <View style={styles.styleRow}>
            {COVER_STYLES.map((style) => {
              const selected = cover.style === style;
              return (
                <Pressable
                  key={style}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`樣式：${COVER_STYLE_NAMES[style]}`}
                  disabled={busy}
                  onPress={() => selectStyle(style)}
                  style={({ pressed }) => [
                    styles.styleOption,
                    {
                      borderColor: selected ? theme.text : "transparent",
                      backgroundColor: selected ? theme.surface : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <NotebookCover
                    cover={withPhoto(style)}
                    photoUri={
                      style === "photo" ? (pendingUri ?? undefined) : undefined
                    }
                    title=""
                    caption=""
                    width={50}
                  />
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={[
                      styles.optionLabel,
                      {
                        color: theme.text,
                        fontFamily: selected ? fonts.bold : fonts.regular,
                      },
                    ]}
                  >
                    {COVER_STYLE_NAMES[style]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {isPhoto && (
            <View style={styles.photoActions}>
              <SmallButton
                title="換一張照片"
                disabled={busy}
                onPress={() => void choosePhoto()}
              />
            </View>
          )}
          <ErrorText message={error} />
        </Section>

        <Section title={isPhoto ? "書背顏色" : "顏色"}>
          <View style={styles.swatches}>
            {COVER_PALETTES.map((palette) => {
              const selected = cover.palette === palette;
              const colors = COVER_COLORS[palette];
              return (
                <Pressable
                  key={palette}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${colors.name}色`}
                  onPress={() => patch({ palette })}
                  style={({ pressed }) => [
                    styles.swatchOption,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: colors.base,
                        borderColor: selected ? theme.text : colors.deep,
                        borderWidth: selected ? 2.5 : 1.5,
                      },
                    ]}
                  >
                    {selected && (
                      <Svg
                        width={18}
                        height={18}
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="#FFFDF8"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <Path d="M3 8.6l3.2 3.1 6.8-7.4" />
                      </Svg>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.optionLabel,
                      {
                        color: theme.text,
                        fontFamily: selected ? fonts.bold : fonts.regular,
                      },
                    ]}
                  >
                    {colors.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {cover.style === "pattern" && (
          <Section title="和柄花紋">
            <ChipGroup>
              {COVER_PATTERNS.map((pattern) => (
                <Chip
                  key={pattern}
                  label={COVER_PATTERN_NAMES[pattern]}
                  selected={cover.pattern === pattern}
                  onPress={() => patch({ pattern })}
                />
              ))}
            </ChipGroup>
          </Section>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, { color: theme.text }]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function HeaderButton({
  title,
  onPress,
  bold,
  disabled,
}: {
  title: string;
  onPress: () => void;
  bold?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={spacing.md}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={[
          styles.headerButton,
          {
            color: bold ? theme.primary : theme.text,
            fontFamily: bold ? fonts.bold : fonts.regular,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  headerButton: {
    fontSize: 17,
  },
  content: {
    gap: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  preview: {
    alignItems: "center",
    gap: spacing.md,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  styleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  styleOption: {
    width: 66,
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: 1.5,
    borderRadius: 12,
  },
  photoActions: {
    alignItems: "center",
  },
  optionLabel: {
    fontSize: 12.5,
    textAlign: "center",
  },
  swatches: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.md,
  },
  swatchOption: {
    width: "25%",
    alignItems: "center",
    gap: 6,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
