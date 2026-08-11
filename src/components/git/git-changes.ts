import type { GitStatus } from "../../types/git";

export type ChangeCode = "S" | "M" | "A" | "D" | "U";

export interface ChangeRow {
  path: string;
  code: ChangeCode;
}

/** Badge text, tone and spoken name for each change code. */
export const CHANGE_CODES: Record<ChangeCode, { tone: "info" | "warning" | "success" | "danger" | "neutral"; label: string }> = {
  S: { tone: "info", label: "Staged" },
  M: { tone: "warning", label: "Modified" },
  A: { tone: "success", label: "Added" },
  D: { tone: "danger", label: "Deleted" },
  U: { tone: "neutral", label: "Untracked" },
};

/** Staged files, then unstaged changes in the order modified, added, deleted, untracked. */
export function changeGroups(status: GitStatus): { staged: ChangeRow[]; unstaged: ChangeRow[] } {
  return {
    staged: status.staged.map((path) => ({ path, code: "S" })),
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
