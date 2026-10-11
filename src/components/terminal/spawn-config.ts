import type { AppSettings } from "../../types/settings";
import type { ShellSetup } from "../../lib/ipc";
import type { TerminalPane } from "../../types/terminal";
import { findProfile, profileSpawnExtras } from "../../lib/profiles";

export interface SpawnConfig {
  shell: string;
  args: string[];
  env: [string, string][];
  /** What the backend adds to this shell. */
  shellSetup: ShellSetup;
}

/** How a local (non-SSH) pane's shell is started. A profile adds its shell, arguments and variables. */
export function localSpawnConfig(
  pane: Pick<TerminalPane, "shellPath" | "profileId"> | undefined,
  settings: AppSettings,
  detectedShellPath: string,
): SpawnConfig {
  const profile = findProfile(settings, pane?.profileId);
  const shell = profile?.shellPath || pane?.shellPath || settings.general.defaultShell || detectedShellPath;
  // With the integration off, shells keep the title-only prompt they always had.
  const shellSetup: ShellSetup = settings.terminal.shellIntegration ? "integrated" : "titleOnly";
  const { args, env } = profile ? profileSpawnExtras(profile) : { args: [], env: [] };
  return { shell, args, env, shellSetup };
}
