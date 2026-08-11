/** Path helpers for the SFTP browser. Remote paths are POSIX; local paths may be Windows ("C:\Users\me"). */

/** One directory up. Roots ("/", "C:/") stay where they are. */
export function parentPath(p: string): string {
  if (/^[A-Za-z]:\/?$/.test(p)) return p;
  if (p === "/") return "/";
  const trimmed = p.replace(/\/+$/, "");
  const idx = trimmed.lastIndexOf("/");
  if (idx <= 0) return "/";
  if (/^[A-Za-z]:$/.test(trimmed.substring(0, idx))) return trimmed.substring(0, idx) + "/";
  return trimmed.substring(0, idx);
}

/** dir + "/" + name on the server. */
export function joinRemote(dir: string, name: string): string {
  return dir.replace(/\/+$/, "") + "/" + name;
}

/** dir + separator + name on this machine, using a backslash when the dir already does. */
export function joinLocal(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return dir.replace(/[/\\]+$/, "") + sep + name;
}

/** The last path segment, for either separator. */
export function baseName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/** The path a renamed entry gets: same directory, new name. */
export function renamedPath(path: string, newName: string): string {
  return path.substring(0, path.lastIndexOf("/")) + "/" + newName;
}

export interface Crumb {
  name: string;
  path: string;
}

/**
 * Root first, then one crumb per directory: "/srv/app" gives "/", "srv",
 * "app"; "C:\Users\me" gives "C:/", "Users", "me".
 */
export function breadcrumbs(path: string): Crumb[] {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (/^[A-Za-z]:[\\/]?/.test(path) && parts.length > 0) {
    const drive = parts[0];
    return [
      { name: `${drive}/`, path: `${drive}/` },
      ...parts.slice(1).map((name, i) => ({ name, path: `${drive}/${parts.slice(1, i + 2).join("/")}` })),
    ];
  }
  return [{ name: "/", path: "/" }, ...parts.map((name, i) => ({ name, path: "/" + parts.slice(0, i + 1).join("/") }))];
}
