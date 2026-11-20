import Svg, { Path } from "react-native-svg";

/** 分享：方框加往上的箭頭 */
export function ShareIcon({
  color,
  size = 17,
}: {
  color: string;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M8.5 9.5H7a2 2 0 0 0-2 2v7.2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7.2a2 2 0 0 0-2-2h-1.5M12.1 14.6V3.6M8.4 7.1l3.7-3.6 3.6 3.7" />
    </Svg>
  );
}
