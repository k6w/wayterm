import type { GitStatus } from "../../types/git";

export type ChangeCode = "S" | "M" | "A" | "D" | "R" | "U";

export interface ChangeRow {
  path: string;
  code: ChangeCode;
  staged?: boolean;
}

/** Badge text, tone and spoken name for each change code. */
export const CHANGE_CODES: Record<ChangeCode, { tone: "info" | "warning" | "success" | "danger" | "neutral"; label: string }> = {
  S: { tone: "info", label: "Staged" },
  M: { tone: "warning", label: "Modified" },
  A: { tone: "success", label: "Added" },
  D: { tone: "danger", label: "Deleted" },
  R: { tone: "info", label: "Renamed" },
  U: { tone: "neutral", label: "Untracked" },
};

/** Badge code for an index status letter; unknown or missing letters stay "S". */
function stagedCode(letter?: string): ChangeCode {
  switch (letter) {
    case "A":
    case "C":
      return "A";
    case "M":
    case "T":
      return "M";
    case "D":
      return "D";
    case "R":
      return "R";
    default:
      return "S";
  }
}

/** Staged files, then unstaged changes in the order modified, added, deleted, untracked. */
export function changeGroups(status: GitStatus): { staged: ChangeRow[]; unstaged: ChangeRow[] } {
  return {
    staged: status.staged.map((path) => ({ path, code: stagedCode(status.stagedCodes?.[path]), staged: true })),
    unstaged: [
      ...status.modified.map((path) => ({ path, code: "M" as const })),
      ...status.added.map((path) => ({ path, code: "A" as const })),
      ...status.deleted.map((path) => ({ path, code: "D" as const })),
      ...status.untracked.map((path) => ({ path, code: "U" as const })),
    ],
  };
}

/** A terminal cwd the git commands can run in ("" and "~" are not). */
export function isRepoPath(cwd: string): boolean {
  return cwd.length > 0 && cwd !== "~";
}

/** The backend's message for a folder that is not inside a work tree. */
export const NOT_A_REPO = "Not a git repository";

/** Shorten `text` to at most `max` characters, keeping both ends ("/Users/me/…/name"). */
export function truncateMiddle(text: string, max = 36): string {
  if (text.length <= max) return text;
  const keep = max - 1;
  const tail = Math.ceil(keep * 0.6);
  const head = keep - tail;
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}
