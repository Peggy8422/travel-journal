import { describeError } from "../../ledger/components/messages";
import {
  ShareModal,
  SharePreview,
  type SharePageSpec,
} from "../../share/components/SharePreview";
import { useJournal } from "../hooks/useJournalQueries";
import type { JournalDetail } from "../services/journalCommands";
import { formatDateRange } from "../services/journalDates";
import { recapCaption, recapDays, recapStats } from "../services/shareRecap";
import { RecapCoverCard, RecapDayCard } from "./RecapShareCards";

/**
 * 分享整本手帳的回顧到 IG：封面一張，之後每天一張（輪播貼文）。
 */
export function ShareJournalScreen({ journalId }: { journalId: string }) {
  const { data, error } = useJournal(journalId);
  return (
    <ShareModal
      error={
        error
          ? "讀取手帳失敗"
          : data && !data.ok
            ? describeError(data.error)
            : data?.ok && data.value.entries.length === 0
              ? "這本手帳還沒有日記"
              : null
      }
    >
      {data?.ok && data.value.entries.length > 0 && (
        <SharePreview
          formats={{ post: recapSpecs(data.value) }}
          caption={recapCaption(
            data.value.journal.name,
            formatDateRange(data.value.firstDate, data.value.lastDate),
            recapStats(data.value.entries),
          )}
        />
      )}
    </ShareModal>
  );
}

function recapSpecs(detail: JournalDetail): readonly SharePageSpec[] {
  const { journal, entries } = detail;
  const days = recapDays(entries);
  const stats = recapStats(entries);
  const range = formatDateRange(detail.firstDate, detail.lastDate) ?? "";
  return [
    {
      key: "recap:cover",
      label: "封面",
      photoCount: journal.cover.photo ? 1 : 0,
      render: ({ ref, onPhotoReady }) => (
        <RecapCoverCard
          ref={ref}
          journal={journal}
          range={range}
          stats={stats}
          onPhotoReady={onPhotoReady}
        />
      ),
    },
    ...days.map((day, index): SharePageSpec => ({
      key: `recap:${day.date}`,
      label: `Day ${day.dayNumber}`,
      photoCount: day.photo ? 1 : 0,
      render: ({ ref, onPhotoReady }) => (
        <RecapDayCard
          ref={ref}
          journal={journal}
          days={days}
          index={index}
          onPhotoReady={onPhotoReady}
        />
      ),
    })),
  ];
}
