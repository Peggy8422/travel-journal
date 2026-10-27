import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/*
 * 檔案的匯出與匯入（I/O）。只負責讀寫與呼叫系統介面，內容的組裝與驗證在別處。
 * 失敗一律 throw，由呼叫端顯示訊息。
 */

export interface ShareableFile {
  readonly name: string;
  readonly content: string;
  /** Android 分享時使用 */
  readonly mimeType: string;
  /** iOS 分享時使用 */
  readonly uti: string;
}

/** 把內容寫進暫存資料夾，再開啟系統的分享選單（存到檔案、雲端硬碟、傳訊息等） */
export async function shareFile(file: ShareableFile): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device");
  }
  const target = new File(Paths.cache, file.name);
  target.create({ overwrite: true });
  await target.write(file.content);
  await Sharing.shareAsync(target.uri, {
    mimeType: file.mimeType,
    UTI: file.uti,
    dialogTitle: file.name,
  });
}

/** 讓使用者選一個檔案並讀出文字內容；取消時回傳 null */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // 備份檔可能被雲端硬碟改成其他 MIME type，不限制類型，內容由解析時檢查
    type: "*/*",
    copyToCacheDirectory: true,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return new File(asset.uri).text();
}
