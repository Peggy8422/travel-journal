import { useState, type ComponentRef } from "react";
import type { ScrollView, View } from "react-native";

type ViewInstance = ComponentRef<typeof View>;
type ScrollInstance = ComponentRef<typeof ScrollView>;

/**
 * 表單送出時某一欄有錯，把那一欄捲進畫面：錯誤寫在欄位下面，但按「儲存」時那一欄可能在畫面外。
 * scrollRef、contentRef 交給 Screen，欄位外層的 View 用 field("名稱") 當 ref。
 * 用 class 存 ref，避開 React Compiler 對 render 時讀 ref 的限制（同 useGlobeMotion）。
 */
export function useFieldScroller(): FieldScroller {
  const [scroller] = useState(() => new FieldScroller());
  return scroller;
}

class FieldScroller {
  private scroll: ScrollInstance | null = null;
  private content: ViewInstance | null = null;
  private readonly fields = new Map<string, ViewInstance>();
  private readonly refs = new Map<
    string,
    (view: ViewInstance | null) => void
  >();

  readonly scrollRef = (view: ScrollInstance | null) => {
    this.scroll = view;
  };

  readonly contentRef = (view: ViewInstance | null) => {
    this.content = view;
  };

  /** 欄位外層 View 的 ref；同一個名稱每次拿到同一個函式，重繪時不會重掛 */
  field(name: string): (view: ViewInstance | null) => void {
    let ref = this.refs.get(name);
    if (!ref) {
      ref = (view) => {
        if (view) this.fields.set(name, view);
        else this.fields.delete(name);
      };
      this.refs.set(name, ref);
    }
    return ref;
  }

  /** 把欄位捲到畫面上方附近（上面留一點空間給欄位標題） */
  scrollTo(name: string) {
    const field = this.fields.get(name);
    const content = this.content;
    if (!field || !content) return;
    field.measureLayout(content, (_x, y) =>
      this.scroll?.scrollTo({ y: Math.max(0, y - 24), animated: true }),
    );
  }
}
