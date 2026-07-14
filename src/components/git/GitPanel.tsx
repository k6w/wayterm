import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGitStore } from '../../stores/git';
import { useTerminalStore } from '../../stores/terminal';
import { GitBranch as BranchIcon, GitCommit as CommitIcon, RefreshCw, Upload, Download, Archive, X, Check, Plus, Trash2, FileDiff, FolderGit2 } from 'lucide-react';
import DiffViewer from './DiffViewer';
import { EmptyState } from '../ui/EmptyState';
import { IconButton } from '../ui/Button';
import type { GitDiff } from '../../types/git';

export function GitPanel() {
  const { status, branches, commits, currentBranch, isLoading, error, fetchStatus, fetchBranches, fetchCommits, fetchDiff, initRepo, checkout, pull, push, commit, stage, unstage, stash, applyStash, dropStash } = useGitStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [view, setView] = useState<'status' | 'branches' | 'commits' | 'stash'>('status');
  const [diffData, setDiffData] = useState<GitDiff[] | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const activePaneId = useTerminalStore((s) => s.activePaneId);
  const panes = useTerminalStore((s) => s.panes);
  const activePane = activePaneId ? panes[activePaneId] : null;
  const cwd = activePane?.cwd || '';
  const connectionId = activePane?.sshConnectionId;
  const isSSH = activePane?.shellType === 'ssh';
  const [lastCwd, setLastCwd] = useState('');

  // Load status first; only fetch branches/commits if it's actually a repo.
  // Firing all three concurrently used to race on the shared `error` field and
  // surface unrelated messages ("Failed to get branches") for a non-repo folder.
  const loadRepo = useCallback(async (path: string) => {
    const conn = isSSH ? connectionId : undefined;
    const ok = await fetchStatus(path, conn);
    if (ok) {
      fetchBranches(path, conn);
      fetchCommits(path, 50, conn);
    }
  }, [isSSH, connectionId, fetchStatus, fetchBranches, fetchCommits]);

  useEffect(() => {
    if (cwd && cwd !== '~' && cwd.length > 0 && cwd !== lastCwd) {
      setLastCwd(cwd);
      loadRepo(cwd);
    }
  }, [cwd, lastCwd, loadRepo]);

  const handleRefresh = () => {
    if (cwd && cwd !== '~' && cwd.length > 0) {
      loadRepo(cwd);
    }
  };

  const handleStage = async (file: string) => {
    if (cwd) {
      await stage(cwd, [file]);
      fetchStatus(cwd);
    }
  };

  const handleUnstage = async (file: string) => {
    if (cwd) {
      await unstage(cwd, [file]);
      fetchStatus(cwd);
    }
  };

  const handleStageAll = async () => {
    if (cwd && status) {
      const files = [...status.modified, ...status.added, ...status.deleted, ...status.untracked];
      await stage(cwd, files);
      fetchStatus(cwd);
    }
  };

  const handleCommit = async () => {
    if (cwd && commitMessage.trim()) {
      await commit(cwd, commitMessage);
      setCommitMessage('');
      fetchStatus(cwd);
      fetchCommits(cwd, 50);
    }
  };

  const handleCheckout = async (branch: string) => {
    if (cwd) {
      await checkout(cwd, branch);
      fetchStatus(cwd);
      fetchBranches(cwd);
      fetchCommits(cwd, 50);
    }
  };

  const handlePull = async () => {
    if (cwd) {
      await pull(cwd);
      fetchStatus(cwd);
      fetchCommits(cwd, 50);
    }
  };

  const handlePush = async () => {
    if (cwd) {
      await push(cwd);
      fetchStatus(cwd);
    }
  };

  const handleStash = async () => {
    if (cwd) {
      await stash(cwd, 'WIP');
      fetchStatus(cwd);
    }
  };

  const handleShowDiff = useCallback(async (file?: string) => {
    if (!cwd) return;
    const diffs = await fetchDiff(cwd, file);
    setDiffData(diffs);
    setShowDiff(true);
  }, [cwd, fetchDiff]);

  const handleApplyStash = async (index: number) => {
    if (cwd) {
      await applyStash(cwd, index);
      fetchStatus(cwd);
    }
  };

  const handleDropStash = async (index: number) => {
    if (cwd) {
      await dropStash(cwd, index);
    }
  };

  if (!cwd || cwd === '~' || cwd.length === 0) {
    return (
      <EmptyState
        fill
        title="No active terminal with a valid path"
        hint="Navigate to a directory in the terminal to see its Git status here."
      />
    );
  }

  // Local folder with no `.git`: offer to initialize instead of dumping a raw
  // backend error. (SSH non-repos return git's own stderr, handled by the banner.)
  const isNotRepo = error === 'Not a git repository';
  if (isNotRepo && !isSSH) {
    return (
      <EmptyState
        fill
        icon={FolderGit2}
        title="This folder isn't a Git repository yet"
        hint="Initialize one to track changes, view history, and manage branches from here."
        action={{ label: 'Initialize Repository', onClick: () => initRepo(cwd) }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full text-text-primary">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex gap-1">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('status')} className={`px-2 py-1 rounded text-[10px] transition-colors ${view === 'status' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-overlay/[0.08]'}`}>Status</motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('branches')} className={`px-2 py-1 rounded text-[10px] transition-colors ${view === 'branches' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-overlay/[0.08]'}`}>Branches</motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('commits')} className={`px-2 py-1 rounded text-[10px] transition-colors ${view === 'commits' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-overlay/[0.08]'}`}>Commits</motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setView('stash')} className={`px-2 py-1 rounded text-[10px] transition-colors ${view === 'stash' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-overlay/[0.08]'}`}>Stash</motion.button>
        </div>
        <motion.button whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }} onClick={handleRefresh} className="p-1 hover:bg-overlay/[0.08] rounded transition-colors" disabled={isLoading}>
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </motion.button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-3 bg-error/20 text-error text-xs border-b border-border overflow-hidden"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
        {view === 'status' && showDiff && diffData && (
          <motion.div
            key="diff"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <button
                onClick={() => setShowDiff(false)}
                className="p-1 hover:bg-overlay/[0.08] rounded text-text-muted hover:text-text-primary transition-colors"
                title="Back"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-text-secondary">Diff</span>
            </div>
            <DiffViewer diffs={diffData} />
          </motion.div>
        )}

        {view === 'status' && !showDiff && status && (
          <motion.div
            key="status"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="p-3 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BranchIcon className="w-3.5 h-3.5" />
                <span className="font-medium text-xs">{currentBranch || 'main'}</span>
              </div>
              <div className="flex gap-1">
                <IconButton onClick={() => handleShowDiff()} title="View Diff"><FileDiff className="w-3.5 h-3.5" /></IconButton>
                <IconButton onClick={handlePull} title="Pull"><Download className="w-3.5 h-3.5" /></IconButton>
                <IconButton onClick={handlePush} title="Push"><Upload className="w-3.5 h-3.5" /></IconButton>
                <IconButton onClick={handleStash} title="Stash"><Archive className="w-3.5 h-3.5" /></IconButton>
              </div>
            </div>

            <AnimatePresence>
            {status.staged.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-xs font-medium mb-2 text-text-muted">Staged Changes ({status.staged.length})</div>
                {status.staged.map((file, i) => (
                  <motion.div 
                    key={file}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between py-1 px-2 hover:bg-overlay/[0.06] rounded group"
                  >
                    <span className="text-xs text-success">{file}</span>
                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => handleUnstage(file)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-overlay/[0.08] rounded transition-opacity">
                      <X className="w-3 h-3" />
                    </motion.button>
                  </motion.div>
                ))}
              </motion.div>
            )}
            </AnimatePresence>

            <AnimatePresence>
            {(status.modified.length > 0 || status.added.length > 0 || status.deleted.length > 0 || status.untracked.length > 0) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-medium text-text-muted">Changes</div>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleStageAll} className="text-[10px] px-2 py-1 bg-accent text-white rounded hover:opacity-80 transition-opacity">
                    Stage All
                  </motion.button>
                </div>
                {status.modified.map((file, i) => (
                  <motion.div 
                    key={file}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between py-1 px-2 hover:bg-overlay/[0.06] rounded group"
                  >
                    <span className="text-xs text-warning">M {file}</span>
                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => handleStage(file)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-overlay/[0.08] rounded transition-opacity">
                      <Plus className="w-3 h-3" />
                    </motion.button>
                  </motion.div>
                ))}
                {status.added.map((file, i) => (
                  <motion.div 
                    key={file}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (status.modified.length + i) * 0.03 }}
                    className="flex items-center justify-between py-1 px-2 hover:bg-overlay/[0.06] rounded group"
                  >
                    <span className="text-xs text-success">A {file}</span>
                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => handleStage(file)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-overlay/[0.08] rounded transition-opacity">
                      <Plus className="w-3 h-3" />
                    </motion.button>
                  </motion.div>
                ))}
                {status.deleted.map((file, i) => (
                  <motion.div 
                    key={file}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (status.modified.length + status.added.length + i) * 0.03 }}
                    className="flex items-center justify-between py-1 px-2 hover:bg-overlay/[0.06] rounded group"
                  >
                    <span className="text-xs text-error">D {file}</span>
                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => handleStage(file)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-overlay/[0.08] rounded transition-opacity">
                      <Plus className="w-3 h-3" />
                    </motion.button>
                  </motion.div>
                ))}
                {status.untracked.map((file, i) => (
                  <motion.div 
                    key={file}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (status.modified.length + status.added.length + status.deleted.length + i) * 0.03 }}
                    className="flex items-center justify-between py-1 px-2 hover:bg-overlay/[0.06] rounded group"
                  >
                    <span className="text-xs text-text-muted">? {file}</span>
                    <motion.button whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }} onClick={() => handleStage(file)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-overlay/[0.08] rounded transition-opacity">
                      <Plus className="w-3 h-3" />
                    </motion.button>
                  </motion.div>
                ))}
              </motion.div>
            )}
            </AnimatePresence>

            <AnimatePresence>
            {status.staged.length > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="w-full p-2 bg-overlay/[0.05] border border-border rounded text-xs text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent"
                  rows={3}
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCommit}
                  disabled={!commitMessage.trim()}
                  className="w-full px-3 py-1.5 bg-accent text-white rounded text-xs hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
                >
                  <Check className="w-3.5 h-3.5" />
                  Commit
                </motion.button>
              </motion.div>
            )}
            </AnimatePresence>

            {status.staged.length === 0 && status.modified.length === 0 && status.added.length === 0 && status.deleted.length === 0 && status.untracked.length === 0 && (
              <EmptyState icon={Check} title="No changes" hint="Your working tree is clean." />
            )}
          </motion.div>
        )}

        {view === 'branches' && (
          <motion.div 
            key="branches"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="p-3 space-y-1"
          >
            {branches.map((branch, i) => (
              <motion.div
                key={branch.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => !branch.current && handleCheckout(branch.name)}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center justify-between py-2 px-2.5 rounded cursor-pointer transition-colors ${branch.current ? 'bg-accent/20 text-accent' : 'hover:bg-overlay/[0.06]'}`}
              >
                <div className="flex items-center gap-2">
                  <BranchIcon className="w-3.5 h-3.5" />
                  <span className="text-xs">{branch.name}</span>
                </div>
                {branch.current && <Check className="w-3.5 h-3.5" />}
              </motion.div>
            ))}
          </motion.div>
        )}

        {view === 'commits' && (
          <motion.div 
            key="commits"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="p-3 space-y-2"
          >
            {commits.map((commit, i) => (
              <motion.div 
                key={commit.hash}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.01 }}
                className="p-2.5 bg-overlay/[0.03] rounded border border-border space-y-1"
              >
                <div className="flex items-start gap-2">
                  <CommitIcon className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-text-primary break-words">{commit.message}</div>
                    <div className="text-[10px] text-text-muted mt-1">
                      {commit.author} • {new Date(commit.date * 1000).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-text-tertiary font-mono mt-0.5">
                      {commit.hash.substring(0, 7)}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {view === 'stash' && status && (
          <motion.div 
            key="stash"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="p-3 space-y-2"
          >
            {Array.from({ length: status.stashes }).map((_, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.01 }}
                className="p-2.5 bg-overlay/[0.03] rounded border border-border flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-medium text-text-primary">stash@{"{" + index + "}"}</div>
                  <div className="text-[10px] text-text-muted">WIP on current branch</div>
                </div>
                <div className="flex gap-1">
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleApplyStash(index)} className="p-1 hover:bg-overlay/[0.08] rounded transition-colors" title="Apply">
                    <Check className="w-3.5 h-3.5" />
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleDropStash(index)} className="p-1 hover:bg-error/20 rounded text-error transition-colors" title="Drop">
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
            {status.stashes === 0 && (
              <EmptyState icon={Archive} title="No stashes" />
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
