/*
 * 甜甜圈圖的幾何計算（純函式，不依賴 React Native，方便測試）。
 * 角度單位為弧度，0 在正上方，順時針增加。
 */

export interface DonutArc {
  readonly key: string;
  readonly startAngle: number;
  readonly endAngle: number;
}

const FULL_CIRCLE = Math.PI * 2;

/**
 * 依數值比例切出每一段的角度，段與段之間留 gapAngle 的空隙。
 * 數值為 0 的項目不產生弧；只有一段時佔滿整圈、不留空隙。
 */
export function computeDonutArcs(
  items: readonly { readonly key: string; readonly value: number }[],
  gapAngle: number,
): DonutArc[] {
  const visible = items.filter((item) => item.value > 0);
  const total = visible.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];
  if (visible.length === 1) {
    return [{ key: visible[0]!.key, startAngle: 0, endAngle: FULL_CIRCLE }];
  }

  const arcs: DonutArc[] = [];
  let cursor = 0;
  for (const item of visible) {
    const span = (item.value / total) * FULL_CIRCLE;
    // 很小的段落若扣掉空隙會消失，至少保留一半的寬度
    const gap = Math.min(gapAngle, span / 2);
    arcs.push({
      key: item.key,
      startAngle: cursor + gap / 2,
      endAngle: cursor + span - gap / 2,
    });
    cursor += span;
  }
  return arcs;
}

/** 圓周上某個角度的座標 */
export function pointOnCircle(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: cx + radius * Math.sin(angle),
    y: cy - radius * Math.cos(angle),
  };
}

/**
 * 一段圓弧的 SVG 路徑（用 stroke 畫出環的粗細）。
 * 不能用來畫整圈，整圈請改用 Circle。
 */
export function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = pointOnCircle(cx, cy, radius, startAngle);
  const end = pointOnCircle(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const f = (n: number) => Number(n.toFixed(3));
  return `M ${f(start.x)} ${f(start.y)} A ${radius} ${radius} 0 ${largeArc} 1 ${f(end.x)} ${f(end.y)}`;
}
