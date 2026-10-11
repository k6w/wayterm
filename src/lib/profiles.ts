import type { AppSettings, CursorStyle, ShellProfile } from "../types/settings";
import { getPreferredShell } from "./shell-detect";
import { useTerminalStore } from "../stores/terminal";

export function findProfile(settings: AppSettings, profileId: string | undefined): ShellProfile | undefined {
  return profileId ? settings.profiles.find((p) => p.id === profileId) : undefined;
}

/** How a pane's terminal looks: the global settings with the profile's overrides on top. */
export interface TerminalLook {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  cursorStyle: CursorStyle;
  scrollback: number;
  ligatures: boolean;
}

export function terminalLook(settings: AppSettings, profile: ShellProfile | undefined): TerminalLook {
  const { appearance, terminal } = settings;
  return {
    fontFamily: profile?.fontFamilyOverride || appearance.terminalFontFamily,
    fontSize: profile?.fontSizeOverride ?? appearance.terminalFontSize,
    fontWeight: profile?.fontWeightOverride ?? appearance.terminalFontWeight,
    cursorStyle: profile?.cursorStyleOverride ?? appearance.cursorStyle,
    scrollback: profile?.scrollbackOverride ?? terminal.scrollbackLines,
    ligatures: profile?.ligaturesOverride ?? terminal.ligatures,
  };
}

/** The shell a profile starts: its own, else the default shell. */
export function profileShell(profile: ShellProfile, settings: AppSettings) {
  return getPreferredShell(profile.shellPath || settings.general.defaultShell);
}

/** A profile's arguments and variables, without the blank rows the editor leaves. */
export function profileSpawnExtras(profile: ShellProfile): { args: string[]; env: [string, string][] } {
  return {
    args: profile.args.filter((a) => a.trim() !== ""),
    env: Object.entries(profile.env).filter(([key]) => key.trim() !== ""),
  };
}

/** Expands a leading `~` (the working directory field's placeholder) to the home folder. */
export function expandHome(path: string, home: string | null): string {
  if (!home || !(path === "~" || path.startsWith("~/") || path.startsWith("~\\"))) return path;
  return home + path.slice(1);
}

/** Opens a tab running `profile`, named after it. Returns the new pane's id. */
export function openProfileTab(profile: ShellProfile, settings: AppSettings): string {
  const store = useTerminalStore.getState();
  const shell = profileShell(profile, settings);
  const cwd = profile.workingDirectory.trim();
  const paneId = store.addTab(shell.type, shell.path, undefined, cwd || undefined);
  // checkCwd: start in home with a notice if the folder doesn't exist.
  store.updatePane(paneId, { profileId: profile.id, ...(cwd ? { checkCwd: true } : {}) });
  const tab = useTerminalStore.getState().tabs.find((t) => t.isActive);
  if (tab) store.renameTab(tab.id, profile.name);
  return paneId;
}
