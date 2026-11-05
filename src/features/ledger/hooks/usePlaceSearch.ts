import { useCallback, useEffect, useRef, useState } from "react";

import { createPlaceSearch } from "../../../data/location/placeSearch";
import type { Result } from "../../../domain/common/result";
import type { FoundPlace, PlaceSearch } from "../../../domain/location";
import type { MapRegion } from "../../../domain/map";
import { searchPlaces, type PlaceSearchError } from "../services/searchPlaces";

export type PlaceSearchState =
  | { readonly status: "idle" }
  | { readonly status: "searching"; readonly query: string }
  | {
      readonly status: "done";
      readonly query: string;
      readonly result: Result<readonly FoundPlace[], PlaceSearchError>;
    };

const defaultSearch = createPlaceSearch();

/**
 * 選擇地點畫面的搜尋框。available 是 false（Android）時畫面不顯示搜尋框。
 * 連續送出時只留最後一次的結果，避免慢回來的舊結果蓋掉新的。
 */
export function usePlaceSearch(search: PlaceSearch | null = defaultSearch): {
  available: boolean;
  state: PlaceSearchState;
  run: (query: string, near: MapRegion | null) => Promise<void>;
  clear: () => void;
} {
  const [state, setState] = useState<PlaceSearchState>({ status: "idle" });
  const latest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (query: string, near: MapRegion | null) => {
      const id = ++latest.current;
      const keyword = query.trim();
      if (!search || keyword === "") {
        setState({ status: "idle" });
        return;
      }
      setState({ status: "searching", query: keyword });
      const result = await searchPlaces(search, keyword, near);
      if (!mounted.current || id !== latest.current) return;
      setState({ status: "done", query: keyword, result });
    },
    [search],
  );

  const clear = useCallback(() => {
    latest.current += 1;
    setState({ status: "idle" });
  }, []);

  return { available: search !== null, state, run, clear };
}
