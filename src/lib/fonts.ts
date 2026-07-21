export const UI_FONT_FAMILY = "Inter";
export const TERMINAL_FONT_FAMILY = "JetBrains Mono";

type FontLoader = Pick<FontFaceSet, "load">;

/**
 * Waits, at most `timeoutMs`, for the bundled fonts (imported in main.tsx) so
 * xterm.js measures JetBrains Mono instead of a fallback. Never rejects.
 */
export async function loadAppFonts(
  timeoutMs = 1500,
  fonts: FontLoader | undefined = typeof document !== "undefined" ? document.fonts : undefined
): Promise<void> {
  if (!fonts || typeof fonts.load !== "function") return;
  const loads = Promise.allSettled([
    fonts.load(`13px "${UI_FONT_FAMILY}"`),
    fonts.load(`600 13px "${UI_FONT_FAMILY}"`),
    fonts.load(`14px "${TERMINAL_FONT_FAMILY}"`),
    fonts.load(`700 14px "${TERMINAL_FONT_FAMILY}"`),
  ]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  try {
    await Promise.race([loads.then(() => undefined), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
