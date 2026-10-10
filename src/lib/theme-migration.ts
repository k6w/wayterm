import { DEFAULT_THEME_ID, REMOVED_BUILTIN_THEMES } from "../themes";
import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";
import { toast } from "../stores/toast";

/** How long the one-time "theme retired" notice stays up. */
export const RETIRED_THEME_NOTICE_MS = 12_000;

export interface StartupThemeResolution {
  /** Theme to activate. */
  themeId: string;
  /** Display name of the removed built-in the user was on, or null. */
  retiredThemeName: string | null;
  /** True when the stored theme id must be rewritten. */
  needsPersist: boolean;
}

/**
 * Decides which theme to start on. A stored id that is still available wins.
 * A removed built-in (or a deleted custom theme) falls back to Graphite; only
 * the removed built-in case produces a notice.
 */
export function resolveStartupTheme(
  storedId: string | null | undefined,
  availableIds: Iterable<string>
): StartupThemeResolution {
  const available = new Set(availableIds);
  if (storedId && available.has(storedId)) {
    return { themeId: storedId, retiredThemeName: null, needsPersist: false };
  }
  const retiredThemeName =
    storedId && Object.prototype.hasOwnProperty.call(REMOVED_BUILTIN_THEMES, storedId)
      ? REMOVED_BUILTIN_THEMES[storedId]
      : null;
  return {
    themeId: DEFAULT_THEME_ID,
    retiredThemeName,
    needsPersist: storedId !== DEFAULT_THEME_ID,
  };
}

export function retiredThemeNotice(name: string): string {
  return `The "${name}" theme was retired in this update, so wayterm switched you to Graphite. Pick another theme in Settings > Appearance.`;
}

/**
 * Activates the saved theme at startup. Call once, after both the settings and
 * the custom themes have loaded. Users on a removed built-in are moved to
 * Graphite; the new id is persisted, so the notice shows exactly once.
 */
export async function applyStartupTheme(): Promise<StartupThemeResolution> {
  const storedId = useSettingsStore.getState().settings.appearance.themeId;
  const resolution = resolveStartupTheme(storedId, Object.keys(useThemeStore.getState().themes));

  useThemeStore.getState().setTheme(resolution.themeId);

  if (resolution.needsPersist) {
    try {
      await useSettingsStore.getState().update("appearance", { themeId: resolution.themeId });
    } catch (err) {
      console.warn("[theme] failed to persist the migrated theme id:", err);
    }
  }

  if (resolution.retiredThemeName) {
    toast.info(retiredThemeNotice(resolution.retiredThemeName), {
      durationMs: RETIRED_THEME_NOTICE_MS,
    });
  }

  return resolution;
}
