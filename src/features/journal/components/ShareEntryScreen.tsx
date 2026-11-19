import { describeError } from "../../ledger/components/messages";
import {
  ShareModal,
  SharePreview,
  type SharePageSpec,
} from "../../share/components/SharePreview";
import type { ShareFormat } from "../../share/services/shareFormat";
import { useEntry } from "../hooks/useJournalQueries";
import type { EntryDetail } from "../services/entryCommands";
import {
  entrySharePages,
  shareCaption,
  sharePageLabel,
  sharePagePhotos,
} from "../services/shareEntry";
import { ShareCard } from "./ShareCards";

/**
 * 分享一篇日記到 IG：輪播貼文（封面、照片、文字、地點）或一張限動拼貼。
 */
export function ShareEntryScreen({ entryId }: { entryId: string }) {
  const { data, error } = useEntry(entryId);
  return (
    <ShareModal
      error={
        error
          ? "讀取日記失敗"
          : data && !data.ok
            ? describeError(data.error)
            : null
      }
    >
      {data?.ok && (
        <SharePreview
          formats={{
            post: entrySpecs(data.value, "post"),
            story: entrySpecs(data.value, "story"),
          }}
          caption={shareCaption(data.value)}
        />
      )}
    </ShareModal>
  );
}

function entrySpecs(
  detail: EntryDetail,
  format: ShareFormat,
): readonly SharePageSpec[] {
  return entrySharePages(detail.entry, format).map((page) => ({
    key: page.key,
    label: sharePageLabel(page),
    photoCount: sharePagePhotos(page, detail.entry).length,
    render: ({ ref, onPhotoReady }) => (
      <ShareCard
        ref={ref}
        detail={detail}
        page={page}
        onPhotoReady={onPhotoReady}
      />
    ),
  }));
}
