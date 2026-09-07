import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../ui/icons";
import { useGitStore } from "../../stores/git";
import { useTerminalStore } from "../../stores/terminal";
import { Button, EmptyState, IconButton, SegmentedControl, Spinner, Tooltip, Toolbar, ToolbarButton, ToolbarSpacer } from "../../ui";
import { PanelContent, PanelToolbar } from "../sidebar/PanelChrome";
import DiffViewer from "./DiffViewer";
import GitChanges from "./GitChanges";
import { GitBranches, GitCommits, GitStashes } from "./GitHistory";
import { isRepoPath, NOT_A_REPO, truncateMiddle } from "./git-changes";
import type { GitDiff } from "../../types/git";

type GitView = "status" | "branches" | "commits" | "stash";

const VIEWS = [
  { value: "status", label: "Status", icon: <Icon name="diff" size="sm" /> },
  { value: "branches", label: "Branches", icon: <Icon name="gitBranch" size="sm" /> },
  { value: "commits", label: "Commits", icon: <Icon name="gitHistory" size="sm" /> },
  { value: "stash", label: "Stash", icon: <Icon name="stash" size="sm" /> },
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
          icon={<Icon name="findRepository" size="md" />}
          title="No folder selected"
          description="Open a terminal and cd into a folder to see its Git status here."
        />
      </PanelContent>
    );
  }

  // A local folder without .git: offer to initialize one. (Over SSH, git's own
  // error shows in the banner instead.)
  if (error === NOT_A_REPO && !isSSH) {
    return (
      <PanelContent>
        <EmptyState
          icon={<Icon name="repository" size="md" />}
          title="Not a Git repository"
          description={
            <>
              <Tooltip content={cwd}>
                <span
                  data-testid="git-folder-path"
                  tabIndex={0}
                  className="mb-2 block rounded-sm font-mono text-caption text-fg-secondary"
                >
                  {truncateMiddle(cwd)}
                </span>
              </Tooltip>
              Initialize one to track changes, view history and manage branches from here.
            </>
          }
          action={
            <Button size="sm" variant="primary" onClick={() => void initRepo(cwd)}>
              Initialize repository
            </Button>
          }
        />
      </PanelContent>
    );
  }

  // Git could not run or failed before we had any status: stay calm and offer a retry.
  if (error && error !== NOT_A_REPO && !status && !isLoading) {
    return (
      <PanelContent>
        <EmptyState
          icon={<Icon name="findRepository" size="md" />}
          title="Couldn't read Git status"
          description={`Git may not be installed, or this folder isn't accessible. ${error}`}
          action={
            <Button size="sm" variant="secondary" onClick={() => void loadRepo(cwd)}>
              Retry
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
            <IconButton label="Back to changes" icon={<Icon name="back" size="sm" />} onClick={() => setDiff(null)} />
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
      <PanelToolbar aria-label="Git actions" className="@container">
        {/* Icons only at the default sidebar width; labels return when it is wide enough to fit them. */}
        <SegmentedControl
          size="sm"
          aria-label="Git view"
          value={view}
          onValueChange={setView}
          options={VIEWS}
          labelClassName="sr-only @[340px]:not-sr-only"
        />
        <ToolbarSpacer />
        <ToolbarButton>
          <IconButton
            label="Refresh"
            icon={isLoading ? <Spinner size={14} label="Refreshing" /> : <Icon name="refresh" size="sm" />}
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
