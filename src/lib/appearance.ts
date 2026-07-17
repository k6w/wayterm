import type { AppearanceSettings } from "../types/settings";
import type { ThemeDefinition } from "../types/theme";
import { hexToRgba } from "./color";
import { vibrancyAlpha } from "./platform";

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
  const surfaceAlpha = a.vibrancyEnabled ? vibrancyAlpha(a.windowOpacity) : 1;
  const overlayAlpha = a.vibrancyEnabled ? vibrancyAlpha(a.windowOpacity) * 0.85 : 1;
  const glass = (color: string, alpha: number) => (alpha >= 1 ? color : hexToRgba(color, alpha));
  root.style.setProperty("--nx-glass-panel", glass(c.panel, surfaceAlpha));
  root.style.setProperty("--nx-glass-tab-bar", glass(c.tabBar, surfaceAlpha));
  root.style.setProperty("--nx-glass-status-bar", glass(c.statusBar, surfaceAlpha));
  root.style.setProperty("--nx-glass-raised", glass(c.raised, overlayAlpha));
  if (a.vibrancyEnabled) root.setAttribute("data-vibrancy", "on");
  else root.removeAttribute("data-vibrancy");

  // Backdrop-blur multiplier consumed by translucent surfaces.
  root.style.setProperty("--blur-intensity", String(a.blurIntensity));

  // Density (settings rows; the kit's comfortable density lands in Phase 5).
  if (a.compactMode) root.setAttribute("data-compact", "true");
  else root.removeAttribute("data-compact");

  // Interface zoom scales the whole UI cleanly (layout included), unlike a
  // root font-size change which px-based utilities ignore.
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(a.uiScale);
}
