import type { ReactNode } from "react";
import Svg, { Defs, G, Mask, Path, Rect } from "react-native-svg";

import {
  ILLUSTRATION_CANVAS,
  strokePath,
  strokesBounds,
  type DrawBounds,
  type IllustrationStroke,
} from "../../../domain/journal";
import { INK_COLORS, WASH_OPACITY } from "./inks";
import { pencilLook } from "./pencil";

/**
 * 畫出一張插圖。crop 為 true 時只留有畫的地方（縮圖、貼紙），
 * 否則是整張 1000×1000 的畫布（畫板）。圖會等比例縮放、置中放進 width × height。
 *
 * 橡皮擦的筆畫會擦掉它之前畫的東西：預設用 Mask 挖掉，底下的頁面會透出來；
 * 背景是單色的紙（畫板）時傳 paper，直接用紙的顏色蓋掉，不用每一格都算 Mask。
 */
export function IllustrationArt({
  strokes,
  width,
  height,
  crop = true,
  paper,
}: {
  strokes: readonly IllustrationStroke[];
  width: number;
  height: number;
  crop?: boolean;
  paper?: string;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={viewBoxOf(strokes, crop)}
      pointerEvents="none"
    >
      {layersOf(strokes, paper)}
    </Svg>
  );
}

/** Mask 蓋住整張畫布再多一點（筆寬會超出畫布邊緣） */
const MASK_AREA = {
  x: -100,
  y: -100,
  width: ILLUSTRATION_CANVAS + 200,
  height: ILLUSTRATION_CANVAS + 200,
} as const;

function layersOf(
  strokes: readonly IllustrationStroke[],
  paper: string | undefined,
): ReactNode {
  const defs: ReactNode[] = [];
  let content: ReactNode[] = [];
  let i = 0;
  while (i < strokes.length) {
    const tool = strokes[i]!.tool;
    let end = i + 1;
    // Neighbouring pencil strokes share one grain mask, neighbouring erasers one cut-out
    if (tool === "pencil" || tool === "eraser") {
      while (end < strokes.length && strokes[end]!.tool === tool) end++;
    }
    const run = strokes.slice(i, end);
    if (tool === "eraser") {
      if (paper !== undefined) {
        content.push(
          ...run.map((stroke, k) => (
            <Line key={`erase${i + k}`} stroke={stroke} color={paper} />
          )),
        );
      } else if (content.length > 0) {
        const id = `erase${i}`;
        defs.push(
          <Mask key={id} id={id} maskUnits="userSpaceOnUse" {...MASK_AREA}>
            <Rect {...MASK_AREA} fill="white" />
            {run.map((stroke, k) => (
              <Line key={k} stroke={stroke} color="black" />
            ))}
          </Mask>,
        );
        content = [
          <G key={id} mask={`url(#${id})`}>
            {content}
          </G>,
        ];
      }
    } else if (tool === "pencil") {
      const id = `grain${i}`;
      const looks = run.map(pencilLook);
      defs.push(
        <Mask key={id} id={id} maskUnits="userSpaceOnUse" {...MASK_AREA}>
          <Rect {...MASK_AREA} fill="white" />
          {looks.flatMap((look, k) =>
            look.specks.map((layer, l) => {
              const v = Math.round(layer.ink * 255);
              return (
                <Path
                  key={`${k}-${l}`}
                  d={layer.d}
                  fill={`rgb(${v},${v},${v})`}
                />
              );
            }),
          )}
        </Mask>,
      );
      content.push(
        <G key={id} mask={`url(#${id})`}>
          {looks.flatMap((look, k) =>
            look.lines.map((line, l) => (
              <Path
                key={`${k}-${l}`}
                d={line.d}
                fill="none"
                stroke={INK_COLORS[run[k]!.ink].color}
                strokeOpacity={line.opacity}
                strokeWidth={line.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )),
          )}
        </G>,
      );
    } else {
      const stroke = strokes[i]!;
      content.push(
        <Line
          key={`line${i}`}
          stroke={stroke}
          color={INK_COLORS[stroke.ink].color}
          opacity={stroke.tool === "wash" ? WASH_OPACITY : 1}
        />,
      );
    }
    i = end;
  }
  return (
    <>
      {defs.length > 0 && <Defs>{defs}</Defs>}
      {content}
    </>
  );
}

function Line({
  stroke,
  color,
  opacity = 1,
}: {
  stroke: IllustrationStroke;
  color: string;
  opacity?: number;
}) {
  return (
    <Path
      d={strokePath(stroke.points)}
      fill="none"
      stroke={color}
      strokeOpacity={opacity}
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function viewBoxOf(
  strokes: readonly IllustrationStroke[],
  crop: boolean,
): string {
  const box = crop
    ? cropBoxOf(strokes)
    : { x: 0, y: 0, width: ILLUSTRATION_CANVAS, height: ILLUSTRATION_CANVAS };
  return [box.x, box.y, box.width, box.height].join(" ");
}

/** 貼紙拖曳時每一格都要用到範圍，同一份筆畫只算一次 */
const cropBoxes = new WeakMap<readonly IllustrationStroke[], DrawBounds>();

/** 裁切後的範圍（畫布單位）：有畫的地方再留一點邊；沒有筆畫時是整張畫布 */
export function cropBoxOf(strokes: readonly IllustrationStroke[]): DrawBounds {
  const cached = cropBoxes.get(strokes);
  if (cached) return cached;
  const bounds = strokesBounds(strokes);
  // A little air around the drawing so round caps are not clipped
  const pad = bounds ? Math.max(bounds.width, bounds.height) * 0.04 + 2 : 0;
  const box = bounds
    ? {
        x: bounds.x - pad,
        y: bounds.y - pad,
        width: bounds.width + pad * 2,
        height: bounds.height + pad * 2,
      }
    : { x: 0, y: 0, width: ILLUSTRATION_CANVAS, height: ILLUSTRATION_CANVAS };
  cropBoxes.set(strokes, box);
  return box;
}

/** 裁切後的高寬比，貼紙的高是寬乘上它 */
export function aspectOf(strokes: readonly IllustrationStroke[]): number {
  const box = cropBoxOf(strokes);
  return box.height / box.width;
}
