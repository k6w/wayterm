import { useEffect } from 'react';
import { useGitStore } from '../../stores/git';
import { useTerminalStore } from '../../stores/terminal';
import { GitBranch, GitCommit } from 'lucide-react';

export function GitStatusWidget() {
  const { status, currentBranch, fetchStatus } = useGitStore();
  const { activeTabId, tabs } = useTerminalStore();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const cwd = activeTab?.cwd || '';

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
    <div className="flex items-center gap-2 px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] rounded cursor-pointer">
      <GitBranch className="w-3 h-3" />
      <span>{currentBranch || 'main'}</span>
      {totalChanges > 0 && (
        <>
          <span className="text-yellow-500">●{totalChanges}</span>
          {stagedCount > 0 && <span className="text-green-500">+{stagedCount}</span>}
        </>
      )}
    </div>
  );
}
