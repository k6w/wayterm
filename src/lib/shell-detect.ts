import { invoke } from "@tauri-apps/api/core";
import type { ShellType } from "../types/terminal";

interface DetectedShell {
  type: ShellType;
  path: string;
  label: string;
}

const WINDOWS_SHELLS: DetectedShell[] = [
  { type: "powershell", path: "pwsh.exe", label: "PowerShell 7" },
  { type: "powershell", path: "powershell.exe", label: "PowerShell" },
  { type: "cmd", path: "cmd.exe", label: "Command Prompt" },
  { type: "gitbash", path: "C:\\Program Files\\Git\\bin\\bash.exe", label: "Git Bash" },
  { type: "wsl", path: "wsl.exe", label: "WSL" },
];

const UNIX_SHELLS: DetectedShell[] = [
  { type: "zsh", path: "/bin/zsh", label: "Zsh" },
  { type: "bash", path: "/bin/bash", label: "Bash" },
  { type: "fish", path: "/usr/bin/fish", label: "Fish" },
  { type: "sh", path: "/bin/sh", label: "Shell" },
];

/**
 * Check if a shell executable exists at the given path.
 * Uses Tauri backend to verify file existence.
 */
async function shellExists(shellPath: string): Promise<boolean> {
  try {
    return await invoke<boolean>("path_exists", { path: shellPath });
  } catch {
    // If the command doesn't exist, assume the path is valid
    // (e.g., for system commands like "cmd.exe" that are always available)
    return true;
  }
}

// Sync versions - use these for runtime (backward compatible)
export function getDefaultShells(): DetectedShell[] {
  const platform = navigator.platform.toLowerCase();
  return platform.includes("win") ? WINDOWS_SHELLS : UNIX_SHELLS;
}

export function getDefaultShell(): DetectedShell {
  const shells = getDefaultShells();
  return shells[0];
}

export function getShellByPath(shellPath?: string): DetectedShell | undefined {
  if (!shellPath) return undefined;
  const shells = getDefaultShells();
  return shells.find((shell) => shell.path === shellPath);
}

export function getPreferredShell(shellPath?: string): DetectedShell {
  return getShellByPath(shellPath) ?? getDefaultShell();
}

// Async versions - use these when you need to verify the shell exists
export async function getDefaultShellsVerified(): Promise<DetectedShell[]> {
  const shells = getDefaultShells();
  
  // Filter to only shells that actually exist
  const existingShells: DetectedShell[] = [];
  for (const shell of shells) {
    if (await shellExists(shell.path)) {
      existingShells.push(shell);
    }
  }
  
  // If no shells exist, return all shells (fallback to trying anyway)
  return existingShells.length > 0 ? existingShells : shells;
}

export async function getDefaultShellVerified(): Promise<DetectedShell> {
  const shells = await getDefaultShellsVerified();
  return shells[0];
}
