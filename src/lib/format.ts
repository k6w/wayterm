import { getHomeDir } from "./ipc";

let cachedHome: string | null = null;

/** Call once at app startup to cache the home directory. */
export async function initHomePath(): Promise<void> {
  cachedHome = await getHomeDir();
}

export function shortenPath(fullPath: string, sshUsername?: string): string {
  if (!fullPath || fullPath === "~") return "~";

  // SSH remote path: /home/<user> or /root
  if (sshUsername) {
    const remoteHome = sshUsername === "root" ? "/root" : `/home/${sshUsername}`;
    if (fullPath === remoteHome || fullPath.startsWith(remoteHome + "/")) {
      return "~" + fullPath.slice(remoteHome.length);
    }
  }

  // Local path
  if (cachedHome) {
    // Case-insensitive comparison for Windows
    const normalizedPath = fullPath.replace(/\\/g, "/");
    const normalizedHome = cachedHome.replace(/\\/g, "/");

    if (normalizedPath.toLowerCase().startsWith(normalizedHome.toLowerCase())) {
      const rest = normalizedPath.slice(normalizedHome.length);
      // Convert remaining forward slashes back to OS-style (backslash on Windows)
      const separator = fullPath.includes("\\") ? "\\" : "/";
      const displayRest = rest.replace(/\//g, separator);
      return "~" + (displayRest || "");
    }
  }
  return fullPath;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
