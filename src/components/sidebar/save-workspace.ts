/** Window event that opens the "save current layout" name dialog; the palette sends it. */
export const OPEN_SAVE_WORKSPACE = "wayterm:save-workspace";

export function openSaveWorkspace(): void {
  window.dispatchEvent(new Event(OPEN_SAVE_WORKSPACE));
}
