import {
  DEFAULT_READER_SETTINGS_STATE,
  cloneReaderSettingsState,
  cloneReaderStylePreset,
  type AssistSettings,
  type ChromeItem,
  type InteractionSettings,
  type ReaderChromeRow,
  type ReaderSettingsState,
  type ReaderStylePreset,
  type ReaderTheme,
  type TapAction,
  type TapZone,
  type TitleMode,
} from "@/types/reader";

const VALID_THEMES = new Set<ReaderTheme>(["light", "dark", "sepia", "green", "gray", "black"]);
const VALID_TITLE_MODES = new Set<TitleMode>(["left", "center", "hidden"]);
const VALID_FONT_WEIGHTS = new Set<ReaderStylePreset["fontWeight"]>(["normal", "medium", "bold"]);
const VALID_CHROME_ITEMS = new Set<ChromeItem>(["none", "chapter", "clock", "progress", "book"]);
const VALID_PAGE_TURNS = new Set<InteractionSettings["pageTurn"]>(["none", "slide", "cover", "fade"]);
const VALID_SCROLL_MODES = new Set<InteractionSettings["scrollMode"]>(["scroll", "paginated"]);
const VALID_CHINESE_MODES = new Set<AssistSettings["chineseMode"]>([
  "original",
  "simplified",
  "traditional",
]);
const VALID_TAP_ACTIONS = new Set<TapAction>([
  "noop",
  "menu",
  "next-page",
  "prev-page",
  "next-chapter",
  "prev-chapter",
  "bookmark",
  "search",
  "tts-toggle",
]);
const TAP_ZONES: TapZone[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function coerceOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeChromeRow(value: unknown, fallback: ReaderChromeRow): ReaderChromeRow {
  if (!value || typeof value !== "object") {
    return { ...fallback };
  }

  const row = value as Partial<ReaderChromeRow>;
  return {
    left: VALID_CHROME_ITEMS.has(row.left as ChromeItem) ? (row.left as ChromeItem) : fallback.left,
    center: VALID_CHROME_ITEMS.has(row.center as ChromeItem)
      ? (row.center as ChromeItem)
      : fallback.center,
    right: VALID_CHROME_ITEMS.has(row.right as ChromeItem)
      ? (row.right as ChromeItem)
      : fallback.right,
    showDivider: typeof row.showDivider === "boolean" ? row.showDivider : fallback.showDivider,
  };
}

function normalizeStylePreset(
  value: unknown,
  fallback: ReaderStylePreset,
  index: number,
): ReaderStylePreset {
  if (!value || typeof value !== "object") {
    const next = cloneReaderStylePreset(fallback);
    next.id = `${fallback.id}-${index}`;
    return next;
  }

  const style = value as Partial<ReaderStylePreset>;
  return {
    ...cloneReaderStylePreset(fallback),
    id: typeof style.id === "string" && style.id.trim() ? style.id : `${fallback.id}-${index}`,
    name: typeof style.name === "string" && style.name.trim() ? style.name : fallback.name,
    fontSize: coerceNumber(style.fontSize, fallback.fontSize),
    lineHeight: coerceNumber(style.lineHeight, fallback.lineHeight),
    letterSpacing: coerceNumber(style.letterSpacing, fallback.letterSpacing),
    paragraphSpacing: coerceNumber(style.paragraphSpacing, fallback.paragraphSpacing),
    paragraphIndent: coerceNumber(style.paragraphIndent, fallback.paragraphIndent),
    fontFamily: typeof style.fontFamily === "string" && style.fontFamily.trim()
      ? style.fontFamily
      : fallback.fontFamily,
    fontWeight: VALID_FONT_WEIGHTS.has(style.fontWeight as ReaderStylePreset["fontWeight"])
      ? (style.fontWeight as ReaderStylePreset["fontWeight"])
      : fallback.fontWeight,
    marginH: coerceNumber(style.marginH, fallback.marginH),
    marginV: coerceNumber(style.marginV, fallback.marginV),
    theme: VALID_THEMES.has(style.theme as ReaderTheme) ? (style.theme as ReaderTheme) : fallback.theme,
    titleMode: VALID_TITLE_MODES.has(style.titleMode as TitleMode)
      ? (style.titleMode as TitleMode)
      : fallback.titleMode,
    titleSize: coerceNumber(style.titleSize, fallback.titleSize),
    header: normalizeChromeRow(style.header, fallback.header),
    footer: normalizeChromeRow(style.footer, fallback.footer),
    backgroundImage: coerceOptionalString(style.backgroundImage),
  };
}

function normalizeInteractionSettings(value: unknown): InteractionSettings {
  const fallback = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE).interaction;
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const interaction = value as Partial<InteractionSettings>;
  const tapZones = { ...fallback.tapZones };
  const rawTapZones = interaction.tapZones;
  if (rawTapZones && typeof rawTapZones === "object") {
    for (const zone of TAP_ZONES) {
      const action = rawTapZones[zone];
      if (VALID_TAP_ACTIONS.has(action as TapAction)) {
        tapZones[zone] = action as TapAction;
      }
    }
  }

  return {
    scrollMode: VALID_SCROLL_MODES.has(interaction.scrollMode as InteractionSettings["scrollMode"])
      ? (interaction.scrollMode as InteractionSettings["scrollMode"])
      : fallback.scrollMode,
    pageTurn: VALID_PAGE_TURNS.has(interaction.pageTurn as InteractionSettings["pageTurn"])
      ? (interaction.pageTurn as InteractionSettings["pageTurn"])
      : fallback.pageTurn,
    autoPageSeconds:
      interaction.autoPageSeconds === null
        ? null
        : coerceNumber(interaction.autoPageSeconds, fallback.autoPageSeconds ?? 0),
    tapZones,
  };
}

function normalizeAssistSettings(value: unknown): AssistSettings {
  const fallback = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE).assist;
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const assist = value as Partial<AssistSettings>;
  return {
    chineseMode: VALID_CHINESE_MODES.has(assist.chineseMode as AssistSettings["chineseMode"])
      ? (assist.chineseMode as AssistSettings["chineseMode"])
      : fallback.chineseMode,
    ttsRate: coerceNumber(assist.ttsRate, fallback.ttsRate),
    searchCaseSensitive:
      typeof assist.searchCaseSensitive === "boolean"
        ? assist.searchCaseSensitive
        : fallback.searchCaseSensitive,
  };
}

function normalizeReaderSettingsState(value: Partial<ReaderSettingsState>): ReaderSettingsState {
  const fallback = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE);
  const styles = Array.isArray(value.styles) && value.styles.length > 0
    ? value.styles.map((style, index) => normalizeStylePreset(style, fallback.styles[0], index))
    : fallback.styles.map(cloneReaderStylePreset);
  const activeStyleId =
    typeof value.activeStyleId === "string" && styles.some((style) => style.id === value.activeStyleId)
      ? value.activeStyleId
      : styles[0].id;

  return {
    version: 1,
    activeStyleId,
    styles,
    interaction: normalizeInteractionSettings(value.interaction),
    assist: normalizeAssistSettings(value.assist),
  };
}

function fromFlatSettings(value: Record<string, unknown>): ReaderSettingsState {
  const fallback = cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE);
  const style = normalizeStylePreset(
    {
      ...fallback.styles[0],
      fontSize: value.fontSize,
      lineHeight: value.lineHeight,
      marginH: value.marginH,
      marginV: value.marginV,
      fontFamily: value.fontFamily,
      theme: value.theme,
    },
    fallback.styles[0],
    0,
  );

  return {
    version: 1,
    activeStyleId: style.id,
    styles: [style],
    interaction: normalizeInteractionSettings({ scrollMode: value.scrollMode }),
    assist: fallback.assist,
  };
}

export function migrateReaderSettings(value: unknown): ReaderSettingsState {
  if (!value || typeof value !== "object") {
    return cloneReaderSettingsState(DEFAULT_READER_SETTINGS_STATE);
  }

  if ((value as { version?: number }).version === 1 && Array.isArray((value as ReaderSettingsState).styles)) {
    return normalizeReaderSettingsState(value as Partial<ReaderSettingsState>);
  }

  return fromFlatSettings(value as Record<string, unknown>);
}
