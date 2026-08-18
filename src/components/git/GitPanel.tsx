import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FolderGit2, FolderSearch, RefreshCw } from "lucide-react";
import { useGitStore } from "../../stores/git";
import { useTerminalStore } from "../../stores/terminal";
import {
  Button,
  EmptyState,
  ICON_MD,
  ICON_SM,
  IconButton,
  SegmentedControl,
  Spinner,
  Toolbar,
  ToolbarButton,
  ToolbarSpacer,
} from "../../ui";
import { PanelContent, PanelToolbar } from "../sidebar/PanelChrome";
import DiffViewer from "./DiffViewer";
import GitChanges from "./GitChanges";
import { GitBranches, GitCommits, GitStashes } from "./GitHistory";
import { isRepoPath } from "./git-changes";
import type { GitDiff } from "../../types/git";

type GitView = "status" | "branches" | "commits" | "stash";

const VIEWS = [
  { value: "status", label: "Status" },
  { value: "branches", label: "Branches" },
  { value: "commits", label: "Commits" },
  { value: "stash", label: "Stash" },
] as const;

/** Git for the active pane's working directory (local, or over SSH for status and history). */
export function GitPanel() {
  const {
    status,
    branches,
    commits,
    currentBranch,
    isLoading,
    error,
    fetchStatus,
    fetchBranches,
    fetchCommits,
    fetchDiff,
    initRepo,
    checkout,
    pull,
    push,
    commit,
    stage,
    unstage,
    stash,
    applyStash,
    dropStash,
  } = useGitStore();
  const [view, setView] = useState<GitView>("status");
  const [diff, setDiff] = useState<GitDiff[] | null>(null);

  const activePane = useTerminalStore((s) => (s.activePaneId ? s.panes[s.activePaneId] : null));
  const cwd = activePane?.cwd || "";
  const isSSH = activePane?.shellType === "ssh";
  const connectionId = isSSH ? activePane?.sshConnectionId : undefined;

  // Status first; branches and commits only for a real repo. Firing all three
  // at once raced on the shared `error` field for non-repo folders.
  const loadRepo = useCallback(
    async (path: string) => {
      const ok = await fetchStatus(path, connectionId);
      if (ok) {
        void fetchBranches(path, connectionId);
        void fetchCommits(path, 50, connectionId);
      }
    },
    [connectionId, fetchStatus, fetchBranches, fetchCommits]
  );

  useEffect(() => {
    if (isRepoPath(cwd)) void loadRepo(cwd);
  }, [cwd, loadRepo]);

  // Each action refreshes what it can change, as before.
  const run = (action: () => Promise<unknown>, refresh: Array<"status" | "branches" | "commits">) => async () => {
    await action();
    if (refresh.includes("status")) void fetchStatus(cwd);
    if (refresh.includes("branches")) void fetchBranches(cwd);
    if (refresh.includes("commits")) void fetchCommits(cwd, 50);
  };

  const showDiff = async (file?: string, staged?: boolean) => {
    if (file) {
      setDiff(await fetchDiff(cwd, file, staged));
      return;
    }
    // Whole-repo view: unstaged changes followed by staged ones.
    const [unstaged, indexed] = await Promise.all([fetchDiff(cwd), fetchDiff(cwd, undefined, true)]);
    setDiff([...unstaged, ...indexed.filter((d) => !unstaged.some((u) => u.file === d.file))]);
  };

  if (!isRepoPath(cwd)) {
    return (
      <PanelContent>
        <EmptyState
          icon={<FolderSearch {...ICON_MD} />}
          title="No folder to inspect"
          description="Change to a directory in the active terminal to see its Git status here."
        />
      </PanelContent>
    );
  }

  // A local folder without .git: offer to initialize one. (Over SSH, git's own
  // error shows in the banner instead.)
  if (error === "Not a git repository" && !isSSH) {
    return (
      <PanelContent>
        <EmptyState
          icon={<FolderGit2 {...ICON_MD} />}
          title="Not a Git repository"
          description="Initialize one to track changes, view history and manage branches from here."
          action={
            <Button size="sm" variant="primary" onClick={() => void initRepo(cwd)}>
              Initialize repository
            </Button>
          }
        />
      </PanelContent>
    );
  }

  if (diff) {
    return (
      <>
        <Toolbar aria-label="Diff" className="h-9 shrink-0 gap-1 border-b border-border px-2">
          <ToolbarButton>
            <IconButton label="Back to changes" icon={<ArrowLeft {...ICON_SM} />} onClick={() => setDiff(null)} />
          </ToolbarButton>
          <span className="text-label text-fg-secondary">Diff</span>
        </Toolbar>
        <div className="min-h-0 flex-1">
          <DiffViewer diffs={diff} />
        </div>
      </>
    );
  }

  return (
    <>
      <PanelToolbar aria-label="Git actions">
        <SegmentedControl size="sm" aria-label="Git view" value={view} onValueChange={setView} options={VIEWS} />
        <ToolbarSpacer />
        <ToolbarButton>
          <IconButton
            label="Refresh"
            icon={isLoading ? <Spinner size={14} label="Refreshing" /> : <RefreshCw {...ICON_SM} />}
            disabled={isLoading}
            onClick={() => void loadRepo(cwd)}
          />
        </ToolbarButton>
      </PanelToolbar>
      {error && (
        <p role="alert" className="shrink-0 border-b border-border bg-danger-subtle px-3 py-2 text-label text-danger">
          {error}
        </p>
      )}
      <PanelContent>
        {view === "status" && status && (
          <GitChanges
            status={status}
            branch={currentBranch}
            onShowDiff={(file, staged) => void showDiff(file, staged)}
            onPull={run(() => pull(cwd), ["status", "commits"])}
            onPush={run(() => push(cwd), ["status"])}
            onStash={run(() => stash(cwd, "WIP"), ["status"])}
            onStage={(files) => void run(() => stage(cwd, files), ["status"])()}
            onUnstage={(file) => void run(() => unstage(cwd, [file]), ["status"])()}
            onCommit={(message) => run(() => commit(cwd, message), ["status", "commits"])()}
          />
        )}
        {view === "branches" && (
          <GitBranches
            branches={branches}
            onCheckout={(name) => void run(() => checkout(cwd, name), ["status", "branches", "commits"])()}
          />
        )}
        {view === "commits" && <GitCommits commits={commits} />}
        {view === "stash" && status && (
          <GitStashes
            count={status.stashes}
            onApply={(index) => void run(() => applyStash(cwd, index), ["status"])()}
            onDrop={(index) => void run(() => dropStash(cwd, index), [])()}
          />
        )}
      </PanelContent>
    </>
  );
}
