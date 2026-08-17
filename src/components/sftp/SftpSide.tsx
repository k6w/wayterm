import type { ReactNode } from "react";
import { ArrowUp } from "lucide-react";
import { Badge, ICON_SM, IconButton, Spinner, Toolbar } from "../../ui";
import type { SftpBrowser } from "./useSftpBrowser";
import type { SftpSide as Side } from "./file-table";
import FileTable from "./FileTable";
import PathBreadcrumb from "./PathBreadcrumb";
import { parentPath } from "./sftp-paths";

interface SftpSideProps {
  side: Side;
  browser: SftpBrowser;
  /** This side's action buttons (each wrapped in a ToolbarButton). */
  actions: ReactNode;
}

/** One side of the browser: path bar, action toolbar, file table. */
export default function SftpSide({ side, browser, actions }: SftpSideProps) {
  const remote = side === "remote";
  const name = remote ? "Remote" : "Local";
  const cwd = remote ? browser.remoteCwd : browser.localCwd;
  return (
    <section aria-label={`${name} files`} className="flex h-full min-w-0 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-1.5">
        <Badge>{name}</Badge>
        <IconButton size="xs" label="Up one folder" icon={<ArrowUp {...ICON_SM} />} onClick={() => browser.navigate(side, parentPath(cwd))} />
        <PathBreadcrumb path={cwd} onNavigate={(path) => browser.navigate(side, path)} label={name} showBookmarks={remote} />
        {remote && browser.busy && <Spinner size={14} label="Working" />}
      </div>
      <Toolbar aria-label={`${name} actions`} className="h-8 shrink-0 gap-0.5 border-b border-border px-1.5">
        {actions}
      </Toolbar>
      <FileTable
        side={side}
        label={`${name} files`}
        entries={remote ? browser.remoteEntries : browser.localEntries}
        selected={browser.selected[side]}
        onSelectionChange={(next) => browser.setSelection(side, next)}
        onOpen={(entry) => browser.navigate(side, entry.path)}
        onAction={(action, entry) => browser.runAction(side, action, entry)}
        onDragStart={browser.dragStart(side)}
        onDragEnd={browser.dragEnd}
        onDrop={browser.drop(side)}
      />
    </section>
  );
}
