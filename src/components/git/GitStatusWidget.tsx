import { useEffect } from 'react';
import { useGitStore } from '../../stores/git';
import { useTerminalStore } from '../../stores/terminal';
import { Icon } from "../../ui/icons";
import { MiddleTruncate } from '../../ui';

export function GitStatusWidget() {
  const { status, currentBranch, fetchStatus } = useGitStore();

  const activePaneId = useTerminalStore((s) => s.activePaneId);
  const panes = useTerminalStore((s) => s.panes);
  const activePane = activePaneId ? panes[activePaneId] : null;
  const cwd = activePane?.cwd || '';

  useEffect(() => {
    if (cwd && cwd !== '~' && cwd.length > 0) {
      fetchStatus(cwd);
      const interval = setInterval(() => {
        if (cwd && cwd !== '~' && cwd.length > 0) {
          fetchStatus(cwd);
        }
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [cwd, fetchStatus]);

  if (!cwd || cwd === '~' || cwd.length === 0 || !status) {
    return null;
  }

  const totalChanges = status.modified.length + status.added.length + status.deleted.length + status.untracked.length;
  const stagedCount = status.staged.length;

  return (
    <div data-git-branch className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-1.5 h-5 text-[11px] text-text-muted rounded cursor-pointer hover:bg-bg-tertiary transition-colors">
      <Icon name="gitBranch" size={12} className="shrink-0" />
      <MiddleTruncate text={currentBranch || 'main'} className="max-w-48" />
      {totalChanges > 0 && (
        <>
          <span className="text-warning">●{totalChanges}</span>
          {stagedCount > 0 && <span className="text-success">+{stagedCount}</span>}
        </>
      )}
    </div>
  );
}
