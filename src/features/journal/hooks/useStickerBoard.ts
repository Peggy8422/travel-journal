import { useEffect, useState } from "react";
import {
  PanResponder,
  type GestureResponderEvent,
  type NativeTouchEvent,
  type PanResponderInstance,
} from "react-native";

import {
  ENTRY_STICKER_LIMIT,
  hitSticker,
  normalizeAngle,
  STICKER_SIZE,
  type EntrySticker,
} from "../../../domain/journal";

export interface BoardSnapshot {
  readonly stickers: readonly EntrySticker[];
  /** 選取的貼紙（stickers 的索引），沒選時為 null */
  readonly selected: number | null;
  /** 手指正按在貼紙上：頁面這時不能捲動，否則拖曳會被捲動搶走 */
  readonly touching: boolean;
  /** 和打開時不一樣（離開前要確認） */
  readonly dirty: boolean;
  readonly full: boolean;
}

/** 新貼上去的插圖寬度（頁寬的比例） */
const NEW_STICKER_SIZE = 0.32;
/** 新貼上去的插圖輪流歪一點，看起來像手貼的 */
const NEW_STICKER_TILTS = [-6, 4, -3, 7] as const;
/** 點貼紙時框外再放寬幾 px，小貼紙才點得到 */
const HIT_SLOP_PX = 10;

/**
 * 日記頁「貼插圖」時的貼紙、選取與手勢：單指拖曳移動，兩指捏合縮放、轉動。
 * 每次移動都會變，所以和畫板一樣放在 class 裡，畫面只拿 snapshot。
 * aspectOf 是插圖的高寬比，點選貼紙時用。
 */
export function useStickerBoard(
  initial: readonly EntrySticker[],
  aspectOf: (illustrationId: string) => number,
) {
  const [board] = useState(() => new StickerBoard(initial));
  const [snapshot, setSnapshot] = useState(() => board.snapshot());
  useEffect(() => {
    board.listen(() => setSnapshot(board.snapshot()));
    return () => board.listen(null);
  }, [board]);
  useEffect(() => {
    board.setAspectOf(aspectOf);
  }, [board, aspectOf]);

  return {
    snapshot,
    panHandlers: board.panResponder.panHandlers,
    /** 頁面在螢幕上的大小（px），換算觸控位置、限制拖曳範圍用 */
    setPageSize: (width: number, height: number) =>
      board.setPageSize(width, height),
    /** 貼一張新的到離頁首 top px 的地方（橫向置中），並選取它 */
    add: (illustrationId: string, top: number) =>
      board.add(illustrationId, top),
    removeSelected: () => board.removeSelected(),
  };
}

type Grab =
  | {
      readonly mode: "drag";
      readonly start: EntrySticker;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly mode: "pinch";
      readonly start: EntrySticker;
      readonly midX: number;
      readonly midY: number;
      readonly distance: number;
      readonly angle: number;
    };

class StickerBoard {
  private readonly initial: readonly EntrySticker[];
  private stickers: readonly EntrySticker[];
  private selected: number | null = null;
  private grab: Grab | null = null;
  private pageWidth = 1;
  private pageHeight = 1;
  private aspectOf: (illustrationId: string) => number = () => 1;
  private onChange: (() => void) | null = null;
  readonly panResponder: PanResponderInstance;

  constructor(initial: readonly EntrySticker[]) {
    this.initial = initial;
    this.stickers = initial;
    this.panResponder = PanResponder.create({
      // Only a touch on a sticker is ours; anywhere else the page scrolls
      onStartShouldSetPanResponder: (event) => this.touchStart(event),
      onMoveShouldSetPanResponder: () => false,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => this.begin(event.nativeEvent.touches),
      onPanResponderMove: (event) => this.move(event.nativeEvent.touches),
      onPanResponderRelease: () => this.end(),
      onPanResponderTerminate: () => this.end(),
    });
  }

  listen(onChange: (() => void) | null) {
    this.onChange = onChange;
  }

  setAspectOf(aspectOf: (illustrationId: string) => number) {
    this.aspectOf = aspectOf;
  }

  setPageSize(width: number, height: number) {
    if (width > 0) this.pageWidth = width;
    if (height > 0) this.pageHeight = height;
  }

  snapshot(): BoardSnapshot {
    return {
      stickers: this.stickers,
      selected: this.selected,
      touching: this.grab !== null,
      dirty: this.stickers !== this.initial,
      full: this.stickers.length >= ENTRY_STICKER_LIMIT,
    };
  }

  add(illustrationId: string, top: number) {
    if (this.stickers.length >= ENTRY_STICKER_LIMIT) return;
    const y = clamp(top, 0, this.pageHeight) / this.pageWidth;
    const tilt = NEW_STICKER_TILTS[this.stickers.length % 4]!;
    this.stickers = [
      ...this.stickers,
      {
        illustrationId,
        x: 0.5,
        y: Math.max(NEW_STICKER_SIZE / 2, y),
        size: NEW_STICKER_SIZE,
        rotation: tilt,
      },
    ];
    this.selected = this.stickers.length - 1;
    this.changed();
  }

  removeSelected() {
    const selected = this.selected;
    if (selected === null) return;
    this.stickers = this.stickers.filter((_, i) => i !== selected);
    this.selected = null;
    this.changed();
  }

  private touchStart(event: GestureResponderEvent): boolean {
    // A second finger joins the sticker already held (pinch), wherever it lands
    if (this.grab !== null) return false;
    const { locationX, locationY } = event.nativeEvent;
    const hit = hitSticker(
      this.stickers,
      this.aspectOf,
      [locationX / this.pageWidth, locationY / this.pageWidth],
      HIT_SLOP_PX / this.pageWidth,
    );
    if (hit === null) {
      // Tapping the page itself drops the selection
      if (this.selected !== null) {
        this.selected = null;
        this.changed();
      }
      return false;
    }
    // The picked sticker comes to the top
    const picked = this.stickers[hit]!;
    this.stickers = [...this.stickers.filter((_, i) => i !== hit), picked];
    this.selected = this.stickers.length - 1;
    return true;
  }

  private begin(touches: readonly NativeTouchEvent[]) {
    const start = this.current();
    const [a, b] = touches;
    if (!start || !a) return;
    this.grab = b
      ? {
          mode: "pinch",
          start,
          midX: (a.pageX + b.pageX) / 2,
          midY: (a.pageY + b.pageY) / 2,
          distance: Math.max(
            1,
            Math.hypot(b.pageX - a.pageX, b.pageY - a.pageY),
          ),
          angle: Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX),
        }
      : { mode: "drag", start, x: a.pageX, y: a.pageY };
    this.changed();
  }

  private move(touches: readonly NativeTouchEvent[]) {
    const grab = this.grab;
    const [a, b] = touches;
    if (!grab || !a) return;
    // A finger was added or lifted: carry on from where the sticker is now
    if ((grab.mode === "pinch") !== (b !== undefined)) {
      this.begin(touches);
      return;
    }
    const { start } = grab;
    const unit = this.pageWidth;
    let next: EntrySticker;
    if (grab.mode === "drag") {
      next = {
        ...start,
        x: start.x + (a.pageX - grab.x) / unit,
        y: start.y + (a.pageY - grab.y) / unit,
      };
    } else {
      const other = b!;
      const distance = Math.hypot(other.pageX - a.pageX, other.pageY - a.pageY);
      const angle = Math.atan2(other.pageY - a.pageY, other.pageX - a.pageX);
      next = {
        ...start,
        x: start.x + ((a.pageX + other.pageX) / 2 - grab.midX) / unit,
        y: start.y + ((a.pageY + other.pageY) / 2 - grab.midY) / unit,
        size: clamp(
          (start.size * distance) / grab.distance,
          STICKER_SIZE.min,
          STICKER_SIZE.max,
        ),
        rotation: normalizeAngle(
          start.rotation + ((angle - grab.angle) * 180) / Math.PI,
        ),
      };
    }
    // Keep the centre on the page
    next = {
      ...next,
      x: clamp(next.x, 0, 1),
      y: clamp(next.y, 0, this.pageHeight / unit),
    };
    const index = this.stickers.length - 1;
    this.stickers = this.stickers.map((s, i) => (i === index ? next : s));
    this.changed();
  }

  private end() {
    this.grab = null;
    this.changed();
  }

  /** 正在動的貼紙一定是最上面那張（按下去時移到最後） */
  private current(): EntrySticker | undefined {
    return this.selected === null ? undefined : this.stickers[this.selected];
  }

  private changed() {
    this.onChange?.();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
