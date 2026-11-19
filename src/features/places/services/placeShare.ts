import type {
  RatingCriterionRecord,
  SavedPlaceRecord,
} from "../../../domain/places";

/*
 * 收藏地點分享到 IG：卡片上列哪些分數、貼文文字怎麼寫。卡片長相在 PlaceShareCard。
 */

/** 卡片上的分數：依評分項目的順序，找不到項目的分數略過 */
export function shareRatings(
  place: Pick<SavedPlaceRecord, "ratings">,
  criteria: readonly RatingCriterionRecord[],
): readonly { readonly label: string; readonly score: number }[] {
  return place.ratings.flatMap((rating) => {
    const criterion = criteria.find((c) => c.id === rating.criterionId);
    return criterion ? [{ label: criterion.label, score: rating.score }] : [];
  });
}

/**
 * 貼在 IG 說明欄的文字：名稱、城市與類型、想去或去過（去過再加分數與「還想再去」），
 * 有寫心得時空一行接在後面。kindLabel 是類型的中文名稱（畫面層才有）。
 */
export function placeCaption(
  place: Pick<
    SavedPlaceRecord,
    "name" | "city" | "status" | "ratings" | "revisit" | "note"
  >,
  criteria: readonly RatingCriterionRecord[],
  kindLabel: string,
): string {
  const visited = place.status === "visited";
  const scores = shareRatings(place, criteria)
    .map((r) => `${r.label} ${r.score}`)
    .join(" · ");
  const status = visited
    ? [
        "去過",
        ...(scores ? [scores] : []),
        ...(place.revisit ? ["還想再去"] : []),
      ]
    : ["想去"];
  const lines = [
    place.name,
    [place.city, kindLabel].filter((part) => part !== "").join("・"),
    status.join("・"),
  ];
  const note = place.note.trim();
  return note ? `${lines.join("\n")}\n\n${note}` : lines.join("\n");
}
