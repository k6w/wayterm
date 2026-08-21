import type { ShellProfile } from "../../types/settings";

/** A blank profile, as "Add profile" has always created it. */
export function createProfile(id: string): ShellProfile {
  return {
    id,
    name: "New Profile",
    shellPath: "",
    args: [],
    env: {},
    workingDirectory: "",
    icon: "terminal",
    themeOverride: null,
    fontFamilyOverride: null,
    fontSizeOverride: null,
    fontWeightOverride: null,
    cursorStyleOverride: null,
    scrollbackOverride: null,
    ligaturesOverride: null,
  };
}

export function duplicateProfile(profile: ShellProfile, id: string): ShellProfile {
  return { ...profile, id, name: `${profile.name} (Copy)`, args: [...profile.args], env: { ...profile.env } };
}

/** The first free VAR_n name, counting from the number of variables (VAR_1 for an empty map). */
export function nextEnvKey(env: Record<string, string>): string {
  let n = Object.keys(env).length + 1;
  while (`VAR_${n}` in env) n++;
  return `VAR_${n}`;
}

/** Renames a variable in place, so the row keeps its position while its name is typed. */
export function renameEnvKey(env: Record<string, string>, from: string, to: string): Record<string, string> {
  return Object.fromEntries(Object.entries(env).map(([key, value]) => [key === from ? to : key, value]));
}

export function removeEnvKey(env: Record<string, string>, key: string): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([k]) => k !== key));
}
