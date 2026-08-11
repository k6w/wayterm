import { Archive, Check, GitBranch, GitCommit, Trash2 } from "lucide-react";
import { Badge, EmptyState, ICON_MD, ICON_SM, IconButton, ListRow } from "../../ui";
import type { GitBranch as Branch, GitCommit as Commit } from "../../types/git";

/** Branches; selecting another branch checks it out. */
export function GitBranches({ branches, onCheckout }: { branches: Branch[]; onCheckout: (name: string) => void }) {
  if (branches.length === 0) return <EmptyState icon={<GitBranch {...ICON_MD} />} title="No branches" />;
  return (
    <div className="flex flex-col">
      {branches.map((branch) => (
        <ListRow
          key={branch.name}
          icon={<GitBranch {...ICON_SM} />}
          label={branch.name}
          selected={branch.current}
          trailing={branch.current ? <Badge tone="accent">Current</Badge> : undefined}
          onSelect={() => {
            if (!branch.current) onCheckout(branch.name);
          }}
        />
      ))}
    </div>
  );
}

/** The last commits (read-only). */
export function GitCommits({ commits }: { commits: Commit[] }) {
  if (commits.length === 0) return <EmptyState icon={<GitCommit {...ICON_MD} />} title="No commits yet" />;
  return (
    <ol aria-label="Recent commits" className="flex flex-col">
      {commits.map((commit) => (
        <li key={commit.hash} className="flex gap-2 rounded-md px-2 py-1.5">
          <GitCommit {...ICON_SM} aria-hidden className="mt-0.5 shrink-0 text-fg-muted" />
          <div className="min-w-0 flex-1">
            <p className="break-words text-body text-fg">{commit.message}</p>
            <p className="truncate text-label text-fg-muted">
              {commit.author} · {new Date(commit.date * 1000).toLocaleString()} ·{" "}
              <span className="font-mono">{commit.hash.substring(0, 7)}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Stash entries with apply and drop. */
export function GitStashes({
  count,
  onApply,
  onDrop,
}: {
  count: number;
  onApply: (index: number) => void;
  onDrop: (index: number) => void;
}) {
  if (count === 0) return <EmptyState icon={<Archive {...ICON_MD} />} title="No stashes" />;
  return (
    <ul aria-label="Stashes" className="flex flex-col">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="flex min-h-row items-center gap-2 rounded-md px-2 py-1 hover:bg-hover">
          <Archive {...ICON_SM} aria-hidden className="shrink-0 text-fg-muted" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-body text-fg">{`stash@{${index}}`}</p>
            <p className="text-label text-fg-muted">WIP on current branch</p>
          </div>
          <IconButton size="xs" label={`Apply stash ${index}`} icon={<Check {...ICON_SM} />} onClick={() => onApply(index)} />
          <IconButton size="xs" label={`Drop stash ${index}`} icon={<Trash2 {...ICON_SM} />} onClick={() => onDrop(index)} />
        </li>
      ))}
    </ul>
  );
}
