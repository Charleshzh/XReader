export interface ReaderSettings {
  fontSize: number; // px, default 18
  lineHeight: number; // multiplier, default 1.8
  marginH: number; // horizontal margin %, default 5
  marginV: number; // vertical margin px, default 40
  theme: "light" | "dark" | "sepia";
  scrollMode: "paginated" | "scroll";
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  marginH: 5,
  marginV: 40,
  theme: "light",
  scrollMode: "paginated",
};

export interface ChapterInfo {
  index: number;
  title: string;
}
