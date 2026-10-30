import {
  orthographicVector,
  sphereVector,
  type GlobeProjection,
} from "../../../domain/map";

/*
 * 地球的 SVG 路徑（純函式）：海岸線、經緯線依目前視角投影，背面的部分裁掉。
 * 每一格都要把整個世界投影一次（約 2000 點），所以點先轉成球面向量存成扁平的
 * Float64Array [x0, y0, z0, x1, …]，投影時只剩乘法，字串也直接串接。
 */

/**
 * 解析 "lon,lat lon,lat …"，並在相距超過 step 度的兩點之間補點，
 * 投影後的弧線才不會變成直線切過地球。回傳扁平的經緯度 [lon0, lat0, lon1, …]。
 */
export function parseRing(text: string, step = 2.5): number[] {
  const points = text
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number));
  const flat: number[] = [];
  points.forEach(([lon, lat], i) => {
    const [nextLon, nextLat] = points[(i + 1) % points.length];
    const n = Math.max(
      1,
      Math.ceil(
        Math.max(Math.abs(nextLon - lon), Math.abs(nextLat - lat)) / step,
      ),
    );
    for (let j = 0; j < n; j++) {
      flat.push(
        lon + ((nextLon - lon) * j) / n,
        lat + ((nextLat - lat) * j) / n,
      );
    }
  });
  return flat;
}

/** 扁平經緯度轉成球面向量，給 ringPath、linePath */
export function toSphere(lonLat: readonly number[]): Float64Array {
  const out = new Float64Array((lonLat.length / 2) * 3);
  for (let i = 0; i < lonLat.length / 2; i++) {
    out.set(sphereVector(lonLat[2 * i], lonLat[2 * i + 1]), i * 3);
  }
  return out;
}

/** 經線每 30 度、緯線每 30 度（不含極區），每 4 度一點；回傳扁平經緯度 */
export function graticuleLines(): number[][] {
  const lines: number[][] = [];
  for (let lon = -180; lon < 180; lon += 30) {
    const line: number[] = [];
    for (let lat = -80; lat <= 80; lat += 4) line.push(lon, lat);
    lines.push(line);
  }
  for (const lat of [-60, -30, 0, 30, 60]) {
    const line: number[] = [];
    for (let lon = -180; lon <= 180; lon += 4) line.push(lon, lat);
    lines.push(line);
  }
  return lines;
}

/**
 * 封閉的陸地輪廓：整圈都在背面時回傳空字串；跨過地平線時，
 * 看不到的那段改成沿著地球邊緣走較短的弧，填色才不會漏到地球外面。
 */
export function ringPath(ring: Float64Array, p: GlobeProjection): string {
  const n = ring.length / 3;
  const { xs, ys, zs, visible } = project(ring, p);
  if (visible === 0) return "";
  if (visible === n) {
    let d = `M${screen(p, xs[0], ys[0])}`;
    for (let i = 1; i < n; i++) d += `L${screen(p, xs[i], ys[i])}`;
    return `${d}Z`;
  }

  // Start right after the ring comes back into view, so the walk ends where it started
  let start = 0;
  for (let i = 0; i < n; i++) {
    if (zs[i] > 0 && zs[(i - 1 + n) % n] <= 0) {
      start = i;
      break;
    }
  }
  let d = "";
  const add = (x: number, y: number) => {
    d += `${d ? "L" : "M"}${screen(p, x, y)}`;
  };
  let exitAngle = 0;
  for (let j = 0; j < n; j++) {
    const a = (start + j) % n;
    const b = (start + j + 1) % n;
    const aVisible = zs[a] > 0;
    const bVisible = zs[b] > 0;
    if (aVisible) add(xs[a], ys[a]);
    if (aVisible && !bVisible) {
      const [x, y] = horizon(xs, ys, zs, a, b);
      add(x, y);
      exitAngle = Math.atan2(y, x);
    } else if (!aVisible && bVisible) {
      const [x, y] = horizon(xs, ys, zs, a, b);
      const entryAngle = Math.atan2(y, x);
      let delta = entryAngle - exitAngle;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      const steps = Math.ceil(Math.abs(delta) / 0.1);
      for (let k = 1; k < steps; k++) {
        const angle = exitAngle + (delta * k) / steps;
        add(Math.cos(angle), Math.sin(angle));
      }
      add(x, y);
    }
  }
  return `${d}Z`;
}

/** 不封閉的線（經緯線）：只畫正面的段落 */
export function linePath(line: Float64Array, p: GlobeProjection): string {
  const { xs, ys, zs } = project(line, p);
  let d = "";
  let run = "";
  let runLength = 0;
  for (let i = 0; i < xs.length; i++) {
    if (zs[i] > 0) {
      run += `${runLength ? "L" : "M"}${screen(p, xs[i], ys[i])}`;
      runLength++;
    } else {
      if (runLength > 1) d += run;
      run = "";
      runLength = 0;
    }
  }
  if (runLength > 1) d += run;
  return d;
}

function project(points: Float64Array, p: GlobeProjection) {
  const n = points.length / 3;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const zs = new Float64Array(n);
  let visible = 0;
  for (let i = 0; i < n; i++) {
    const [x, y, z] = orthographicVector(
      p,
      points[3 * i],
      points[3 * i + 1],
      points[3 * i + 2],
    );
    xs[i] = x;
    ys[i] = y;
    zs[i] = z;
    if (z > 0) visible++;
  }
  return { xs, ys, zs, visible };
}

/** 線段 a→b 和地平線（z = 0）的交點，投影到地球邊緣上 */
function horizon(
  xs: Float64Array,
  ys: Float64Array,
  zs: Float64Array,
  a: number,
  b: number,
): [x: number, y: number] {
  const t = zs[a] / (zs[a] - zs[b]);
  const x = xs[a] + t * (xs[b] - xs[a]);
  const y = ys[a] + t * (ys[b] - ys[a]);
  const m = Math.hypot(x, y) || 1;
  return [x / m, y / m];
}

/** 畫面座標字串，取到小數一位 */
function screen(p: GlobeProjection, x: number, y: number): string {
  return `${Math.round((p.cx + p.scale * x) * 10) / 10} ${Math.round((p.cy - p.scale * y) * 10) / 10}`;
}
