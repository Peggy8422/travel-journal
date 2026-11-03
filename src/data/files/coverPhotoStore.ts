import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import type { CoverPhotoStore } from "../../domain/ledger";

/*
 * 照片封面的檔案（I/O）：存在 App 的文件資料夾（系統不會自動清掉），
 * 檔名的格式與哪些檔案還有帳本在用，由 features 層決定。
 */

/** 封面在畫面上最大約 150pt 寬，3 倍螢幕也只要 450px，存 600px 寬就夠清楚 */
const COVER_WIDTH = 600;
/** 壓到每張約 100～200 KB，備份檔才不會太大 */
const COVER_COMPRESS = 0.7;

function folder(): Directory {
  const dir = new Directory(Paths.document, "cover-photos");
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

export function createCoverPhotoStore(): CoverPhotoStore {
  return {
    async saveFrom(name, sourceUri) {
      const target = new File(folder(), name);
      if (target.exists) target.delete();
      await new File(sourceUri).copy(target);
    },

    async readBase64(name) {
      const file = new File(folder(), name);
      return file.exists ? file.base64() : null;
    },

    async writeBase64(name, base64) {
      const file = new File(folder(), name);
      file.create({ overwrite: true });
      await file.write(base64, { encoding: "base64" });
    },

    async list() {
      return folder()
        .list()
        .filter((entry): entry is File => entry instanceof File)
        .map((file) => file.name);
    },

    async delete(name) {
      const file = new File(folder(), name);
      if (file.exists) file.delete();
    },

    uri(name) {
      return new File(folder(), name).uri;
    },
  };
}

/**
 * 讓使用者從相簿挑一張照片，縮小、壓縮成 JPEG 後回傳暫存檔的位址；取消時回傳 null。
 * 選照片不需要相簿權限（系統的照片選擇器只把選到的那張交給 App）。
 */
export async function pickCoverPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > COVER_WIDTH) context.resize({ width: COVER_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: COVER_COMPRESS,
  });
  return saved.uri;
}
