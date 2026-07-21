import { isMac } from "../lib/platform";

// Shortcut strings use the keybindings format from src/lib/keybindings.ts:
// "Meta+Shift+p", "Control+t", "Control+,". "Mod" means Meta on macOS and
// Control elsewhere.

const MAC_MODIFIERS: Record<string, string> = {
  Meta: "⌘",
  Mod: "⌘",
  Control: "⌃",
  Ctrl: "⌃",
  Shift: "⇧",
  Alt: "⌥",
  Option: "⌥",
};

const OTHER_MODIFIERS: Record<string, string> = {
  Meta: "Win",
  Mod: "Ctrl",
  Control: "Ctrl",
  Ctrl: "Ctrl",
  Shift: "Shift",
  Alt: "Alt",
  Option: "Alt",
};

const KEY_NAMES: Record<string, string> = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  enter: "↵",
  escape: "Esc",
  backspace: "⌫",
  delete: "Del",
  tab: "Tab",
  space: "Space",
};

/** Splits a shortcut into display parts, e.g. "Meta+Shift+p" -> ["⌘", "⇧", "P"]. */
export function formatShortcut(shortcut: string, mac: boolean = isMac): string[] {
  const modifiers = mac ? MAC_MODIFIERS : OTHER_MODIFIERS;
  return shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const modifier = modifiers[part];
      if (modifier) return modifier;
      const named = KEY_NAMES[part.toLowerCase()];
      if (named) return named;
      return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
    });
}

/** One-line label for screen readers and titles, e.g. "Ctrl+Shift+P" or "⌘⇧P". */
export function shortcutLabel(shortcut: string, mac: boolean = isMac): string {
  return formatShortcut(shortcut, mac).join(mac ? "" : "+");
}
