import type { AppSettings } from "../../types/settings";
import type { TerminalPane } from "../../types/terminal";

export interface SpawnConfig {
  shell: string;
  args: string[];
  env: [string, string][];
  /** The backend adds the integration arguments and environment for this shell. */
  shellIntegration: boolean;
}

/** How a local (non-SSH) pane's shell is started. */
export function localSpawnConfig(
  pane: Pick<TerminalPane, "shellPath"> | undefined,
  settings: AppSettings,
  detectedShellPath: string,
): SpawnConfig {
  const shell = pane?.shellPath || settings.general.defaultShell || detectedShellPath;
  return { shell, args: [], env: [], shellIntegration: settings.terminal.shellIntegration };
}
