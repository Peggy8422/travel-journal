import { describeError } from "../../ledger/components/messages";
import { ShareModal, SharePreview } from "../../share/components/SharePreview";
import { usePlace } from "../hooks/usePlaceQueries";
import { placeCaption } from "../services/placeShare";
import { PLACE_KIND_STYLES } from "./placeKinds";
import { PlaceShareCard } from "./PlaceShareCard";

/** 分享一個收藏的地點到 IG：一張地點卡 */
export function SharePlaceScreen({ placeId }: { placeId: string }) {
  const { data, error } = usePlace(placeId);
  return (
    <ShareModal
      error={
        error
          ? "讀取地點失敗"
          : data && !data.ok
            ? describeError(data.error)
            : null
      }
    >
      {data?.ok && (
        <SharePreview
          formats={{
            post: [
              {
                key: "place",
                label: "地點卡",
                photoCount: data.value.place.photos.length > 0 ? 1 : 0,
                render: ({ ref, onPhotoReady }) => (
                  <PlaceShareCard
                    ref={ref}
                    place={data.value.place}
                    criteria={data.value.criteria}
                    onPhotoReady={onPhotoReady}
                  />
                ),
              },
            ],
          }}
          caption={placeCaption(
            data.value.place,
            data.value.criteria,
            PLACE_KIND_STYLES[data.value.place.kind].label,
          )}
        />
      )}
    </ShareModal>
  );
}
