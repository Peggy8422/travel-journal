import Svg, { Path } from "react-native-svg";

/** 鉛筆圖示（寫日記、編輯） */
export function PencilIcon({
  color,
  size = 20,
  strokeWidth = 1.7,
}: {
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8zM14 6.6l3.4 3.4" />
    </Svg>
  );
}
