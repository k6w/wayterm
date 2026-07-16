import type { ThemeDefinition } from "../types/theme";
import { normalizeTheme } from "../themes/legacy";

// ─── Windows Terminal theme import ──────────────────────────────────────────

interface WindowsTerminalTheme {
  name?: string;
  foreground?: string;
  background?: string;
  cursorColor?: string;
  selectionBackground?: string;
  black?: string;
  blue?: string;
  cyan?: string;
  green?: string;
  purple?: string;
  red?: string;
  white?: string;
  yellow?: string;
  brightBlack?: string;
  brightBlue?: string;
  brightCyan?: string;
  brightGreen?: string;
  brightPurple?: string;
  brightRed?: string;
  brightWhite?: string;
  brightYellow?: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 64) || crypto.randomUUID().slice(0, 8);
}

function isLight(background: string): boolean {
  const hex = background.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Relative luminance
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 128;
}

function darken(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = Math.max(0, parseInt(h.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(h.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(h.slice(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function lighten(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + amount);
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function deriveUiColors(bg: string, fg: string, accent: string, light: boolean) {
  if (light) {
    return {
      bgPrimary: bg,
      bgSecondary: darken(bg, 10),
      bgTertiary: darken(bg, 18),
      textPrimary: fg,
      textSecondary: lighten(fg, 20),
      textMuted: lighten(fg, 50),
      accent,
      accentHover: lighten(accent, 15),
      border: darken(bg, 25),
      borderFocus: accent,
      success: "#22c55e",
      warning: "#eab308",
      error: "#ef4444",
    };
  } else {
    return {
      bgPrimary: bg,
      bgSecondary: lighten(bg, 8),
      bgTertiary: lighten(bg, 16),
      textPrimary: fg,
      textSecondary: darken(fg, 20),
      textMuted: darken(fg, 50),
      accent,
      accentHover: darken(accent, 15),
      border: lighten(bg, 25),
      borderFocus: accent,
      success: "#22c55e",
      warning: "#eab308",
      error: "#ef4444",
    };
  }
}

export function importWindowsTerminalTheme(json: string): ThemeDefinition {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON");
  }

  // Support both a single theme object and a settings.json with "schemes" array
  let wt: WindowsTerminalTheme | null = null;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if ("schemes" in obj && Array.isArray(obj.schemes) && obj.schemes.length > 0) {
      wt = obj.schemes[0] as WindowsTerminalTheme;
    } else if ("name" in obj || "background" in obj) {
      wt = obj as WindowsTerminalTheme;
    }
  }

  if (!wt) throw new Error("No Windows Terminal theme found in JSON");

  const bg = wt.background ?? "#1e1e1e";
  const fg = wt.foreground ?? "#cccccc";
  const cursor = wt.cursorColor ?? fg;
  const selection = wt.selectionBackground ?? "#264f78";
  const name = wt.name ?? "Imported Theme";
  const light = isLight(bg);

  const ansi: [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string] = [
    wt.black ?? "#000000",
    wt.red ?? "#cd3131",
    wt.green ?? "#0dbc79",
    wt.yellow ?? "#e5e510",
    wt.blue ?? "#2472c8",
    wt.purple ?? "#bc3fbc",
    wt.cyan ?? "#11a8cd",
    wt.white ?? "#e5e5e5",
    wt.brightBlack ?? "#666666",
    wt.brightRed ?? "#f14c4c",
    wt.brightGreen ?? "#23d18b",
    wt.brightYellow ?? "#f5f543",
    wt.brightBlue ?? "#3b8eea",
    wt.brightPurple ?? "#d670d6",
    wt.brightCyan ?? "#29b8db",
    wt.brightWhite ?? "#e5e5e5",
  ];

  const accent = wt.blue ?? ansi[4];
  const id = `wt-${slugify(name)}`;

  return normalizeTheme({
    id,
    name,
    variant: light ? "light" : "dark",
    terminal: { foreground: fg, background: bg, cursor, cursorAccent: bg, selection, ansi },
    ui: deriveUiColors(bg, fg, accent, light),
    blur: { sidebar: 20, blocks: 4, inputBar: 12, overlay: 30 },
    opacity: { sidebar: 0.4, blocks: 0.05, inputBar: 0.08 },
  });
}

// ─── iTerm2 .itermcolors import ──────────────────────────────────────────────

function parseItermComponent(dict: Element, key: string): number {
  const keys = Array.from(dict.querySelectorAll("key"));
  for (const k of keys) {
    if (k.textContent?.trim() === key) {
      const next = k.nextElementSibling;
      if (next?.tagName === "real" || next?.tagName === "integer") {
        return parseFloat(next.textContent ?? "0");
      }
    }
  }
  return 0;
}

function itermColorToHex(dict: Element): string {
  const r = Math.round(parseItermComponent(dict, "Red Component") * 255);
  const g = Math.round(parseItermComponent(dict, "Green Component") * 255);
  const b = Math.round(parseItermComponent(dict, "Blue Component") * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getItermColor(topDict: Element, colorKey: string): string | null {
  const keys = Array.from(topDict.children).filter((el) => el.tagName === "key");
  for (const k of keys) {
    if (k.textContent?.trim() === colorKey) {
      const next = k.nextElementSibling;
      if (next?.tagName === "dict") {
        return itermColorToHex(next);
      }
    }
  }
  return null;
}

export function importItermColorsTheme(xml: string): ThemeDefinition {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");

  const parserError = doc.querySelector("parsererror");
  if (parserError) throw new Error("Invalid XML / .itermcolors file");

  const topDict = doc.querySelector("plist > dict");
  if (!topDict) throw new Error("No dict found in .itermcolors file");

  const ansi: [string, string, string, string, string, string, string, string, string, string, string, string, string, string, string, string] = [
    getItermColor(topDict, "Ansi 0 Color") ?? "#000000",
    getItermColor(topDict, "Ansi 1 Color") ?? "#cd3131",
    getItermColor(topDict, "Ansi 2 Color") ?? "#0dbc79",
    getItermColor(topDict, "Ansi 3 Color") ?? "#e5e510",
    getItermColor(topDict, "Ansi 4 Color") ?? "#2472c8",
    getItermColor(topDict, "Ansi 5 Color") ?? "#bc3fbc",
    getItermColor(topDict, "Ansi 6 Color") ?? "#11a8cd",
    getItermColor(topDict, "Ansi 7 Color") ?? "#e5e5e5",
    getItermColor(topDict, "Ansi 8 Color") ?? "#666666",
    getItermColor(topDict, "Ansi 9 Color") ?? "#f14c4c",
    getItermColor(topDict, "Ansi 10 Color") ?? "#23d18b",
    getItermColor(topDict, "Ansi 11 Color") ?? "#f5f543",
    getItermColor(topDict, "Ansi 12 Color") ?? "#3b8eea",
    getItermColor(topDict, "Ansi 13 Color") ?? "#d670d6",
    getItermColor(topDict, "Ansi 14 Color") ?? "#29b8db",
    getItermColor(topDict, "Ansi 15 Color") ?? "#e5e5e5",
  ];

  const bg = getItermColor(topDict, "Background Color") ?? "#1e1e1e";
  const fg = getItermColor(topDict, "Foreground Color") ?? "#cccccc";
  const cursor = getItermColor(topDict, "Cursor Color") ?? fg;
  const selection = getItermColor(topDict, "Selection Color") ?? "#264f78";
  const light = isLight(bg);

  // Try to extract name from filename hint or use a default
  const name = "iTerm2 Theme";
  const id = `iterm-${crypto.randomUUID().slice(0, 8)}`;
  const accent = ansi[4]; // Blue

  return normalizeTheme({
    id,
    name,
    variant: light ? "light" : "dark",
    terminal: { foreground: fg, background: bg, cursor, cursorAccent: bg, selection, ansi },
    ui: deriveUiColors(bg, fg, accent, light),
    blur: { sidebar: 20, blocks: 4, inputBar: 12, overlay: 30 },
    opacity: { sidebar: 0.4, blocks: 0.05, inputBar: 0.08 },
  });
}
