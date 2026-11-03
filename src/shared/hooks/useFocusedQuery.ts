import { useFocusEffect } from "expo-router";
import { useCallback, useState, useSyncExternalStore } from "react";

export interface FocusedQuery<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly reload: () => void;
}

// Bumped by notifyDataChanged so the screen in front reloads without a focus change
let dataVersion = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 通知目前在前景的畫面重新讀取。一般寫入不用呼叫（回到畫面時本來就會重讀），
 * 只有在畫面沒換、資料卻變了時才需要，例如刪除後在提示紙條上按「復原」。
 */
export function notifyDataChanged(): void {
  dataVersion += 1;
  listeners.forEach((listener) => listener());
}

/**
 * 畫面每次取得焦點時重新讀取資料（例如從新增消費頁返回帳本明細），
 * notifyDataChanged 也會讓正在顯示的畫面重讀。
 * load 必須用 useCallback 包起來，否則每次 render 都會重新讀取。
 */
export function useFocusedQuery<T>(load: () => Promise<T>): FocusedQuery<T> {
  const [version, setVersion] = useState(0);
  const changed = useSyncExternalStore(subscribe, () => dataVersion);
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
      // version and changed are dependencies so reload() and
      // notifyDataChanged() re-run the query
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, version, changed]),
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: state.data, error: state.error, reload };
}
