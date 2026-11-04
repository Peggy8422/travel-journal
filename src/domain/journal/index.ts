// 旅遊手帳模組的公開 API。其他層只從這裡 import，不直接引用內部檔案。
export type {
  JournalBackup,
  JournalEntryRecord,
  JournalPlace,
  JournalRecord,
} from "./records";
export { ENTRY_PHOTO_LIMIT } from "./records";
export type { JournalEntryRepository, JournalRepository } from "./ports";
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
