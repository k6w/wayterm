import { invoke } from "@tauri-apps/api/core";
import type { ShellType } from "../types/terminal";

export interface DetectedShell {
  type: ShellType;
  path: string;
  label: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

async function pathExists(p: string): Promise<boolean> {
  try { return await invoke<boolean>("path_exists", { path: p }); }
  catch { return false; }
}

async function findInPath(name: string): Promise<string | null> {
  try { return await invoke<string | null>("find_executable", { name }); }
  catch { return null; }
}

// ─── platform ─────────────────────────────────────────────────────────────────

const IS_WIN = navigator.platform.toLowerCase().includes("win");

// ─── Windows detection ────────────────────────────────────────────────────────

const WIN32 = "C:\\Windows\\System32";
const WIN_PS_V1 = `${WIN32}\\WindowsPowerShell\\v1.0\\powershell.exe`;
const WIN_CMD = `${WIN32}\\cmd.exe`;
const WIN_WSL = `${WIN32}\\wsl.exe`;

const GIT_BASH_CANDIDATES = [
  "C:\\Program Files\\Git\\bin\\bash.exe",
  "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  "C:\\Users\\Public\\scoop\\apps\\git\\current\\bin\\bash.exe",
];

async function detectWindows(): Promise<DetectedShell[]> {
  const found: DetectedShell[] = [];

  // PowerShell 7 — look in PATH first, then common install dirs
  const pwsh7Path = await findInPath("pwsh") ??
    (await pathExists("C:\\Program Files\\PowerShell\\7\\pwsh.exe")
      ? "C:\\Program Files\\PowerShell\\7\\pwsh.exe" : null);
  if (pwsh7Path) found.push({ type: "powershell", path: pwsh7Path, label: "PowerShell 7" });

  // Windows PowerShell 5 — always present
  found.push({ type: "powershell", path: WIN_PS_V1, label: "Windows PowerShell" });

  // Command Prompt — always present
  found.push({ type: "cmd", path: WIN_CMD, label: "Command Prompt" });

  // WSL — optional feature
  if (await pathExists(WIN_WSL)) {
    found.push({ type: "wsl", path: WIN_WSL, label: "WSL" });
  }

  // Git Bash — check known locations then PATH
  let gitBashPath: string | null = null;
  for (const c of GIT_BASH_CANDIDATES) {
    if (await pathExists(c)) { gitBashPath = c; break; }
  }
  if (!gitBashPath) gitBashPath = await findInPath("bash");
  if (gitBashPath) found.push({ type: "gitbash", path: gitBashPath, label: "Git Bash" });

  return found;
}

// ─── Unix detection ───────────────────────────────────────────────────────────

// Ordered: prefer user-friendly shells first, fall back to sh
const UNIX_CANDIDATES: { type: ShellType; names: string[]; extra: string[]; label: string }[] = [
  {
    type: "zsh",
    names: ["zsh"],
    extra: ["/bin/zsh", "/usr/bin/zsh", "/usr/local/bin/zsh", "/opt/homebrew/bin/zsh"],
    label: "Zsh",
  },
  {
    type: "bash",
    names: ["bash"],
    extra: ["/bin/bash", "/usr/bin/bash", "/usr/local/bin/bash"],
    label: "Bash",
  },
  {
    type: "fish",
    names: ["fish"],
    extra: ["/usr/bin/fish", "/usr/local/bin/fish", "/opt/homebrew/bin/fish"],
    label: "Fish",
  },
  {
    type: "sh",
    names: ["sh"],
    extra: ["/bin/sh", "/usr/bin/sh"],
    label: "Shell",
  },
];

async function detectUnix(): Promise<DetectedShell[]> {
  const found: DetectedShell[] = [];

  for (const { type, names, extra, label } of UNIX_CANDIDATES) {
    let resolved: string | null = null;

    // Check absolute paths first (fast, no PATH traversal)
    for (const p of extra) {
      if (await pathExists(p)) { resolved = p; break; }
    }
    // Fall back to PATH search
    if (!resolved) {
      for (const name of names) {
        resolved = await findInPath(name);
        if (resolved) break;
      }
    }
    if (resolved) found.push({ type, path: resolved, label });
  }

  return found;
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function getDefaultShellsVerified(): Promise<DetectedShell[]> {
  const shells = IS_WIN ? await detectWindows() : await detectUnix();
  return shells.length > 0 ? shells : getDefaultShells();
}

export function getDefaultShells(): DetectedShell[] {
  if (IS_WIN) {
    return [
      { type: "powershell", path: WIN_PS_V1, label: "Windows PowerShell" },
      { type: "cmd", path: WIN_CMD, label: "Command Prompt" },
    ];
  }
  return [
    { type: "bash", path: "/bin/bash", label: "Bash" },
    { type: "sh", path: "/bin/sh", label: "Shell" },
  ];
}

export function getDefaultShell(): DetectedShell {
  return getDefaultShells()[0];
}

export function getShellByPath(shellPath?: string): DetectedShell | undefined {
  if (!shellPath) return undefined;
  return getDefaultShells().find((s) => s.path === shellPath);
}

export function getPreferredShell(shellPath?: string): DetectedShell {
  if (!shellPath) return getDefaultShell();
  // Exact match
  const exact = getDefaultShells().find((s) => s.path === shellPath);
  if (exact) return exact;
  // The stored path is valid but not in our static list (e.g. detected at runtime) — use it as-is
  const type = inferShellType(shellPath);
  return { type, path: shellPath, label: labelForType(type) };
}

function inferShellType(path: string): ShellType {
  const p = path.toLowerCase();
  if (p.includes("pwsh")) return "powershell";
  if (p.includes("powershell")) return "powershell";
  if (p.includes("cmd")) return "cmd";
  if (p.includes("wsl")) return "wsl";
  if (p.includes("bash")) return IS_WIN ? "gitbash" : "bash";
  if (p.includes("zsh")) return "zsh";
  if (p.includes("fish")) return "fish";
  return "sh";
}

function labelForType(type: ShellType): string {
  const map: Record<string, string> = {
    powershell: "PowerShell",
    cmd: "Command Prompt",
    wsl: "WSL",
    gitbash: "Git Bash",
    bash: "Bash",
    zsh: "Zsh",
    fish: "Fish",
    sh: "Shell",
    ssh: "SSH",
    sftp: "SFTP",
    serial: "Serial",
  };
  return map[type] ?? type;
}

export async function getDefaultShellVerified(): Promise<DetectedShell> {
  const shells = await getDefaultShellsVerified();
  return shells[0];
}
