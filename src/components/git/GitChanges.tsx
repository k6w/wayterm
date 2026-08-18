import { useState, type KeyboardEvent } from "react";
import { Archive, Check, Download, FileDiff, GitBranch, Minus, Plus, Upload } from "lucide-react";
import { isMac } from "../../lib/platform";
import {
  Badge,
  Button,
  EmptyState,
  ICON_MD,
  ICON_SM,
  IconButton,
  ListRow,
  Textarea,
  Toolbar,
  ToolbarButton,
  ToolbarSpacer,
} from "../../ui";
import { PanelGroup } from "../sidebar/PanelChrome";
import { CHANGE_CODES, changeGroups, type ChangeRow } from "./git-changes";
import type { GitStatus } from "../../types/git";

interface GitChangesProps {
  status: GitStatus;
  branch: string | null;
  onShowDiff: (file?: string, staged?: boolean) => void;
  onPull: () => void;
  onPush: () => void;
  onStash: () => void;
  onStage: (files: string[]) => void;
  onUnstage: (file: string) => void;
  onCommit: (message: string) => Promise<void>;
}

/** The Status view: branch actions, staged and unstaged changes, and the commit box. */
export default function GitChanges({
  status,
  branch,
  onShowDiff,
  onPull,
  onPush,
  onStash,
  onStage,
  onUnstage,
  onCommit,
}: GitChangesProps) {
  const [message, setMessage] = useState("");
  const { staged, unstaged } = changeGroups(status);

  const commit = async () => {
    if (!message.trim()) return;
    await onCommit(message);
    setMessage("");
  };

  const handleMessageKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (isMac ? event.metaKey : event.ctrlKey)) {
      event.preventDefault();
      void commit();
    }
  };

  const row = (change: ChangeRow, action: "stage" | "unstage") => {
    const code = CHANGE_CODES[change.code];
    return (
      <ListRow
        key={`${change.code}:${change.path}`}
        icon={
          <Badge tone={code.tone} title={code.label} className="w-4 justify-center">
            {change.code}
          </Badge>
        }
        label={<span className="font-mono">{change.path}</span>}
        aria-label={`${change.path}, ${code.label.toLowerCase()}. Show diff`}
        onSelect={() => onShowDiff(change.path, change.staged)}
        actions={
          action === "stage" ? (
            <IconButton size="xs" label={`Stage ${change.path}`} icon={<Plus {...ICON_SM} />} onClick={() => onStage([change.path])} />
          ) : (
            <IconButton size="xs" label={`Unstage ${change.path}`} icon={<Minus {...ICON_SM} />} onClick={() => onUnstage(change.path)} />
          )
        }
      />
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Toolbar aria-label="Repository actions" className="h-7 gap-1 pl-2">
        <GitBranch {...ICON_SM} aria-hidden className="shrink-0 text-fg-muted" />
        <span className="min-w-0 truncate text-label font-medium text-fg">{branch || "main"}</span>
        <ToolbarSpacer />
        <ToolbarButton>
          <IconButton label="View diff" icon={<FileDiff {...ICON_SM} />} onClick={() => onShowDiff()} />
        </ToolbarButton>
        <ToolbarButton>
          <IconButton label="Pull" icon={<Download {...ICON_SM} />} onClick={onPull} />
        </ToolbarButton>
        <ToolbarButton>
          <IconButton label="Push" icon={<Upload {...ICON_SM} />} onClick={onPush} />
        </ToolbarButton>
        <ToolbarButton>
          <IconButton label="Stash" icon={<Archive {...ICON_SM} />} onClick={onStash} />
        </ToolbarButton>
      </Toolbar>

      {staged.length === 0 && unstaged.length === 0 ? (
        <EmptyState icon={<Check {...ICON_MD} />} title="No changes" description="Your working tree is clean." />
      ) : (
        <>
          {staged.length > 0 && (
            <PanelGroup title="Staged" count={staged.length}>
              {staged.map((change) => row(change, "unstage"))}
            </PanelGroup>
          )}
          {unstaged.length > 0 && (
            <PanelGroup
              title="Changes"
              count={unstaged.length}
              actions={
                <Button size="xs" variant="ghost" onClick={() => onStage(unstaged.map((c) => c.path))}>
                  Stage all
                </Button>
              }
            >
              {unstaged.map((change) => row(change, "stage"))}
            </PanelGroup>
          )}
        </>
      )}

      {staged.length > 0 && (
        <div className="flex flex-col gap-2 px-2 pb-2">
          <Textarea
            aria-label="Commit message"
            placeholder="Commit message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleMessageKey}
          />
          <Button
            variant="primary"
            leadingIcon={<Check {...ICON_SM} />}
            shortcut="Mod+Enter"
            disabled={!message.trim()}
            onClick={() => void commit()}
          >
            Commit
          </Button>
        </div>
      )}
    </div>
  );
}
