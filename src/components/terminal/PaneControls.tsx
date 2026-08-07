import { ExternalLink, X } from "lucide-react";
import { IconButton } from "../../ui";

interface PaneControlsProps {
  /** The search bar occupies the top edge of the pane; sit below it. */
  searchOpen: boolean;
  onDetach: () => void;
  onClose: () => void;
}

/** Detach / close buttons in the top-right corner of a split pane. */
export default function PaneControls({ searchOpen, onDetach, onClose }: PaneControlsProps) {
  const buttonClass = "opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100";
  return (
    <div
      data-testid="pane-controls"
      data-below-search={searchOpen || undefined}
      className={`absolute right-5 z-10 flex items-center gap-0.5 ${searchOpen ? "top-11" : "top-2"}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <IconButton
        label="Detach to tab"
        size="xs"
        variant="subtle"
        icon={<ExternalLink size={10} strokeWidth={1.5} />}
        className={buttonClass}
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
        className={buttonClass}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
    </div>
  );
}
