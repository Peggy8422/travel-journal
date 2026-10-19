import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

export interface FocusedQuery<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly reload: () => void;
}

/**
 * 畫面每次取得焦點時重新讀取資料（例如從新增消費頁返回帳本明細）。
 * load 必須用 useCallback 包起來，否則每次 render 都會重新讀取。
 */
export function useFocusedQuery<T>(load: () => Promise<T>): FocusedQuery<T> {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ data?: T; error?: unknown }>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load().then(
        (data) => active && setState({ data }),
        (error: unknown) => active && setState({ error }),
      );
      return () => {
        active = false;
      };
      // version is a dependency so reload() re-runs the query
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, version]),
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: state.data, error: state.error, reload };
}
