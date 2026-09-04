import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GitPanel } from "./GitPanel";
import { useGitStore } from "../../stores/git";
import { useTerminalStore } from "../../stores/terminal";
import type { GitStatus } from "../../types/git";

const STATUS: GitStatus = {
  branch: "main",
  ahead: 0,
  behind: 0,
  staged: ["src/a.ts"],
  modified: ["src/b.ts"],
  added: [],
  deleted: ["old.txt"],
  untracked: [],
  conflicted: 0,
  stashes: 1,
};

const actions = {
  fetchStatus: vi.fn(async () => true),
  fetchBranches: vi.fn(async () => {}),
  fetchCommits: vi.fn(async () => {}),
  fetchDiff: vi.fn(async () => [{ file: "src/b.ts", additions: 1, deletions: 0, changes: "@@ -1 +1 @@\n+x" }]),
  initRepo: vi.fn(async () => {}),
  checkout: vi.fn(async () => {}),
  pull: vi.fn(async () => {}),
  push: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  stage: vi.fn(async () => {}),
  unstage: vi.fn(async () => {}),
  stash: vi.fn(async () => {}),
  applyStash: vi.fn(async () => {}),
  dropStash: vi.fn(async () => {}),
};

function setPane(cwd: string) {
  useTerminalStore.setState({
    activePaneId: "p1",
    panes: { p1: { id: "p1", sessionId: "s1", isActive: true, cwd, shellType: "zsh" } },
  });
}

beforeEach(() => {
  for (const fn of Object.values(actions)) fn.mockClear();
  useGitStore.setState({
    status: STATUS,
    branches: [
      { name: "main", current: true, remote: false },
      { name: "feature", current: false, remote: false },
    ],
    commits: [],
    currentBranch: "main",
    isLoading: false,
    error: null,
    ...actions,
  });
  setPane("/repo");
});

describe("GitPanel", () => {
  it("loads the repo of the active pane and groups staged and unstaged changes", async () => {
    render(<GitPanel />);
    await waitFor(() => expect(actions.fetchStatus).toHaveBeenCalledWith("/repo", undefined));
    const staged = screen.getByRole("region", { name: "Staged" });
    const changes = screen.getByRole("region", { name: "Changes" });
    expect(within(staged).getByRole("button", { name: /src\/a\.ts, staged/ })).toBeInTheDocument();
    expect(within(changes).getByRole("button", { name: /src\/b\.ts, modified/ })).toBeInTheDocument();
    expect(within(changes).getByRole("button", { name: /old\.txt, deleted/ })).toBeInTheDocument();
  });

  it("stages, stages all and unstages from the rows", async () => {
    const user = userEvent.setup();
    render(<GitPanel />);
    await user.click(screen.getByRole("button", { name: "Stage src/b.ts" }));
    expect(actions.stage).toHaveBeenCalledWith("/repo", ["src/b.ts"]);
    await user.click(screen.getByRole("button", { name: "Stage all" }));
    expect(actions.stage).toHaveBeenLastCalledWith("/repo", ["src/b.ts", "old.txt"]);
    await user.click(screen.getByRole("button", { name: "Unstage src/a.ts" }));
    expect(actions.unstage).toHaveBeenCalledWith("/repo", ["src/a.ts"]);
  });

  it("commits with Mod+Enter and clears the message", async () => {
    const user = userEvent.setup();
    render(<GitPanel />);
    const box = screen.getByRole("textbox", { name: "Commit message" });
    await user.type(box, "fix: things{Control>}{Enter}{/Control}");
    await waitFor(() => expect(actions.commit).toHaveBeenCalledWith("/repo", "fix: things"));
    await waitFor(() => expect(box).toHaveValue(""));
  });

  it("opens the diff of a file from its row and goes back", async () => {
    const user = userEvent.setup();
    render(<GitPanel />);
    await user.click(screen.getByRole("button", { name: /src\/b\.ts, modified/ }));
    expect(actions.fetchDiff).toHaveBeenCalledWith("/repo", "src/b.ts", undefined);
    expect(await screen.findByText("1 file changed")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to changes" }));
    expect(screen.getByRole("region", { name: "Staged" })).toBeInTheDocument();
  });

  it("requests the staged diff for a staged file", async () => {
    const user = userEvent.setup();
    render(<GitPanel />);
    await user.click(screen.getByRole("button", { name: /src\/a\.ts, staged/ }));
    expect(actions.fetchDiff).toHaveBeenCalledWith("/repo", "src/a.ts", true);
  });

  it("collapses the view tabs to icons at narrow widths, keeping names and tooltips", () => {
    render(<GitPanel />);
    const tab = screen.getByRole("radio", { name: "Stash" });
    expect(tab).toHaveAttribute("title", "Stash");
    expect(within(tab).getByText("Stash")).toHaveClass("sr-only", "@[340px]:not-sr-only");
    expect(tab.querySelector("svg")).not.toBeNull();
  });

  it("switches views and checks out another branch", async () => {
    const user = userEvent.setup();
    render(<GitPanel />);
    await user.click(screen.getByRole("radio", { name: "Branches" }));
    await user.click(screen.getByRole("button", { name: "feature" }));
    expect(actions.checkout).toHaveBeenCalledWith("/repo", "feature");
  });

  it("says No folder selected, calmly, when the pane has no known folder", () => {
    setPane("");
    render(<GitPanel />);
    const title = screen.getByText("No folder selected");
    expect(title.closest("div")).not.toHaveClass("h-full");
    expect(screen.getByText(/open a terminal|change to a folder|cd into/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/error|fail/i)).not.toBeInTheDocument();
  });

  describe("outside a repository", () => {
    beforeEach(() => {
      setPane("/Users/me/projects/some/long/nested/folder/name");
      useGitStore.setState({ error: "Not a git repository", status: null, fetchStatus: vi.fn(async () => false) });
    });

    it("explains it, shows the middle-truncated folder with the full path on hover, and offers git init", async () => {
      const user = userEvent.setup();
      render(<GitPanel />);
      expect(screen.getByText("Not a Git repository")).toBeInTheDocument();
      const path = screen.getByTestId("git-folder-path");
      expect(path).toHaveClass("font-mono");
      expect(path.textContent).toContain("…");
      expect(path.textContent!.length).toBeLessThan("/Users/me/projects/some/long/nested/folder/name".length);
      expect(path.textContent!.endsWith("name")).toBe(true);
      await user.hover(path);
      expect((await screen.findAllByText("/Users/me/projects/some/long/nested/folder/name")).length).toBeGreaterThan(0);
      await user.click(screen.getByRole("button", { name: "Initialize repository" }));
      expect(actions.initRepo).toHaveBeenCalledWith("/Users/me/projects/some/long/nested/folder/name");
    });

    it("shows a short path whole", () => {
      setPane("/tmp/x");
      render(<GitPanel />);
      expect(screen.getByTestId("git-folder-path")).toHaveTextContent("/tmp/x");
    });
  });

  it("shows a calm message with Retry, not a red alert, when git cannot run", async () => {
    const user = userEvent.setup();
    const fetchStatus = vi.fn(async () => false);
    useGitStore.setState({ status: null, error: "Failed to execute git: No such file or directory", fetchStatus });
    render(<GitPanel />);
    expect(screen.getByText("Couldn't read Git status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fetchStatus.mockClear();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(fetchStatus).toHaveBeenCalledWith("/repo", undefined);
  });

  it("shows Working tree clean with the branch badge when nothing changed", () => {
    useGitStore.setState({
      status: { ...STATUS, staged: [], modified: [], deleted: [], stashes: 0 },
    });
    render(<GitPanel />);
    expect(screen.getByText("Working tree clean")).toBeInTheDocument();
    expect(screen.getByTestId("git-clean-branch")).toHaveTextContent("main");
  });

  it("gives the header branch the remaining width instead of a spacer", () => {
    useGitStore.setState({ currentBranch: "redesign/phase-5-settings", status: { ...STATUS, branch: "redesign/phase-5-settings" } });
    render(<GitPanel />);
    const toolbar = screen.getByRole("toolbar", { name: "Repository actions" });
    const branch = within(toolbar).getByText("redesign/phase-5-settings").parentElement as HTMLElement;
    expect(branch).toHaveClass("flex-1", "min-w-0", "whitespace-nowrap");
  });
});
