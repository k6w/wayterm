import { IconButton } from "../../../ui";
import { Icon } from "../../../ui/icons";
import type { Block, BlockTracker } from "../../../lib/blocks/block-tracker";
import { canRerun, copyBlocks, rerunBlock, shareBlock } from "../../../lib/blocks/block-actions";
import { useBlockViewer } from "./BlockOutputDialog";

export interface BlockToolbarProps {
  paneId: string;
  tracker: BlockTracker;
  block: Block;
}

/** Re-run runs only commands our script reported (trusted); others are pasted for review. */
export function rerunLabel(block: Block): string {
  return block.trusted ? "Re-run" : "Paste command";
}

/** Actions for one command block, shown while the mouse is over it. */
export function BlockToolbar({ paneId, tracker, block }: BlockToolbarProps) {
  const hasOutput = !!block.outputStart;
  const idle = canRerun(tracker);
  return (
    <div
      role="toolbar"
      aria-label="Command block actions"
      className="flex items-center gap-px rounded-md border border-border bg-raised p-px shadow-popover"
      // Keep the terminal's focus and selection: these buttons act on the block, not on text.
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <IconButton
        size="xs"
        label="Copy command"
        icon={<Icon name="copyCommand" size={12} />}
        onClick={() => copyBlocks(paneId, "command", block)}
      />
      <IconButton
        size="xs"
        label="Copy output"
        icon={<Icon name="copyOutput" size={12} />}
        disabled={!hasOutput}
        onClick={() => copyBlocks(paneId, "output", block)}
      />
      <IconButton
        size="xs"
        label="Copy command and output"
        icon={<Icon name="copyBlock" size={12} />}
        onClick={() => copyBlocks(paneId, "both", block)}
      />
      <IconButton
        size="xs"
        label={idle ? rerunLabel(block) : `${rerunLabel(block)} (the shell is busy)`}
        icon={<Icon name="rerun" size={12} />}
        disabled={!idle}
        onClick={() => rerunBlock(paneId, block)}
      />
      <IconButton
        size="xs"
        label="View output"
        icon={<Icon name="viewOutput" size={12} />}
        disabled={!hasOutput}
        onClick={() =>
          useBlockViewer.getState().show(paneId, tracker.getCommandText(block), tracker.getOutputText(block))
        }
      />
      <IconButton
        size="xs"
        label="Copy as text to share"
        icon={<Icon name="share" size={12} />}
        onClick={() => shareBlock(paneId, block)}
      />
    </div>
  );
}
