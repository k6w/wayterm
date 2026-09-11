import { useState } from "react";
import { Icon } from "../../ui/icons";
import { useTerminalStore } from "../../stores/terminal";
import { useSftpStore } from "../../stores/sftp";
import { Button, EmptyState, IconButton, SplitPane, Spinner, ToolbarButton, ToolbarSeparator, ToolbarSpacer, ConfirmDialog, InputDialog } from "../../ui";
import HostKeyDialog from "../ssh/HostKeyDialog";
import FileConflictDialog from "./FileConflictDialog";
import SftpSide from "./SftpSide";
import TransferQueue from "./TransferQueue";
import { useSftpBrowser } from "./useSftpBrowser";
import { useSftpSession } from "./useSftpSession";

interface SftpPaneProps {
  paneId: string;
  isActive: boolean;
  paneCount?: number;
}

/**
 * SFTP pane: local files (collapsible, left) and remote files (right) on a
 * resizable split, each with a path bar and toolbar, and the transfer queue
 * docked underneath.
 */
export default function SftpPane({ paneId, isActive, paneCount = 1 }: SftpPaneProps) {
  const setActivePane = useTerminalStore((s) => s.setActivePane);
  const closePaneInTab = useTerminalStore((s) => s.closePaneInTab);
  const detachPaneToTab = useTerminalStore((s) => s.detachPaneToTab);
  const transfers = useSftpStore((s) => s.transfers);
  const clearCompleted = useSftpStore((s) => s.clearCompletedTransfers);

  const sftp = useSftpSession(paneId);
  const browser = useSftpBrowser(sftp.sessionId, isActive);
  const [localRatio, setLocalRatio] = useState(0.45);

  const hostKeyDialog = (
    <HostKeyDialog
      prompt={sftp.hostKeyPrompt}
      pending={sftp.trusting}
      replaceError={sftp.replaceError}
      onTrust={sftp.trustHost}
      onReplace={sftp.replaceHostKey}
      onOpenSettings={sftp.openSshSettings}
      onCancel={sftp.cancelHostKey}
    />
  );

  if (sftp.connecting || sftp.error || sftp.hostKeyPrompt) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center"
        onMouseDown={() => setActivePane(paneId)}
      >
        {sftp.error ? (
          <EmptyState
            icon={<Icon name="error" size="md" />}
            title="Connection failed"
            description={sftp.error}
            action={
              <Button size="sm" variant="primary" leadingIcon={<Icon name="refresh" size="sm" />} onClick={sftp.retry}>
                Retry
              </Button>
            }
          />
        ) : sftp.hostKeyPrompt?.kind === "changed" ? (
          <>
            <p className="text-body font-medium text-danger">Host key changed</p>
            <p className="text-label text-fg-muted">Verify the server fingerprint</p>
          </>
        ) : sftp.hostKeyPrompt ? (
          <>
            <p className="text-body font-medium text-warning">Unknown host</p>
            <p className="text-label text-fg-muted">Verify the server fingerprint</p>
          </>
        ) : (
          <>
            <Spinner size={16} label="Connecting" />
            <p className="text-body text-fg-secondary">Connecting to {sftp.connectionName}...</p>
            <p className="text-label text-fg-muted">Establishing SFTP session</p>
          </>
        )}
        {hostKeyDialog}
      </div>
    );
  }

  const { selected } = browser;
  const remoteOne = selected.remote.size === 1;

  const local = (
    <SftpSide
      side="local"
      browser={browser}
      actions={
        <>
          <ToolbarButton>
            <IconButton
              label="Upload selected"
              icon={<Icon name="upload" size="sm" />}
              disabled={selected.local.size === 0}
              onClick={browser.uploadSelected}
            />
          </ToolbarButton>
          <ToolbarButton>
            <IconButton label="Refresh" icon={<Icon name="refresh" size="sm" />} onClick={browser.refresh} />
          </ToolbarButton>
        </>
      }
    />
  );

  const remote = (
    <SftpSide
      side="remote"
      browser={browser}
      actions={
        <>
          <ToolbarButton>
            <IconButton
              label={browser.localCollapsed ? "Show local files" : "Hide local files"}
              pressed={!browser.localCollapsed}
              icon={browser.localCollapsed ? <Icon name="sidebar" size="sm" /> : <Icon name="sidebarClose" size="sm" />}
              onClick={browser.toggleLocal}
            />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton>
            <IconButton
              label="Download selected"
              icon={<Icon name="download" size="sm" />}
              disabled={selected.remote.size === 0}
              onClick={browser.downloadSelected}
            />
          </ToolbarButton>
          <ToolbarButton>
            <IconButton label="New folder" icon={<Icon name="newFolder" size="sm" />} onClick={browser.requestNewFolder} />
          </ToolbarButton>
          <ToolbarButton>
            <IconButton label="Rename" icon={<Icon name="rename" size="sm" />} disabled={!remoteOne} onClick={browser.requestRename} />
          </ToolbarButton>
          <ToolbarButton>
            <IconButton
              label="Delete"
              icon={<Icon name="delete" size="sm" />}
              disabled={selected.remote.size === 0}
              onClick={browser.requestDelete}
            />
          </ToolbarButton>
          <ToolbarButton>
            <IconButton label="Refresh" icon={<Icon name="refresh" size="sm" />} onClick={browser.refresh} />
          </ToolbarButton>
          {paneCount > 1 && (
            <>
              <ToolbarSpacer />
              <ToolbarButton>
                <IconButton label="Detach to tab" icon={<Icon name="detach" size="sm" />} onClick={() => detachPaneToTab(paneId)} />
              </ToolbarButton>
              <ToolbarButton>
                <IconButton label="Close pane" icon={<Icon name="close" size="sm" />} onClick={() => closePaneInTab(paneId)} />
              </ToolbarButton>
            </>
          )}
        </>
      }
    />
  );

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" onMouseDown={() => setActivePane(paneId)}>
      <div className="min-h-0 flex-1">
        <SplitPane
          ratio={localRatio}
          onRatioChange={setLocalRatio}
          min={0.2}
          max={0.8}
          collapsed={browser.localCollapsed}
          separatorLabel="Resize local and remote files"
          first={local}
          second={remote}
        />
      </div>

      <TransferQueue transfers={transfers} onClearCompleted={clearCompleted} />

      <ConfirmDialog
        open={browser.deleting !== null}
        title={
          browser.deleting && browser.deleting.length > 1
            ? `Delete ${browser.deleting.length} items?`
            : `Delete "${browser.deleting?.[0]?.name ?? ""}"?`
        }
        message="This action cannot be undone. The selected items will be permanently removed from the remote server."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => void browser.confirmDelete()}
        onCancel={browser.cancelDelete}
      />

      <InputDialog
        open={browser.renaming !== null}
        title="Rename"
        label="Enter a new name for this item."
        defaultValue={browser.renaming?.name ?? ""}
        placeholder="New name"
        confirmLabel="Rename"
        onConfirm={(name) => void browser.confirmRename(name)}
        onCancel={browser.cancelRename}
      />

      <InputDialog
        open={browser.creatingFolder}
        title="New folder"
        label="Enter a name for the new folder."
        placeholder="Folder name"
        confirmLabel="Create"
        onConfirm={(name) => void browser.confirmNewFolder(name)}
        onCancel={browser.cancelNewFolder}
      />

      <FileConflictDialog
        open={browser.conflict !== null}
        fileName={browser.conflict?.fileName ?? ""}
        remoteNames={new Set(browser.remoteEntries.map((e) => e.name))}
        remoteDir={browser.remoteCwd}
        onReplace={() => browser.resolveConflict("replace")}
        onRename={(renameTo) => browser.resolveConflict({ renameTo })}
        onSkip={() => browser.resolveConflict("skip")}
      />

      {browser.desktopDragOver && (
        <div className="pointer-events-none absolute inset-0 z-[var(--z-divider)] flex items-center justify-center border-2 border-dashed border-accent bg-accent-subtle">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-raised px-8 py-6 shadow-popover">
            <Icon name="upload" size="md" aria-hidden className="text-accent-fg" />
            <p className="text-body font-medium text-fg">Drop files to upload</p>
            <p className="text-label text-fg-muted">They go to {browser.remoteCwd}</p>
          </div>
        </div>
      )}
    </div>
  );
}
