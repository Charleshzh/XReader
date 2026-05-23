import OpenCC from "opencc-js";
import type { ChineseMode } from "@/types/reader";

const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });
const toTraditional = OpenCC.Converter({ from: "cn", to: "hk" });

export function convertChinese(mode: ChineseMode, text: string): string {
  switch (mode) {
    case "simplified":
      return toSimplified(text);
    case "traditional":
      return toTraditional(text);
    default:
      return text;
  }
}
