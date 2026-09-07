import { Icon } from "../../ui/icons";
import { IconButton } from "../../ui";

interface PaneControlsProps {
  /** The search bar occupies the top edge of the pane; sit below it. */
  searchOpen: boolean;
  onDetach: () => void;
  onClose: () => void;
}

/**
 * Detach / close buttons in the top-right corner of a split pane, floating in
 * the strip TerminalPane reserves above the first terminal row (so no text is
 * ever under them). Shown only while the pane (PaneFrame's group/pane) is
 * hovered or keyboard focus is inside the controls themselves. Pane focus must
 * not latch them: terminal focus stays in the pane after the pointer leaves.
 */
export default function PaneControls({ searchOpen, onDetach, onClose }: PaneControlsProps) {
  // The search bar covers the top edge while open; nothing to show over it.
  if (searchOpen) return null;
  return (
    <div
      data-testid="pane-controls"
      className="absolute right-5 z-10 flex items-center gap-0.5 rounded-md border border-border bg-raised p-0.5 opacity-0 shadow-popover transition-opacity duration-150 focus-within:opacity-100 group-hover/pane:opacity-100 top-0.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <IconButton
        label="Detach to tab"
        size="xs"
        variant="subtle"
        icon={<Icon name="detach" size={10} strokeWidth={1.5} />}
        onClick={(e) => {
          e.stopPropagation();
          onDetach();
        }}
      />
      <IconButton
        label="Close pane"
        size="xs"
        variant="subtle"
        icon={<Icon name="close" size={10} strokeWidth={1.5} />}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
    </div>
  );
}
