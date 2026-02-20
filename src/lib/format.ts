export function shortenPath(fullPath: string): string {
  if (!fullPath || fullPath === "~") return "~";

  const home = getHomePath();
  if (home) {
    // Normalize both to forward slashes for comparison
    const normalizedPath = fullPath.replace(/\\/g, "/");
    const normalizedHome = home.replace(/\\/g, "/");
    if (normalizedPath.startsWith(normalizedHome)) {
      const rest = normalizedPath.slice(normalizedHome.length);
      return "~" + (rest || "");
    }
  }
  return fullPath;
}

function getHomePath(): string | null {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) {
    // On Windows, USERPROFILE is typically C:\Users\<name>
    // We can't access env vars from the browser, but we can infer from common paths
    // Match C:\Users\<username> pattern in the path
    return null; // Will show full path on Windows, which is fine
  }
  return null;
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
