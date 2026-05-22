export type ReaderTheme = "light" | "dark" | "sepia" | "green" | "gray" | "black";
export type TitleMode = "left" | "center" | "hidden";
export type ChromeItem = "none" | "chapter" | "clock" | "progress" | "book";
export type TapZone = "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";
export type TapAction =
  | "noop"
  | "menu"
  | "next-page"
  | "prev-page"
  | "next-chapter"
  | "prev-chapter"
  | "bookmark"
  | "search"
  | "tts-toggle";
export type ChineseMode = "original" | "simplified" | "traditional";

export interface ReaderChromeRow {
  left: ChromeItem;
  center: ChromeItem;
  right: ChromeItem;
  showDivider: boolean;
}

export interface ReaderStylePreset {
  id: string;
  name: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  paragraphIndent: number;
  fontFamily: string;
  fontWeight: "normal" | "medium" | "bold";
  marginH: number;
  marginV: number;
  theme: ReaderTheme;
  titleMode: TitleMode;
  titleSize: number;
  header: ReaderChromeRow;
  footer: ReaderChromeRow;
  backgroundImage?: string;
}

export interface InteractionSettings {
  scrollMode: "scroll" | "paginated";
  pageTurn: "none" | "slide" | "cover" | "fade";
  autoPageSeconds: number | null;
  tapZones: Record<TapZone, TapAction>;
}

export interface AssistSettings {
  chineseMode: ChineseMode;
  ttsRate: number;
  searchCaseSensitive: boolean;
}

export interface ReaderSettingsState {
  version: 1;
  activeStyleId: string;
  styles: ReaderStylePreset[];
  interaction: InteractionSettings;
  assist: AssistSettings;
}

export interface ChapterInfo {
  index: number;
  title: string;
}

export const DEFAULT_TAP_ZONES: Record<TapZone, TapAction> = {
  tl: "prev-page",
  tc: "menu",
  tr: "next-page",
  ml: "prev-page",
  mc: "menu",
  mr: "next-page",
  bl: "prev-chapter",
  bc: "bookmark",
  br: "next-chapter",
};

export const DEFAULT_STYLE_PRESET: ReaderStylePreset = {
  id: "default",
  name: "默认",
  fontSize: 18,
  lineHeight: 1.8,
  letterSpacing: 0,
  paragraphSpacing: 0,
  paragraphIndent: 2,
  fontFamily: "system-ui, -apple-system, sans-serif",
  fontWeight: "normal",
  marginH: 5,
  marginV: 40,
  theme: "light",
  titleMode: "left",
  titleSize: 20,
  header: { left: "book", center: "none", right: "clock", showDivider: false },
  footer: { left: "chapter", center: "none", right: "progress", showDivider: true },
};

export const DEFAULT_READER_SETTINGS_STATE: ReaderSettingsState = {
  version: 1,
  activeStyleId: DEFAULT_STYLE_PRESET.id,
  styles: [{
    ...DEFAULT_STYLE_PRESET,
    header: { ...DEFAULT_STYLE_PRESET.header },
    footer: { ...DEFAULT_STYLE_PRESET.footer },
  }],
  interaction: {
    scrollMode: "paginated",
    pageTurn: "none",
    autoPageSeconds: null,
    tapZones: { ...DEFAULT_TAP_ZONES },
  },
  assist: {
    chineseMode: "original",
    ttsRate: 1,
    searchCaseSensitive: false,
  },
};

export function cloneReaderStylePreset(style: ReaderStylePreset): ReaderStylePreset {
  return {
    ...style,
    header: { ...style.header },
    footer: { ...style.footer },
  };
}

export function cloneReaderSettingsState(state: ReaderSettingsState): ReaderSettingsState {
  return {
    ...state,
    styles: state.styles.map(cloneReaderStylePreset),
    interaction: {
      ...state.interaction,
      tapZones: { ...state.interaction.tapZones },
    },
    assist: { ...state.assist },
  };
}
