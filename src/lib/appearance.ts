import type { AppearanceSettings } from "../types/settings";

/**
 * Applies the appearance settings that aren't part of the theme itself to the
 * DOM. Runs after theme application (the theme sets --accent; an accent
 * override re-applies on top). Call whenever the appearance settings or the
 * active theme change.
 */
export function applyAppearanceToDom(
  a: AppearanceSettings,
  themeAccent: string,
  themeAccentHover: string
) {
  const root = document.documentElement;

  // Interface font.
  root.style.setProperty(
    "--ui-font-family",
    a.uiFontFamily || "Inter, system-ui, sans-serif"
  );

  // Accent: an override wins over the theme's accent; clearing it restores the
  // theme accent.
  root.style.setProperty("--accent", a.accentColorOverride || themeAccent);
  root.style.setProperty(
    "--accent-hover",
    a.accentColorOverride || themeAccentHover
  );

  // Backdrop-blur multiplier consumed by translucent surfaces.
  root.style.setProperty("--blur-intensity", String(a.blurIntensity));

  // Density.
  if (a.compactMode) root.setAttribute("data-compact", "true");
  else root.removeAttribute("data-compact");

  // Interface zoom scales the whole UI cleanly (layout included), unlike a
  // root font-size change which px-based utilities ignore.
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(
    a.uiScale
  );
}
