import type { AppSettings } from "../../types/settings";
import type { ShellSetup } from "../../lib/ipc";
import type { TerminalPane } from "../../types/terminal";

export interface SpawnConfig {
  shell: string;
  args: string[];
  env: [string, string][];
  /** What the backend adds to this shell. */
  shellSetup: ShellSetup;
}

/** How a local (non-SSH) pane's shell is started. */
export function localSpawnConfig(
  pane: Pick<TerminalPane, "shellPath"> | undefined,
  settings: AppSettings,
  detectedShellPath: string,
): SpawnConfig {
  const shell = pane?.shellPath || settings.general.defaultShell || detectedShellPath;
  // With the integration off, shells keep the title-only prompt they always had.
  const shellSetup: ShellSetup = settings.terminal.shellIntegration ? "integrated" : "titleOnly";
  return { shell, args: [], env: [], shellSetup };
}
