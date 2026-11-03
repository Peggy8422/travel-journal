import { createCoverPhotoStore } from "../../../data/files/coverPhotoStore";
import type { SqlExecutor } from "../../../data/db/sqlDatabase";
import { pruneCoverPhotos } from "./coverPhotos";

/** App 實際使用的封面照片資料夾；測試改用 memoryCoverPhotoStore */
export const appCoverPhotos = createCoverPhotoStore();

/** 封面照片在畫面上顯示用的位址 */
export function coverPhotoUri(name: string): string {
  return appCoverPhotos.uri(name);
}

/**
 * 換封面、刪帳本、建立帳本之後在背景清掉沒人用的照片。
 * 清不掉只是多佔一點空間，下次還會再清，所以不等它、也不顯示錯誤。
 */
export function tidyCoverPhotos(db: SqlExecutor): void {
  void pruneCoverPhotos(db, appCoverPhotos).catch(() => undefined);
}
