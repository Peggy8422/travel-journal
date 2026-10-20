import { useCallback, useEffect, useRef, useState } from "react";

import { createDeviceLocator } from "../../../data/location/deviceLocator";
import type { Result } from "../../../domain/common/result";
import type { DeviceLocator } from "../../../domain/location";
import {
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
 * locate 會回傳結果，讓表單決定要不要覆蓋使用者已輸入的地名。
 */
export function useCurrentPlace(locator: DeviceLocator = defaultLocator): {
  state: CurrentPlaceState;
  locate: () => Promise<Result<LocatedPlace, LocateError> | undefined>;
} {
  const [state, setState] = useState<CurrentPlaceState>({ status: "idle" });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const locate = useCallback(async () => {
    setState({ status: "locating" });
    const result = await locateCurrentPlace(locator);
    // 定位可能要好幾秒，畫面已關閉就不更新
    if (!mounted.current) return undefined;
    setState({ status: "done", result });
    return result;
  }, [locator]);

  return { state, locate };
}
