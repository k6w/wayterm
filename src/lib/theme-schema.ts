import {
  CHROME_KEYS,
  type ChromeKey,
  type ThemeBlur,
  type ThemeChrome,
  type ThemeDefinition,
  type ThemeFile,
  type ThemeOpacity,
  type ThemeTerminalColors,
  type ThemeUiColors,
} from "../types/theme";

/** Thrown for an invalid theme file. `field` is the JSON path, e.g. "chrome.canvas". */
export class ThemeValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`${field} ${message}`);
    this.name = "ThemeValidationError";
    this.field = field;
  }
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const HEX6_OR_8 = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const THEME_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * Chrome tokens that feed the legacy `ui` layer. Un-migrated screens append
 * alpha suffixes to these ("#rrggbb" + "33") and pass them to hexToRgb, so they
 * must be opaque #rrggbb. Every other token may also be #rrggbbaa.
 */
export const OPAQUE_CHROME_KEYS: ReadonlySet<ChromeKey> = new Set<ChromeKey>([
  "canvas",
  "panel",
  "raised",
  "text",
  "textSecondary",
  "textMuted",
  "accent",
  "accentHover",
  "border",
  "focusRing",
  "success",
  "warning",
  "danger",
]);

export const DEFAULT_BLUR: ThemeBlur = { sidebar: 20, blocks: 4, inputBar: 12, overlay: 30 };
export const DEFAULT_OPACITY: ThemeOpacity = { sidebar: 0.4, blocks: 0.05, inputBar: 0.08 };

/** CSS custom property carrying a chrome token: borderStrong -> --nx-border-strong. */
export function chromeCssVar(key: ChromeKey): string {
  return `--nx-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireColor(
  source: Record<string, unknown>,
  key: string,
  path: string,
  opaque: boolean
): string {
  const value = source[key];
  if (value === undefined) throw new ThemeValidationError(path, "is missing");
  if (typeof value !== "string" || !(opaque ? HEX6 : HEX6_OR_8).test(value)) {
    throw new ThemeValidationError(
      path,
      opaque
        ? "must be an opaque hex color (#rrggbb)"
        : "must be a hex color (#rrggbb or #rrggbbaa)"
    );
  }
  return value.toLowerCase();
}

function parseNumbers<K extends string>(
  input: unknown,
  defaults: Record<K, number>,
  path: string
): Record<K, number> {
  const result = { ...defaults };
  if (input === undefined) return result;
  if (!isRecord(input)) throw new ThemeValidationError(path, "must be an object");
  for (const key of Object.keys(defaults) as K[]) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new ThemeValidationError(`${path}.${key}`, "must be a non-negative number");
    }
    result[key] = value;
  }
  return result;
}

function parseTerminal(input: unknown): ThemeTerminalColors {
  if (!isRecord(input)) throw new ThemeValidationError("terminal", "is missing or not an object");
  const ansiInput = input.ansi;
  if (!Array.isArray(ansiInput) || ansiInput.length !== 16) {
    throw new ThemeValidationError("terminal.ansi", "must be an array of exactly 16 colors");
  }
  const ansi = ansiInput.map((color, i) => {
    if (typeof color !== "string" || !HEX6.test(color)) {
      throw new ThemeValidationError(`terminal.ansi[${i}]`, "must be an opaque hex color (#rrggbb)");
    }
    return color.toLowerCase();
  }) as ThemeTerminalColors["ansi"];
  return {
    foreground: requireColor(input, "foreground", "terminal.foreground", true),
    background: requireColor(input, "background", "terminal.background", true),
    cursor: requireColor(input, "cursor", "terminal.cursor", true),
    cursorAccent: requireColor(input, "cursorAccent", "terminal.cursorAccent", true),
    selection: requireColor(input, "selection", "terminal.selection", false),
    ansi,
  };
}

/**
 * Validates a parsed theme JSON value against the current schema.
 * Unknown keys are ignored. Colors are lower-cased.
 * @throws ThemeValidationError naming the first invalid field.
 */
export function parseThemeFile(input: unknown): ThemeFile {
  if (!isRecord(input)) throw new ThemeValidationError("theme", "must be a JSON object");
  const { id, name, variant } = input;
  if (typeof id !== "string" || !THEME_ID.test(id)) {
    throw new ThemeValidationError("id", "must be 1-64 letters, digits, '.', '_' or '-'");
  }
  if (typeof name !== "string" || name.trim() === "" || name.length > 64) {
    throw new ThemeValidationError("name", "must be a non-empty string of at most 64 characters");
  }
  if (variant !== "dark" && variant !== "light") {
    throw new ThemeValidationError("variant", 'must be "dark" or "light"');
  }
  if (!isRecord(input.chrome)) throw new ThemeValidationError("chrome", "is missing or not an object");
  const chromeInput = input.chrome;
  const chrome = {} as ThemeChrome;
  for (const key of CHROME_KEYS) {
    chrome[key] = requireColor(chromeInput, key, `chrome.${key}`, OPAQUE_CHROME_KEYS.has(key));
  }
  return {
    id,
    name: name.trim(),
    variant,
    chrome,
    terminal: parseTerminal(input.terminal),
    blur: parseNumbers<keyof ThemeBlur>(input.blur, DEFAULT_BLUR, "blur"),
    opacity: parseNumbers<keyof ThemeOpacity>(input.opacity, DEFAULT_OPACITY, "opacity"),
  };
}

/** The legacy `ui` block that un-migrated screens still read. */
export function chromeToLegacyUi(chrome: ThemeChrome): ThemeUiColors {
  return {
    bgPrimary: chrome.canvas,
    bgSecondary: chrome.panel,
    bgTertiary: chrome.raised,
    textPrimary: chrome.text,
    textSecondary: chrome.textSecondary,
    textMuted: chrome.textMuted,
    accent: chrome.accent,
    accentHover: chrome.accentHover,
    border: chrome.border,
    borderFocus: chrome.focusRing,
    success: chrome.success,
    warning: chrome.warning,
    error: chrome.danger,
  };
}

/** Turns a validated file into the in-app theme (adds defaults and the legacy `ui` view). */
export function toThemeDefinition(file: ThemeFile): ThemeDefinition {
  return {
    id: file.id,
    name: file.name,
    variant: file.variant,
    chrome: { ...file.chrome },
    terminal: { ...file.terminal, ansi: [...file.terminal.ansi] as ThemeTerminalColors["ansi"] },
    ui: chromeToLegacyUi(file.chrome),
    blur: { ...(file.blur ?? DEFAULT_BLUR) },
    opacity: { ...(file.opacity ?? DEFAULT_OPACITY) },
  };
}

/** Serializes a loaded theme back to the on-disk schema (drops the derived `ui`). */
export function toThemeFile(theme: ThemeDefinition): ThemeFile {
  return {
    id: theme.id,
    name: theme.name,
    variant: theme.variant,
    chrome: { ...theme.chrome },
    terminal: { ...theme.terminal, ansi: [...theme.terminal.ansi] as ThemeTerminalColors["ansi"] },
    blur: { ...theme.blur },
    opacity: { ...theme.opacity },
  };
}
