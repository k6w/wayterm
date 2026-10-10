import type { CSSProperties } from "react";
import { Icon, Icons } from "../../ui/icons";
import type { SplitNode, TerminalPane } from "../../types/terminal";

interface TerminalTreeProps {
  node: SplitNode;
  panes: Record<string, TerminalPane>;
}

const SHELL_LABELS: Record<string, string> = {
  powershell: "PowerShell",
  cmd: "CMD",
  gitbash: "Git Bash",
  wsl: "WSL",
  bash: "Bash",
  zsh: "Zsh",
  fish: "Fish",
  sh: "Shell",
  ssh: "SSH",
};

function TreeNode({
  node,
  panes,
  depth,
}: {
  node: SplitNode;
  panes: Record<string, TerminalPane>;
  depth: number;
}) {
  if (node.type === "pane") {
    const pane = node.paneId ? panes[node.paneId] : undefined;
    const label = pane
      ? SHELL_LABELS[pane.shellType] ?? pane.shellType
      : "Terminal";

    return (
      <div
        className="flex items-center gap-1.5 py-0.5 pl-[calc(var(--wt-dyn-depth)*12px)] text-text-primary"
        style={{ "--wt-dyn-depth": depth } as CSSProperties}
      >
        <Icon name="terminal" className="size-3 shrink-0 text-text-muted" />
        <span className="truncate text-xs">{label}</span>
      </div>
    );
  }

  const isHorizontal = node.direction === "horizontal";
  const DirectionIcon = isHorizontal ? Icons.splitHorizontal : Icons.splitVertical;
  const directionLabel = isHorizontal ? "Split H" : "Split V";

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-0.5 pl-[calc(var(--wt-dyn-depth)*12px)] text-text-muted"
        style={{ "--wt-dyn-depth": depth } as CSSProperties}
      >
        <DirectionIcon className="size-3 shrink-0" />
        <span className="truncate text-xs">{directionLabel}</span>
      </div>
      {node.children?.map((child, index) => (
        <TreeNode
          key={`${depth}-${index}`}
          node={child}
          panes={panes}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function TerminalTree({ node, panes }: TerminalTreeProps) {
  return (
    <div className="min-w-[120px] rounded border border-border bg-bg-tertiary px-2 py-1.5">
      <TreeNode node={node} panes={panes} depth={0} />
    </div>
  );
}
