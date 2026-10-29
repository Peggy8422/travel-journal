import { StyleSheet } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";

import { globeProjection, type GlobeView } from "../../../domain/map";
import {
  graticuleLines,
  linePath,
  parseRing,
  ringPath,
  toSphere,
} from "./globeDrawing";
import { LAKE_RINGS, LAND_RINGS } from "./worldOutline";

const INK = "#3A332D";
const OCEAN = "#C8D8DF";
const LAND = "#E6D9B2";

// Parsed once; projected again on every frame
const land = LAND_RINGS.map((r) => toSphere(parseRing(r)));
const lakes = LAKE_RINGS.map((r) => toSphere(parseRing(r)));
const graticule = graticuleLines().map(toSphere);

/** 軌道傾斜的角度 */
const ORBIT_TILT = -16;

/**
 * 手繪地球：水彩海洋、紙色陸地、虛線經緯線、雙線外框；
 * 縮小看整顆地球時外圍有一圈虛線軌道和一架紙飛機。
 */
export function GlobeArt({
  view,
  plane,
  cx,
  radius,
}: {
  view: GlobeView;
  /** 紙飛機在軌道上的位置（弧度） */
  plane: number;
  cx: number;
  radius: number;
}) {
  const p = globeProjection(view, { cx, radius });
  const r = p.scale;
  const cy = view.cy;
  const landPath = land.map((ring) => ringPath(ring, p)).join("");
  const lakePath = lakes.map((ring) => ringPath(ring, p)).join("");
  const gridPath = graticule.map((line) => linePath(line, p)).join("");

  // The orbit and the plane fade out as soon as the globe zooms in
  const decor = Math.max(0, Math.min(1, 1 - (view.k - 1) * 3));
  const tilt = (ORBIT_TILT * Math.PI) / 180;
  const rx = r * 1.16;
  const ry = r * 0.3;
  const orbit = (t: number) => ({
    x:
      cx +
      rx * Math.cos(t) * Math.cos(tilt) -
      ry * Math.sin(t) * Math.sin(tilt),
    y:
      cy +
      rx * Math.cos(t) * Math.sin(tilt) +
      ry * Math.sin(t) * Math.cos(tilt),
  });
  const front0 = orbit(0);
  const front1 = orbit(Math.PI);
  const orbitFront = `M${front0.x.toFixed(1)} ${front0.y.toFixed(1)} A${rx.toFixed(1)} ${ry.toFixed(1)} ${ORBIT_TILT} 0 1 ${front1.x.toFixed(1)} ${front1.y.toFixed(1)}`;
  const planeAt = orbit(plane);
  const heading =
    (Math.atan2(
      -rx * Math.sin(plane) * Math.sin(tilt) +
        ry * Math.cos(plane) * Math.cos(tilt),
      -rx * Math.sin(plane) * Math.cos(tilt) -
        ry * Math.cos(plane) * Math.sin(tilt),
    ) *
      180) /
    Math.PI;
  // Hidden while it flies behind the globe
  const planeBehind =
    Math.sin(plane) < 0 && Math.hypot(planeAt.x - cx, planeAt.y - cy) < r;

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="globeOcean" cx="0.4" cy="0.36" r="0.72">
          <Stop offset="0" stopColor="#E1EAEC" />
          <Stop offset="0.6" stopColor={OCEAN} />
          <Stop offset="1" stopColor="#AFC5CF" />
        </RadialGradient>
        <RadialGradient id="globeShade" cx="0.36" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#FFFDF7" stopOpacity={0.4} />
          <Stop offset="0.45" stopColor="#FFFDF7" stopOpacity={0} />
          <Stop offset="0.85" stopColor={INK} stopOpacity={0.05} />
          <Stop offset="1" stopColor={INK} stopOpacity={0.2} />
        </RadialGradient>
      </Defs>
      {decor > 0 && (
        <Ellipse
          cx={cx}
          cy={cy}
          rx={rx}
          ry={ry}
          transform={`rotate(${ORBIT_TILT} ${cx} ${cy})`}
          fill="none"
          stroke="#8A7F73"
          strokeWidth={1.2}
          strokeDasharray="3 6"
          strokeLinecap="round"
          opacity={decor}
        />
      )}
      <Circle cx={cx} cy={cy} r={r} fill="url(#globeOcean)" />
      <Path
        d={gridPath}
        fill="none"
        stroke="#5E7C8C"
        strokeOpacity={0.32}
        strokeWidth={0.9}
        strokeDasharray="2 4"
        strokeLinecap="round"
      />
      <Path
        d={landPath}
        fill={LAND}
        stroke={INK}
        strokeOpacity={0.72}
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {lakePath !== "" && <Path d={lakePath} fill={OCEAN} />}
      {lakePath !== "" && (
        <Path
          d={lakePath}
          fill="none"
          stroke={INK}
          strokeOpacity={0.5}
          strokeWidth={0.9}
          strokeLinejoin="round"
        />
      )}
      <Circle cx={cx} cy={cy} r={r} fill="url(#globeShade)" />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={INK}
        strokeWidth={1.6}
      />
      {/* A second, slightly offset rim reads as a pencil going round twice */}
      <Circle
        cx={cx + 1.3}
        cy={cy - 0.9}
        r={r + 1.6}
        fill="none"
        stroke={INK}
        strokeOpacity={0.35}
        strokeWidth={1}
      />
      {decor > 0 && (
        <Path
          d={orbitFront}
          fill="none"
          stroke="#8A7F73"
          strokeWidth={1.2}
          strokeDasharray="3 6"
          strokeLinecap="round"
          opacity={decor}
        />
      )}
      {decor > 0 && !planeBehind && (
        <G
          transform={`translate(${planeAt.x.toFixed(1)} ${planeAt.y.toFixed(1)}) rotate(${heading.toFixed(1)})`}
          opacity={decor}
        >
          <Path
            d="M-8 -5.5 L9 0 L-8 5.5 L-4.6 0 Z"
            fill="#FBF8F1"
            stroke={INK}
            strokeWidth={1.1}
            strokeLinejoin="round"
          />
          <Path d="M-4.6 0 L9 0" fill="none" stroke={INK} strokeWidth={0.8} />
        </G>
      )}
    </Svg>
  );
}
