import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { PanResponder, type PanResponderInstance } from "react-native";

import {
  approachView,
  GLOBE_HOME,
  GLOBE_LAT_RANGE,
  wrapLongitude,
  type GlobeView,
} from "../../../domain/map";

/** 一格畫面：視角與繞著地球的紙飛機位置（弧度） */
export interface GlobeFrame {
  readonly view: GlobeView;
  readonly plane: number;
}

interface MotionOptions {
  /** 放大倍率 1 時地球的半徑（px），拖曳換算角度用 */
  readonly radius: number;
  /** 沒選帳本時地球中心的 y */
  readonly idleCy: number;
  readonly spinning: boolean;
  readonly animate: boolean;
}

/** 約 24 fps：稍微一格一格的轉動配手繪風格剛好，也比較省電 */
const FRAME_MS = 41;
/** 待機時在台灣附近左右擺動：幅度（經度）與一個來回的秒數 */
const SWAY_DEGREES = 26;
const SWAY_SECONDS = 18;
/** 手放開後停多久才繼續擺動 */
const HOLD_AFTER_DRAG_MS = 2500;
/** 放大到這個倍率以下才看得到軌道與紙飛機，要持續重畫 */
const DECOR_MAX_ZOOM = 1.25;

/**
 * 地球的動畫與拖曳。畫面取得焦點時才跑（約 24 fps），每一格只在有變化時重畫。
 * - spinning：沒選帳本時在台灣附近慢慢擺動
 * - flyTo：緩動到指定視角；拖曳時會取消
 * - animate 為 false（系統的「減少動態效果」）時不擺動、紙飛機停住，flyTo 直接跳到目標
 */
export function useGlobeMotion(options: MotionOptions) {
  const [frame, setFrame] = useState<GlobeFrame>(() => ({
    view: {
      lon: GLOBE_HOME.lon,
      lat: GLOBE_HOME.lat,
      k: 1,
      cy: options.idleCy,
    },
    plane: 0,
  }));
  const [motion] = useState(() => new GlobeMotion(frame.view, options));
  const { radius, idleCy, spinning, animate } = options;
  useEffect(() => {
    motion.setOptions({ radius, idleCy, spinning, animate });
  }, [motion, radius, idleCy, spinning, animate]);

  useFocusEffect(
    useCallback(() => {
      let raf = 0;
      let lastPaint = 0;
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        if (now - lastPaint < FRAME_MS) return;
        const dt = lastPaint ? Math.min((now - lastPaint) / 1000, 0.1) : 0.04;
        lastPaint = now;
        if (motion.step(dt, now)) setFrame(motion.frame());
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, [motion]),
  );

  /** 緩動到指定視角（減少動態效果時直接跳過去） */
  const flyTo = useCallback(
    (target: GlobeView) => {
      if (motion.flyTo(target)) setFrame(motion.frame());
    },
    [motion],
  );

  /** 直接跳到指定視角，不緩動 */
  const jumpTo = useCallback(
    (view: GlobeView) => {
      motion.jumpTo(view);
      setFrame(motion.frame());
    },
    [motion],
  );

  /** 轉回台灣、縮回整顆地球，之後照常擺動 */
  const goHome = useCallback(
    (cy: number) => {
      if (motion.goHome(cy)) setFrame(motion.frame());
    },
    [motion],
  );

  return {
    frame,
    panHandlers: motion.panResponder.panHandlers,
    flyTo,
    jumpTo,
    goHome,
  };
}

/** 地球的動態狀態；每一格都會改，所以不放在 React state，畫面只拿 frame() 的快照 */
class GlobeMotion {
  private view: GlobeView;
  private target: GlobeView | null = null;
  private plane = 0;
  /** 開始拖曳時的視角 */
  private drag: { lon: number; lat: number } | null = null;
  private holdUntil = 0;
  /** 已經轉回台灣、開始擺動；swayT 是擺動經過的秒數 */
  private swayArmed = false;
  private swayT = 0;
  private options: MotionOptions;
  readonly panResponder: PanResponderInstance;

  constructor(view: GlobeView, options: MotionOptions) {
    this.view = view;
    this.options = options;
    this.panResponder = PanResponder.create({
      // Only a real drag takes over, so taps still reach the pins
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) + Math.abs(g.dy) > 5,
      onPanResponderGrant: () => {
        this.drag = { lon: this.view.lon, lat: this.view.lat };
        this.target = null;
        this.swayArmed = false;
      },
      onPanResponderMove: (_, g) => {
        if (!this.drag) return;
        // Pixels per degree on the current globe
        const perDegree = (this.options.radius * this.view.k * Math.PI) / 180;
        this.view = {
          ...this.view,
          lon: wrapLongitude(this.drag.lon - g.dx / perDegree),
          lat: Math.max(
            GLOBE_LAT_RANGE.min,
            Math.min(GLOBE_LAT_RANGE.max, this.drag.lat + g.dy / perDegree),
          ),
        };
      },
      onPanResponderRelease: () => this.endDrag(),
      onPanResponderTerminate: () => this.endDrag(),
    });
  }

  setOptions(options: MotionOptions) {
    this.options = options;
  }

  frame(): GlobeFrame {
    return { view: this.view, plane: this.plane };
  }

  /** 回傳 true 代表直接跳到目標了，畫面要立刻重畫 */
  flyTo(target: GlobeView): boolean {
    this.swayArmed = false;
    if (this.options.animate) {
      this.target = target;
      return false;
    }
    this.view = target;
    this.target = null;
    return true;
  }

  jumpTo(view: GlobeView) {
    this.swayArmed = false;
    this.view = view;
    this.target = null;
  }

  goHome(cy: number): boolean {
    const jumped = this.flyTo({
      lon: GLOBE_HOME.lon,
      lat: GLOBE_HOME.lat,
      k: 1,
      cy,
    });
    this.swayArmed = true;
    this.holdUntil = 0;
    return jumped;
  }

  /** 推進一格；回傳畫面是否要重畫 */
  step(dt: number, now: number): boolean {
    const { idleCy, spinning, animate } = this.options;
    let moved = false;
    if (animate) this.plane = (this.plane + dt * 0.55) % (Math.PI * 2);
    if (this.drag) {
      moved = true;
    } else if (this.target) {
      const next = approachView(this.view, this.target, dt);
      this.view = next.view;
      if (next.arrived) {
        this.target = null;
        this.swayT = 0;
      }
      moved = true;
    } else if (spinning && animate && now > this.holdUntil) {
      if (!this.swayArmed) {
        // Swing back to Taiwan first, then start swaying from there
        this.swayArmed = true;
        this.target = {
          lon: GLOBE_HOME.lon,
          lat: GLOBE_HOME.lat,
          k: 1,
          cy: idleCy,
        };
      } else {
        this.swayT += dt;
        this.view = {
          ...this.view,
          lon:
            GLOBE_HOME.lon +
            SWAY_DEGREES * Math.sin((this.swayT * 2 * Math.PI) / SWAY_SECONDS),
          lat:
            this.view.lat + (GLOBE_HOME.lat - this.view.lat) * Math.min(1, dt),
        };
      }
      moved = true;
    }
    return moved || (animate && this.view.k < DECOR_MAX_ZOOM);
  }

  private endDrag() {
    if (!this.drag) return;
    this.drag = null;
    this.holdUntil = performance.now() + HOLD_AFTER_DRAG_MS;
  }
}
