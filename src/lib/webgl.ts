import type { Terminal } from "@xterm/xterm";
import { WebglAddon } from "@xterm/addon-webgl";

/**
 * Loads the WebGL renderer, also under vibrancy: it draws transparent cell
 * backgrounds fine, and only it draws box-drawing and block characters as
 * custom glyphs that fill the whole cell. The DOM fallback uses font glyphs,
 * which leave gaps between rows (broken `│` borders, striped block art).
 *
 * Returns null when WebGL is unavailable. If the GPU context is lost later,
 * the addon is disposed (xterm falls back to the DOM renderer) and `onLost`
 * runs so the caller can forget it.
 */
export function loadWebgl(term: Terminal, onLost?: () => void): WebglAddon | null {
  try {
    const addon = new WebglAddon();
    addon.onContextLoss(() => {
      addon.dispose();
      onLost?.();
    });
    term.loadAddon(addon);
    return addon;
  } catch {
    return null;
  }
}
