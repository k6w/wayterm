import { GitBranch, Folder, Circle } from "lucide-react";
import { shortenPath } from "../../lib/format";

interface ContextRibbonProps {
  cwd: string;
  gitBranch: string | null;
  gitDirty: boolean;
}

export default function ContextRibbon({
  cwd,
  gitBranch,
  gitDirty,
}: ContextRibbonProps) {
  const displayPath = shortenPath(cwd);

  return (
    <div
      className="flex items-center gap-2 px-3 text-xs text-text-secondary"
      style={{ height: 28 }}
    >
      {gitBranch && (
        <>
          <div className="flex items-center gap-1">
            <GitBranch size={14} className="shrink-0" />
            <span className="truncate">{gitBranch}</span>
            {gitDirty && (
              <Circle
                size={8}
                className="shrink-0 fill-warning text-warning"
              />
            )}
          </div>
          <span className="text-text-muted">{"/"}</span>
        </>
      )}
      {cwd && (
        <div className="flex items-center gap-1 truncate">
          <Folder size={14} className="shrink-0" />
          <span className="truncate">{displayPath}</span>
        </div>
      )}
    </div>
  );
}
