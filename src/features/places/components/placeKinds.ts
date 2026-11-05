import type { PlaceKind, PlaceStatus } from "../../../domain/places";

/** 地點類型的中文名稱與顏色（清單上的小圓點、地圖上的標記）；代碼在 domain/places */
export const PLACE_KIND_STYLES: Readonly<
  Record<PlaceKind, { readonly label: string; readonly color: string }>
> = {
  restaurant: { label: "餐廳", color: "#B5452F" },
  cafe: { label: "咖啡", color: "#8A6545" },
  sweets: { label: "甜點", color: "#D9828C" },
  bar: { label: "酒吧", color: "#3F5F8F" },
  sight: { label: "景點", color: "#6F9150" },
  shopping: { label: "購物", color: "#D29B2E" },
  stay: { label: "住宿", color: "#7A6A9A" },
  other: { label: "其他", color: "#7A7068" },
};

export const PLACE_STATUS_LABELS: Readonly<Record<PlaceStatus, string>> = {
  want: "想去",
  visited: "去過",
};
