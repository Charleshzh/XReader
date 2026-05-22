export interface ReaderSettings {
  fontSize: number;
  lineHeight: number;
  marginH: number;
  marginV: number;
  theme: "light" | "dark" | "sepia";
  scrollMode: "paginated" | "scroll";
  fontFamily: string;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  marginH: 5,
  marginV: 40,
  theme: "light",
  scrollMode: "paginated",
  fontFamily: "system-ui, -apple-system, sans-serif",
};

export interface ChapterInfo {
  index: number;
  title: string;
}
