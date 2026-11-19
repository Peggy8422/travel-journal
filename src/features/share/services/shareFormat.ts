/*
 * 分享到 IG 的圖片格式。卡片一律用固定版面畫（寬 360），存成圖片時放大成 1080 寬，
 * 所以卡片裡的尺寸都是固定值，不跟著螢幕寬度變。
 */

/** 貼文 4:5（輪播）或限時動態 9:16 */
export type ShareFormat = "post" | "story";

/** 卡片版面的寬度 */
export const SHARE_CARD_WIDTH = 360;
/** 存成圖片的像素寬度 */
export const SHARE_IMAGE_WIDTH = 1080;

/** 卡片版面的高度與存成圖片的像素高度：貼文 4:5、限動 9:16 */
export function shareCardSize(format: ShareFormat): {
  height: number;
  pixelHeight: number;
} {
  return format === "story"
    ? { height: 640, pixelHeight: 1920 }
    : { height: 450, pixelHeight: 1350 };
}
