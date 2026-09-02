import type { AppearanceSettings } from "../types/settings";
import type { ThemeDefinition } from "../types/theme";
import { hexToRgba } from "./color";
import { clamp01 } from "./vibrancy";
import { vibrancyAlpha } from "./platform";
import { chromeAlpha, overlayAlpha } from "./glass";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/**
 * Applies the appearance settings that sit on top of the theme: UI font,
 * accent override, glass (vibrancy) surfaces, blur, density and zoom. Run it
 * after applyThemeToDom, and again whenever the settings or the active theme
 * change.
 */
export function applyAppearanceToDom(a: AppearanceSettings, theme: ThemeDefinition) {
  const root = document.documentElement;
  const c = theme.chrome;

  // Interface font.
  root.style.setProperty("--ui-font-family", a.uiFontFamily || "Inter, system-ui, sans-serif");

  // Accent: a valid #rrggbb override wins over the theme accent family;
  // clearing it restores the theme's tokens.
  const override =
    a.accentColorOverride && HEX6.test(a.accentColorOverride) ? a.accentColorOverride : null;
  root.style.setProperty("--accent", override ?? c.accent);
  root.style.setProperty("--accent-hover", override ?? c.accentHover);
  root.style.setProperty("--nx-accent", override ?? c.accent);
  root.style.setProperty("--nx-accent-hover", override ?? c.accentHover);
  root.style.setProperty("--nx-accent-active", override ?? c.accentActive);
  root.style.setProperty("--nx-accent-subtle", override ? hexToRgba(override, 0.2) : c.accentSubtle);
  root.style.setProperty("--nx-accent-text", override ?? c.accentText);
  root.style.setProperty("--nx-focus-ring", override ?? c.focusRing);

  // Glass surfaces: translucent only while vibrancy is on. Backdrop blur is
  // keyed off data-vibrancy (see .nx-blur in styles.css).
  // The canvas sits behind the terminal, so it follows the window opacity
  // freely. Surfaces that carry text never drop below a readable floor
  // (src/lib/glass.ts), whatever the opacity slider says.
  const userAlpha = a.vibrancyEnabled ? vibrancyAlpha(a.windowOpacity) : 1;
  const chrome = a.vibrancyEnabled ? chromeAlpha(theme, userAlpha) : 1;
  const overlay = a.vibrancyEnabled ? overlayAlpha(theme, userAlpha) : 1;
  const glass = (color: string, alpha: number) => (alpha >= 1 ? color : hexToRgba(color, alpha));
  root.style.setProperty("--nx-glass-canvas", glass(c.canvas, userAlpha));
  root.style.setProperty("--nx-glass-panel", glass(c.panel, chrome));
  root.style.setProperty("--nx-glass-tab-bar", glass(c.tabBar, chrome));
  root.style.setProperty("--nx-glass-status-bar", glass(c.statusBar, chrome));
  root.style.setProperty("--nx-glass-raised", glass(c.raised, overlay));
  root.style.setProperty("--nx-glass-dialog", glass(c.panel, overlay));
  if (a.vibrancyEnabled) root.setAttribute("data-vibrancy", "on");
  else root.removeAttribute("data-vibrancy");

  // Backdrop-blur multiplier consumed by translucent surfaces.
  root.style.setProperty("--blur-intensity", String(clamp01(a.blurIntensity)));

  // Density: comfortable raises controls and rows from 28px to 32px (styles.css).
  if (a.density === "comfortable") root.setAttribute("data-density", "comfortable");
  else root.removeAttribute("data-density");

  // Interface zoom scales the whole UI cleanly (layout included), unlike a
  // root font-size change which px-based utilities ignore.
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(a.uiScale);
}
