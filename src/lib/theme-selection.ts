import { useSettingsStore } from "../stores/settings";
import { useThemeStore } from "../stores/theme";

/**
 * Makes `id` the active theme and saves it as appearance.themeId, so the
 * choice survives a restart. Unknown ids are ignored. A failed save is logged;
 * the theme still applies for this session.
 */
export async function selectTheme(id: string): Promise<void> {
  const themes = useThemeStore.getState();
  if (!themes.themes[id]) return;
  themes.setTheme(id);
  try {
    await useSettingsStore.getState().update("appearance", { themeId: id });
  } catch (err) {
    console.warn("[theme] failed to save the selected theme:", err);
  }
}
