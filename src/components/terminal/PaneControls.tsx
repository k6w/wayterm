import { ExternalLink, X } from "lucide-react";
import { IconButton } from "../../ui";

interface PaneControlsProps {
  /** The search bar occupies the top edge of the pane; sit below it. */
  searchOpen: boolean;
  onDetach: () => void;
  onClose: () => void;
}

/**
 * Detach / close buttons in the top-right corner of a split pane. Hidden until
 * the pane (PaneFrame's group/pane) is hovered or focused, on a solid chip so
 * they stay legible over terminal text. They reserve no layout.
 */
export default function PaneControls({ searchOpen, onDetach, onClose }: PaneControlsProps) {
  return (
    <div
      data-testid="pane-controls"
      data-below-search={searchOpen || undefined}
      className={`absolute right-5 z-10 flex items-center gap-0.5 rounded-md border border-border bg-raised p-0.5 opacity-0 shadow-popover transition-opacity duration-150 focus-within:opacity-100 group-focus-within/pane:opacity-100 group-hover/pane:opacity-100 ${searchOpen ? "top-11" : "top-2"}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <IconButton
        label="Detach to tab"
        size="xs"
        variant="subtle"
        icon={<ExternalLink size={10} strokeWidth={1.5} />}
        onClick={(e) => {
          e.stopPropagation();
          onDetach();
        }}
      />
      <IconButton
        label="Close pane"
        size="xs"
        variant="subtle"
        icon={<X size={10} strokeWidth={1.5} />}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
    </div>
  );
}
