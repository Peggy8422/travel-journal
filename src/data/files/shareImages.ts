import { Album, Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

/*
 * 分享卡的 I/O：把畫面上的卡片存成圖片、存進相簿、打開系統分享選單。
 * 失敗一律 throw，由呼叫端顯示訊息。
 */

/** 使用者沒有允許 App 加入照片 */
export class PhotoLibraryDeniedError extends Error {
  constructor() {
    super("Photo library permission denied");
    this.name = "PhotoLibraryDeniedError";
  }
}

/**
 * 把一張卡片存成 JPEG 暫存檔，回傳檔案 URI。
 * pixelWidth、pixelHeight 是輸出圖片的實際像素（captureRef 的寬高是邏輯像素，要除以 pixelRatio）。
 */
export async function captureCard(
  view: Parameters<typeof captureRef>[0],
  {
    pixelWidth,
    pixelHeight,
    pixelRatio,
  }: { pixelWidth: number; pixelHeight: number; pixelRatio: number },
): Promise<string> {
  return captureRef(view, {
    format: "jpg",
    quality: 0.95,
    result: "tmpfile",
    width: pixelWidth / pixelRatio,
    height: pixelHeight / pixelRatio,
  });
}

/** 分享圖片放進的相簿名稱 */
export const SHARE_ALBUM = "旅遊手帳";

/**
 * 依序存進照片 App 的「旅遊手帳」相簿（沒有就建一個），回傳有沒有放進相簿。
 * 依序存，IG 的相簿裡才會照頁面順序排。
 *
 * 建相簿、找相簿要完整的照片權限。只允許部分照片時找不到已經建好的相簿，
 * 每次都會多建一本，所以只存進照片、不放相簿；不允許讀照片時改要「加入照片」的權限，一樣只存不放相簿。
 */
export async function saveToPhotoLibrary(
  uris: readonly string[],
): Promise<{ inAlbum: boolean }> {
  const full = await requestPermissionsAsync(false, ["photo"]);
  if (full.granted && full.accessPrivileges !== "limited") {
    const album = await Album.get(SHARE_ALBUM);
    const assets: Asset[] = [];
    for (const uri of uris) {
      assets.push(await Asset.create(uri, album ?? undefined));
    }
    if (!album) await Album.create(SHARE_ALBUM, assets, false);
    return { inAlbum: true };
  }
  if (!full.granted) {
    const addOnly = await requestPermissionsAsync(true, ["photo"]);
    if (!addOnly.granted) throw new PhotoLibraryDeniedError();
  }
  for (const uri of uris) {
    await Asset.create(uri);
  }
  return { inAlbum: false };
}

/** 打開系統分享選單分享一張圖片（選 Instagram 後可以發貼文或限動） */
export async function shareImage(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(uri, { mimeType: "image/jpeg", UTI: "public.jpeg" });
}
