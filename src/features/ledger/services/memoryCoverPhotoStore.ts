import type { CoverPhotoStore } from "../../../domain/ledger";

/** 測試用：照片放在記憶體裡，saveFrom 把來源位址當成檔案內容 */
export function createMemoryCoverPhotoStore(
  initial: Record<string, string> = {},
): CoverPhotoStore & { readonly files: Map<string, string> } {
  const files = new Map(Object.entries(initial));
  return {
    files,
    async saveFrom(name, sourceUri) {
      files.set(name, `from:${sourceUri}`);
    },
    async readBase64(name) {
      return files.get(name) ?? null;
    },
    async writeBase64(name, base64) {
      files.set(name, base64);
    },
    async list() {
      return [...files.keys()];
    },
    async delete(name) {
      files.delete(name);
    },
    uri(name) {
      return `memory://${name}`;
    },
  };
}
