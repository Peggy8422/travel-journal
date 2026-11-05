import { useEffect, useState } from "react";
import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderInstance,
} from "react-native";

import {
  ILLUSTRATION_CANVAS,
  ILLUSTRATION_STROKE_LIMIT,
  STROKE_POINT_LIMIT,
  type DrawPoint,
  type IllustrationInk,
  type IllustrationStroke,
  type IllustrationTool,
} from "../../../domain/journal";

/** 畫板目前的工具；橡皮擦也是一筆筆畫，擦掉它之前畫的東西被劃過的地方 */
export interface PadBrush {
  readonly tool: IllustrationTool;
  readonly ink: IllustrationInk;
  /** 筆寬，畫布單位 */
  readonly width: number;
}

export interface PadSnapshot {
  readonly strokes: readonly IllustrationStroke[];
  /** 手指還沒放開的那一筆 */
  readonly live: IllustrationStroke | null;
  readonly canUndo: boolean;
  /** 和打開畫板時不一樣（離開前要確認） */
  readonly dirty: boolean;
  /** 筆畫數到上限，不能再畫新的一筆 */
  readonly full: boolean;
}

/** 相鄰兩點至少隔多遠（畫布單位）才記下來，手指停著不動時不會一直累積點 */
const MIN_POINT_GAP = 3;

/**
 * 畫板的筆畫、復原紀錄與手勢。每次移動都會變，所以放在 class 裡，
 * 畫面只拿 snapshot（React Compiler 不允許 render 時讀 ref）。
 */
export function useDrawingPad(
  initial: readonly IllustrationStroke[],
  brush: PadBrush,
) {
  const [pad] = useState(() => new DrawingPad(initial));
  const [snapshot, setSnapshot] = useState(() => pad.snapshot());
  useEffect(() => {
    pad.listen(() => setSnapshot(pad.snapshot()));
    return () => pad.listen(null);
  }, [pad]);
  useEffect(() => {
    pad.setBrush(brush);
  }, [pad, brush]);

  return {
    snapshot,
    panHandlers: pad.panResponder.panHandlers,
    /** 畫布在螢幕上的寬度（px），換算觸控位置用 */
    setCanvasWidth: (width: number) => pad.setCanvasWidth(width),
    undo: () => pad.undo(),
  };
}

class DrawingPad {
  private readonly initial: readonly IllustrationStroke[];
  private strokes: readonly IllustrationStroke[];
  /** 每一步之前的筆畫，最後一個是上一步 */
  private history: (readonly IllustrationStroke[])[] = [];
  private live: IllustrationStroke | null = null;
  /** 這次手勢開始前的筆畫；很長的一筆會拆成好幾筆，手勢結束時才記成一步 */
  private before: readonly IllustrationStroke[] | null = null;
  private brush: PadBrush = { tool: "pen", ink: "sumi", width: 14 };
  /** 每 px 是幾個畫布單位 */
  private scale = 1;
  private onChange: (() => void) | null = null;
  readonly panResponder: PanResponderInstance;

  constructor(initial: readonly IllustrationStroke[]) {
    this.initial = initial;
    this.strokes = initial;
    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Keep the finger even if a parent wants to scroll
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => this.start(this.pointOf(event)),
      onPanResponderMove: (event) => {
        // A second finger is ignored, not drawn
        if (event.nativeEvent.touches.length > 1) return;
        this.move(this.pointOf(event));
      },
      onPanResponderRelease: () => this.end(),
      onPanResponderTerminate: () => this.end(),
    });
  }

  listen(onChange: (() => void) | null) {
    this.onChange = onChange;
  }

  setBrush(brush: PadBrush) {
    this.brush = brush;
  }

  setCanvasWidth(width: number) {
    if (width > 0) this.scale = ILLUSTRATION_CANVAS / width;
  }

  snapshot(): PadSnapshot {
    return {
      strokes: this.strokes,
      live: this.live,
      canUndo: this.history.length > 0,
      dirty: this.strokes !== this.initial,
      full: this.strokes.length >= ILLUSTRATION_STROKE_LIMIT,
    };
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return;
    this.strokes = previous;
    this.changed();
  }

  private pointOf(event: GestureResponderEvent): DrawPoint {
    const { locationX, locationY } = event.nativeEvent;
    const clamp = (v: number) =>
      Math.min(ILLUSTRATION_CANVAS, Math.max(0, Math.round(v * this.scale)));
    return [clamp(locationX), clamp(locationY)];
  }

  private start(point: DrawPoint) {
    this.before = this.strokes;
    const { tool, ink, width } = this.brush;
    if (this.strokes.length >= ILLUSTRATION_STROKE_LIMIT) {
      this.changed();
      return;
    }
    this.live = { tool, ink, width, points: [point] };
    this.changed();
  }

  private move(point: DrawPoint) {
    const live = this.live;
    if (!live) return;
    const last = live.points[live.points.length - 1]!;
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_POINT_GAP) {
      return;
    }
    if (live.points.length >= STROKE_POINT_LIMIT) {
      // A very long line carries on as a new stroke from the same spot
      this.strokes = [...this.strokes, live];
      if (this.strokes.length >= ILLUSTRATION_STROKE_LIMIT) {
        this.live = null;
        this.changed();
        return;
      }
      this.live = { ...live, points: [last, point] };
    } else {
      this.live = { ...live, points: [...live.points, point] };
    }
    this.changed();
  }

  private end() {
    if (this.live) {
      this.strokes = [...this.strokes, this.live];
      this.live = null;
    }
    if (this.before && this.strokes !== this.before) {
      this.history.push(this.before);
    }
    this.before = null;
    this.changed();
  }

  private changed() {
    this.onChange?.();
  }
}
