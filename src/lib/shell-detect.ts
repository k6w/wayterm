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

export function getDefaultShells(): DetectedShell[] {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) {
    return WINDOWS_SHELLS;
  }
  return UNIX_SHELLS;
}

export function getDefaultShell(): DetectedShell {
  const shells = getDefaultShells();
  return shells[0];
}
