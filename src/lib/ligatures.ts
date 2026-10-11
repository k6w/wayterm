import type { Terminal } from "@xterm/xterm";
import { LigaturesAddon } from "@xterm/addon-ligatures";

/**
 * Loads font ligatures (`->`, `=>`, `!=`, ...). The webview can't read font
 * files, so the addon joins its built-in list of common ligature sequences
 * and the font draws them through `font-feature-settings`.
 *
 * Load it before the WebGL addon: WebGL bakes the feature settings into its
 * glyph atlas when it loads. Returns null if the addon fails to load.
 */
export function loadLigatures(term: Terminal): LigaturesAddon | null {
  try {
    const addon = new LigaturesAddon();
    term.loadAddon(addon);
    return addon;
  } catch {
    return null;
  }
}
