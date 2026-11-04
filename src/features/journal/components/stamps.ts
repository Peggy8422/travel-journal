import {
  isJournalWeather,
  type JournalMood,
  type JournalWeather,
} from "../../../domain/journal";

/** 印章的名稱與圖案（24×24 的線條），代碼在 domain/journal/stamps.ts */
interface StampStyle {
  readonly label: string;
  readonly icon: string;
}

export const WEATHER_STAMPS: Readonly<Record<JournalWeather, StampStyle>> = {
  sunny: {
    label: "晴",
    icon: "M16.2 12a4.2 4.2 0 1 1-8.4 0a4.2 4.2 0 1 1 8.4 0zM12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.8 5.8l1.5 1.5M16.7 16.7l1.5 1.5M5.8 18.2l1.5-1.5M16.7 7.3l1.5-1.5",
  },
  cloudy: {
    label: "多雲",
    icon: "M7 17.5h10.2c2.3 0 4-1.7 4-3.8 0-2-1.6-3.7-3.7-3.8-.6-2.6-2.9-4.4-5.6-4.4-3 0-5.4 2.2-5.8 5.1C4.3 10.9 3 12.4 3 14.2c0 1.9 1.6 3.3 4 3.3z",
  },
  rain: {
    label: "雨",
    icon: "M7 13.8h10c2 0 3.5-1.5 3.5-3.3 0-1.8-1.4-3.2-3.2-3.3-.6-2.3-2.6-3.9-5-3.9-2.7 0-4.8 1.9-5.2 4.5C5.4 8 4 9.3 4 10.9c0 1.6 1.3 2.9 3 2.9zM8.6 16.6l-1 2.6M12.6 16.6l-1 2.6M16.6 16.6l-1 2.6",
  },
  snow: {
    label: "雪",
    icon: "M12 3.5v17M4.6 7.8l14.8 8.4M4.6 16.2l14.8-8.4M10.2 4.8L12 6.4l1.8-1.6M10.2 19.2L12 17.6l1.8 1.6",
  },
  windy: {
    label: "起風",
    icon: "M3.5 9.2h10.8c1.8 0 2.9-1.1 2.9-2.5 0-1.3-1-2.3-2.3-2.3-1.1 0-2 .7-2.2 1.7M3.5 13h14.6c1.6 0 2.7 1.1 2.7 2.4 0 1.4-1.1 2.4-2.4 2.4-1.1 0-2-.6-2.3-1.6M3.5 16.6h7.4",
  },
};

const FACE =
  "M12 3.8c4.6-.1 8.3 3.6 8.2 8.2-.1 4.5-3.7 8.2-8.3 8.1-4.5 0-8.1-3.7-8-8.2.1-4.4 3.7-8 8.1-8.1z";

export const MOOD_STAMPS: Readonly<Record<JournalMood, StampStyle>> = {
  happy: {
    label: "開心",
    icon: `${FACE}M9 10.1h.01M15 10.1h.01M8.4 13.8c1.9 2.3 5.3 2.3 7.2 0`,
  },
  excited: {
    label: "興奮",
    icon: `${FACE}M8 10.4l1.3-1.4 1.3 1.4M13.4 10.4l1.3-1.4 1.3 1.4M8.6 13.4h6.8c-.3 2.2-1.6 3.4-3.4 3.4s-3.1-1.2-3.4-3.4z`,
  },
  relaxed: {
    label: "放鬆",
    icon: `${FACE}M7.8 10.4c.8.8 1.9.8 2.7 0M13.5 10.4c.8.8 1.9.8 2.7 0M9.6 14.6c1.4 1 3.4 1 4.8 0`,
  },
  tired: {
    label: "累了",
    icon: `${FACE}M8 10.4h2.4M13.6 10.4h2.4M9 15.2c1-.7 2-.7 3 0s2 .7 3 0`,
  },
  moved: {
    label: "感動",
    icon: "M12 19.5C7.5 16 4.2 13 4.2 9.6 4.2 7.3 6 5.6 8.1 5.6c1.6 0 3 .9 3.9 2.3.9-1.4 2.3-2.3 3.9-2.3 2.1 0 3.9 1.7 3.9 4 0 3.4-3.3 6.4-7.8 9.9z",
  },
};

export type StampCode = JournalWeather | JournalMood;

/** 天氣是藍色圓章，心情是朱色方章 */
export function stampStyle(code: StampCode): StampStyle & {
  readonly kind: "weather" | "mood";
} {
  return isJournalWeather(code)
    ? { ...WEATHER_STAMPS[code], kind: "weather" }
    : { ...MOOD_STAMPS[code], kind: "mood" };
}

/** 一排印章各自歪一點，不要排得太整齊 */
export const STAMP_TILTS = [-8, 5, -3, 7, -6] as const;
