import { useCallback, useEffect, useRef, useState } from "react";

import { createDeviceLocator } from "../../../data/location/deviceLocator";
import type { Result } from "../../../domain/common/result";
import type { DeviceLocator } from "../../../domain/location";
import {
  locateCurrentPosition,
  type LocatedPosition,
  type LocateError,
} from "../../ledger/services/locateCurrentPlace";

const defaultLocator = createDeviceLocator();

/**
 * 地圖上「顯示目前位置」按鈕用：按下時才要求權限，開啟分頁時不會跳出權限詢問。
 * 已經授權過的話，開啟時就讓 showsUser 為 true；否則在按鈕取得權限後才變成 true。
 */
export function useUserLocation(locator: DeviceLocator = defaultLocator): {
  locating: boolean;
  showsUser: boolean;
  locate: () => Promise<Result<LocatedPosition, LocateError> | undefined>;
} {
  const [locating, setLocating] = useState(false);
  const [showsUser, setShowsUser] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Checking never prompts; a failed check just leaves the button to ask
    locator
      .hasPermission()
      .then((granted) => {
        if (granted && mounted.current) setShowsUser(true);
      })
      .catch(() => undefined);
  }, [locator]);

  const locate = useCallback(async () => {
    setLocating(true);
    const result = await locateCurrentPosition(locator);
    // 定位可能要好幾秒，畫面已關閉就不更新
    if (!mounted.current) return undefined;
    setLocating(false);
    if (result.ok) setShowsUser(true);
    return result;
  }, [locator]);

  return { locating, showsUser, locate };
}
