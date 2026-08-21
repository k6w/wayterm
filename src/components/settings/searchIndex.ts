import { PANEL_LABEL, type PanelId } from "./nav";

export interface SettingEntry {
  panel: PanelId;
  label: string;
  keywords?: string;
}

/** Flat index powering cross-panel settings search. Add an entry when a new
 *  setting is surfaced so it stays findable regardless of which panel it's on. */
export const SETTINGS_SEARCH_INDEX: SettingEntry[] = [
  // General
  { panel: "general", label: "Default shell", keywords: "shell bash zsh powershell cmd" },
  { panel: "general", label: "Startup behavior", keywords: "launch open restore session workspace" },
  { panel: "general", label: "Check for updates", keywords: "update auto" },
  { panel: "general", label: "Confirm on close", keywords: "quit exit prompt" },
  { panel: "general", label: "Close to tray", keywords: "minimize tray background" },
  { panel: "general", label: "Launch on startup", keywords: "autostart boot login" },
  { panel: "general", label: "Notify on long commands", keywords: "notification bell duration" },
  { panel: "general", label: "Export / Import settings", keywords: "backup json data" },

  // Appearance
  { panel: "appearance", label: "Theme", keywords: "color scheme dark light" },
  { panel: "appearance", label: "Custom themes", keywords: "import export iterm windows terminal" },
  { panel: "appearance", label: "Terminal font family", keywords: "typeface monospace" },
  { panel: "appearance", label: "Terminal font size", keywords: "text size" },
  { panel: "appearance", label: "Font weight", keywords: "bold thin" },
  { panel: "appearance", label: "Line height", keywords: "spacing leading" },
  { panel: "appearance", label: "UI font family", keywords: "interface typeface" },
  { panel: "appearance", label: "Accent color", keywords: "highlight tint override" },
  { panel: "appearance", label: "Density", keywords: "compact comfortable spacing tight row height" },
  { panel: "appearance", label: "Cursor style", keywords: "block bar underline caret" },
  { panel: "appearance", label: "Cursor blink", keywords: "caret blinking" },
  { panel: "appearance", label: "Vibrancy", keywords: "blur transparency acrylic" },
  { panel: "appearance", label: "Window opacity", keywords: "transparency alpha" },
  { panel: "appearance", label: "Blur intensity", keywords: "vibrancy backdrop" },
  { panel: "appearance", label: "UI scale", keywords: "zoom size" },
  { panel: "appearance", label: "Tab position", keywords: "top bottom left right" },
  { panel: "appearance", label: "Window decorations", keywords: "titlebar native custom" },

  // Terminal
  { panel: "terminal", label: "Scrollback lines", keywords: "history buffer" },
  { panel: "terminal", label: "Copy on select", keywords: "clipboard selection" },
  { panel: "terminal", label: "Right-click behavior", keywords: "paste context menu mouse" },
  { panel: "terminal", label: "Bell style", keywords: "audio visual none alert" },
  { panel: "terminal", label: "Word separators", keywords: "selection double click" },
  { panel: "terminal", label: "Ligatures", keywords: "font fira code" },
  { panel: "terminal", label: "Bracketed paste", keywords: "safe paste" },
  { panel: "terminal", label: "Scroll to bottom on input", keywords: "autoscroll" },
  { panel: "terminal", label: "Buffer persistence", keywords: "restore scrollback restart" },

  // Keybindings
  { panel: "keybindings", label: "Keyboard shortcuts", keywords: "hotkeys bindings keys" },

  // SSH
  { panel: "ssh", label: "Default port", keywords: "ssh 22" },
  { panel: "ssh", label: "Default username", keywords: "ssh login user" },
  { panel: "ssh", label: "Keepalive interval", keywords: "ssh timeout ping" },
  { panel: "ssh", label: "Connection timeout", keywords: "ssh connect" },
  { panel: "ssh", label: "Saved connections", keywords: "ssh hosts servers" },
  { panel: "ssh", label: "Known hosts", keywords: "ssh fingerprint tofu" },
  { panel: "ssh", label: "Import SSH config", keywords: "ssh config import ~/.ssh" },

  // Keys
  { panel: "keys", label: "SSH keys", keywords: "private public ed25519 rsa identity" },

  // Profiles
  { panel: "profiles", label: "Shell profiles", keywords: "launch config environment args" },

  // Snippets
  { panel: "snippets", label: "Snippets", keywords: "commands saved variables" },

  // History
  { panel: "history", label: "Command history", keywords: "audit log recent commands" },
];

/**
 * Settings whose label, keywords or panel name contain `query` (case-insensitive),
 * in index order. Null for a blank query, meaning "show the navigation instead".
 */
export function searchSettings(query: string): SettingEntry[] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return SETTINGS_SEARCH_INDEX.filter(
    (entry) =>
      entry.label.toLowerCase().includes(q) ||
      Boolean(entry.keywords?.toLowerCase().includes(q)) ||
      PANEL_LABEL[entry.panel].toLowerCase().includes(q)
  );
}
