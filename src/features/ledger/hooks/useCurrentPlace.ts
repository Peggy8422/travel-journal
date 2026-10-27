import { useCallback, useEffect, useRef, useState } from "react";

import { createDeviceLocator } from "../../../data/location/deviceLocator";
import { ok, type Result } from "../../../domain/common/result";
import type { GeoPoint } from "../../../domain/ledger";
import type { DeviceLocator } from "../../../domain/location";
import {
  describePosition,
  lastKnownPositionIfAllowed,
  locateCurrentPlace,
  type LocatedPlace,
  type LocateError,
} from "../services/locateCurrentPlace";

export type CurrentPlaceState =
  | { readonly status: "idle" }
  | { readonly status: "locating" }
  | {
      readonly status: "done";
      readonly result: Result<LocatedPlace, LocateError>;
    };

const defaultLocator = createDeviceLocator();

/**
 * 按下「使用目前位置」時才定位，不會在開啟畫面時自動要求權限。
 * locate、describe 會回傳結果，讓表單決定要不要覆蓋使用者已輸入的地名。
 */
export function useCurrentPlace(locator: DeviceLocator = defaultLocator): {
  state: CurrentPlaceState;
  locate: () => Promise<Result<LocatedPlace, LocateError> | undefined>;
  /** 在地圖上選了地點後，查它的預設地名 */
  describe: (
    location: GeoPoint,
  ) => Promise<Result<LocatedPlace, LocateError> | undefined>;
  /** 地圖選點一開始要看的位置；不會要求權限 */
  startPoint: () => Promise<GeoPoint | null>;
} {
  const [state, setState] = useState<CurrentPlaceState>({ status: "idle" });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (task: () => Promise<Result<LocatedPlace, LocateError>>) => {
      setState({ status: "locating" });
      const result = await task();
      // 定位可能要好幾秒，畫面已關閉就不更新
      if (!mounted.current) return undefined;
      setState({ status: "done", result });
      return result;
    },
    [],
  );

  const locate = useCallback(
    () => run(() => locateCurrentPlace(locator)),
    [run, locator],
  );
  const describe = useCallback(
    (location: GeoPoint) =>
      run(async () =>
        ok(await describePosition(locator, { location, approximate: false })),
      ),
    [run, locator],
  );
  const startPoint = useCallback(
    () => lastKnownPositionIfAllowed(locator),
    [locator],
  );

  return { state, locate, describe, startPoint };
}
