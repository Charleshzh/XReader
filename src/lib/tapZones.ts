import type { TapZone } from "@/types/reader";

interface TapZoneInput {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function resolveTapZone({ x, y, width, height }: TapZoneInput): TapZone {
  const col = x < width / 3 ? "l" : x < (width * 2) / 3 ? "c" : "r";
  const row = y < height / 3 ? "t" : y < (height * 2) / 3 ? "m" : "b";
  return `${row}${col}` as TapZone;
}
