import type { ReaderSettingsState } from "@/types/reader";

export interface ReaderBundle {
  kind: "xreader-reader-bundle";
  version: 1;
  exportedAt: string;
  settings: ReaderSettingsState;
  extensions: {
    voices?: string[];
    dictionaries?: string[];
  };
}

export function isReaderBundle(value: unknown): value is ReaderBundle {
  if (!value || typeof value !== "object") {
    return false;
  }

  const bundle = value as Partial<ReaderBundle>;
  return (
    bundle.kind === "xreader-reader-bundle" &&
    bundle.version === 1 &&
    typeof bundle.exportedAt === "string" &&
    !!bundle.settings &&
    typeof bundle.settings === "object" &&
    !!bundle.extensions &&
    typeof bundle.extensions === "object"
  );
}
