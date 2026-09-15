import { Icon } from "../../ui/icons";
import { IconButton } from "../../ui";
import { useTerminalStore } from "../../stores/terminal";

/** A small dismissible note at the top of a pane (e.g. a restored folder that no longer exists). */
export default function PaneNotice({ paneId }: { paneId: string }) {
  const notice = useTerminalStore((s) => s.panes[paneId]?.notice);
  if (!notice) return null;
  return (
    <div
      role="status"
      className="absolute inset-x-2 top-2 z-20 flex items-center gap-2 rounded-md border border-border bg-warning-subtle py-1 pl-2 pr-1 text-label text-warning"
    >
      <Icon name="warning" size="sm" aria-hidden className="shrink-0" />
      <span className="min-w-0 flex-1 truncate" title={notice}>
        {notice}
      </span>
      <IconButton
        size="xs"
        label="Dismiss notice"
        icon={<Icon name="close" size="sm" />}
        onClick={() => useTerminalStore.getState().updatePane(paneId, { notice: undefined })}
      />
    </div>
  );
}
