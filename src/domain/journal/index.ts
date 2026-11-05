// 旅遊手帳模組的公開 API。其他層只從這裡 import，不直接引用內部檔案。
export type {
  JournalBackup,
  JournalEntryRecord,
  JournalPlace,
  JournalRecord,
} from "./records";
export { ENTRY_PHOTO_LIMIT } from "./records";
export type {
  IllustrationRepository,
  JournalEntryRepository,
  JournalRepository,
} from "./ports";
export {
  ENTRY_STICKER_LIMIT,
  ILLUSTRATION_CANVAS,
  ILLUSTRATION_INKS,
  ILLUSTRATION_STROKE_LIMIT,
  ILLUSTRATION_TOOLS,
  isIllustrationInk,
  hasInk,
  isIllustrationTool,
  normalizeAngle,
  parseSticker,
  parseStrokes,
  STICKER_SIZE,
  STROKE_POINT_LIMIT,
  STROKE_WIDTH,
  type DrawPoint,
  type EntrySticker,
  type IllustrationInk,
  type IllustrationRecord,
  type IllustrationStroke,
  type IllustrationTool,
} from "./illustration";
export {
  strokePath,
  strokesBounds,
  thinPoints,
  type DrawBounds,
} from "./drawing";
export {
  isJournalTape,
  JOURNAL_TAPES,
  parseJournalCover,
  type JournalCover,
  type JournalTape,
} from "./cover";
export {
  isJournalMood,
  isJournalWeather,
  JOURNAL_MOODS,
  JOURNAL_WEATHERS,
  type JournalMood,
  type JournalWeather,
} from "./stamps";
export { isLocalDate } from "./localDate";
