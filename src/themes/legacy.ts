import { compositeOver, mixHex, parseCssColor, toHex, type Rgba } from "../lib/color";
import { ThemeValidationError, parseThemeFile, toThemeDefinition } from "../lib/theme-schema";
import type { ThemeChrome, ThemeDefinition, ThemeVariant } from "../types/theme";

// Pre-redesign custom themes (stored in sqlite, or JSON files users still have)
// carry a 13-color `ui` block instead of `chrome`. This module upgrades them in
// memory so nobody loses a theme they imported before the redesign.

const LEGACY_UI_KEYS = [
  "bgPrimary",
  "bgSecondary",
  "bgTertiary",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "accent",
  "accentHover",
  "border",
  "borderFocus",
  "success",
  "warning",
  "error",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOrThrow(value: unknown, field: string): Rgba {
  const parsed = typeof value === "string" ? parseCssColor(value) : null;
  if (!parsed) throw new ThemeValidationError(field, "must be a hex or rgb()/rgba() color");
  return parsed;
}

/** Opaque #rrggbb for `value`, compositing any alpha over `backdrop`. */
function opaque(value: unknown, backdrop: string, field: string): string {
  return toHex(compositeOver(parseOrThrow(value, field), parseCssColor(backdrop)!));
}

/** #rrggbb or #rrggbbaa, keeping the alpha. */
function keepAlpha(value: unknown, field: string): string {
  return toHex(parseOrThrow(value, field), true);
}

function withAlpha(hex: string, alpha: number): string {
  return toHex({ ...parseCssColor(hex)!, a: alpha }, true);
}

function readableOn(background: string): string {
  const c = parseCssColor(background)!;
  const luma = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  return luma > 0.55 ? "#111111" : "#ffffff";
}

/** Builds the full chrome token set from a pre-redesign `ui` block. */
export function legacyUiToChrome(ui: Record<string, unknown>, variant: ThemeVariant): ThemeChrome {
  for (const key of LEGACY_UI_KEYS) {
    if (ui[key] === undefined) throw new ThemeValidationError(`ui.${key}`, "is missing");
  }
  const base = variant === "dark" ? "#000000" : "#ffffff";
  const canvas = opaque(ui.bgPrimary, base, "ui.bgPrimary");
  const panel = opaque(ui.bgSecondary, canvas, "ui.bgSecondary");
  const raised = opaque(ui.bgTertiary, canvas, "ui.bgTertiary");
  const text = opaque(ui.textPrimary, canvas, "ui.textPrimary");
  const textSecondary = opaque(ui.textSecondary, canvas, "ui.textSecondary");
  const textMuted = opaque(ui.textMuted, canvas, "ui.textMuted");
  const accent = opaque(ui.accent, canvas, "ui.accent");
  const accentHover = opaque(ui.accentHover, canvas, "ui.accentHover");
  const border = opaque(ui.border, panel, "ui.border");
  const focusRing = opaque(ui.borderFocus, canvas, "ui.borderFocus");
  const success = opaque(ui.success, canvas, "ui.success");
  const warning = opaque(ui.warning, canvas, "ui.warning");
  const danger = opaque(ui.error, canvas, "ui.error");
  const hover = mixHex(raised, text, 0.06);
  const active = mixHex(raised, text, 0.12);
  const borderStrong = mixHex(border, text, 0.12);

  return {
    canvas,
    panel,
    raised,
    hover,
    active,
    scrim: variant === "dark" ? "#000000a6" : "#1a1b1e66",
    border,
    borderStrong,
    borderSubtle: mixHex(border, panel, 0.5),
    text,
    textSecondary,
    textMuted,
    textDisabled: mixHex(textMuted, canvas, 0.4),
    textOnAccent: readableOn(accent),
    accent,
    accentHover,
    accentActive: mixHex(accent, canvas, 0.15),
    accentSubtle: withAlpha(accent, 0.2),
    accentText: accent,
    focusRing,
    selection: withAlpha(accent, 0.35),
    success,
    successSubtle: withAlpha(success, 0.12),
    warning,
    warningSubtle: withAlpha(warning, 0.12),
    danger,
    dangerSubtle: withAlpha(danger, 0.12),
    info: accent,
    infoSubtle: withAlpha(accent, 0.12),
    inputBg: mixHex(canvas, panel, 0.5),
    inputBorder: borderStrong,
    tabBar: panel,
    tabActive: raised,
    statusBar: panel,
    tooltipBg: active,
    tooltipText: text,
    kbdBg: hover,
    kbdText: textSecondary,
    scrollbarThumb: withAlpha(text, 0.15),
    scrollbarThumbHover: withAlpha(text, 0.25),
    shadow: variant === "dark" ? "#00000066" : "#1a1b1e1f",
  };
}

function legacyTerminal(input: unknown, accent: string): Record<string, unknown> {
  if (!isRecord(input)) throw new ThemeValidationError("terminal", "is missing or not an object");
  const background = opaque(input.background, "#000000", "terminal.background");
  const foreground = opaque(input.foreground, background, "terminal.foreground");
  return {
    foreground,
    background,
    cursor: input.cursor === undefined ? foreground : opaque(input.cursor, background, "terminal.cursor"),
    cursorAccent:
      input.cursorAccent === undefined
        ? background
        : opaque(input.cursorAccent, background, "terminal.cursorAccent"),
    selection:
      input.selection === undefined
        ? withAlpha(accent, 0.25)
        : keepAlpha(input.selection, "terminal.selection"),
    ansi: Array.isArray(input.ansi)
      ? input.ansi.map((color, i) => opaque(color, background, `terminal.ansi[${i}]`))
      : input.ansi,
  };
}

/**
 * Loads any supported theme JSON value: the current schema (has `chrome`), or
 * a pre-redesign theme (has `ui`, no `chrome`), which is upgraded in memory.
 * @throws ThemeValidationError naming the offending field.
 */
export function normalizeTheme(input: unknown): ThemeDefinition {
  if (isRecord(input) && !("chrome" in input) && isRecord(input.ui)) {
    const variant: ThemeVariant = input.variant === "light" ? "light" : "dark";
    const chrome = legacyUiToChrome(input.ui, variant);
    return toThemeDefinition(
      parseThemeFile({
        id: input.id,
        name: input.name,
        variant: input.variant,
        chrome,
        terminal: legacyTerminal(input.terminal, chrome.accent),
        blur: input.blur,
        opacity: input.opacity,
      })
    );
  }
  return toThemeDefinition(parseThemeFile(input));
}
