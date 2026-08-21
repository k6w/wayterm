import type { ThemeDefinition } from "../../types/theme";
import { importItermColorsTheme, importWindowsTerminalTheme } from "../../lib/theme-import";
import { toThemeFile } from "../../lib/theme-schema";
import { downloadTextFile } from "../../lib/download-file";

/** File types the theme import accepts: nexterm themes, Windows Terminal schemes (.json) and iTerm2 presets. */
export const THEME_FILE_ACCEPT = ".json,.itermcolors";

function isNexTermThemeJson(text: string): boolean {
  try {
    const raw: unknown = JSON.parse(text);
    return typeof raw === "object" && raw !== null && ("chrome" in raw || "ui" in raw);
  } catch {
    return false;
  }
}

/**
 * Imports a theme file through the theme store's `importTheme` (which
 * validates it, refuses built-in ids, saves it and registers it). nexterm
 * themes (they have `chrome`, or the pre-redesign `ui`) load as they are;
 * other .json files are read as Windows Terminal schemes and .itermcolors as
 * iTerm2 presets, then converted to the nexterm schema.
 * @throws Error with a user-facing message.
 */
export async function importThemeFile(
  file: Pick<File, "name" | "text">,
  importTheme: (json: string) => Promise<ThemeDefinition>
): Promise<ThemeDefinition> {
  const text = await file.text();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "itermcolors") {
    return importTheme(JSON.stringify(toThemeFile(importItermColorsTheme(text))));
  }
  if (ext !== "json") throw new Error(`Unsupported file type: .${ext}. Use .json or .itermcolors`);
  if (isNexTermThemeJson(text)) return importTheme(text);
  return importTheme(JSON.stringify(toThemeFile(importWindowsTerminalTheme(text))));
}

/** Downloads a theme in the documented file schema (see THEMES.md). */
export function exportThemeFile(theme: ThemeDefinition): void {
  const safeId = theme.id.replace(/[^a-zA-Z0-9-_]/g, "_");
  downloadTextFile(`${safeId}.json`, JSON.stringify(toThemeFile(theme), null, 2), "application/json");
}
