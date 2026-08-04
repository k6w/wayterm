import { ExternalLink, X } from "lucide-react";
import { useThemeStore } from "../../stores/theme";

interface PaneControlsProps {
  /** The search bar occupies the top edge of the pane; sit below it. */
  searchOpen: boolean;
  onDetach: () => void;
  onClose: () => void;
}

/** Detach / close buttons in the top-right corner of a split pane. */
export default function PaneControls({ searchOpen, onDetach, onClose }: PaneControlsProps) {
  const ui = useThemeStore((s) => s.active.ui);
  const style = { background: ui.bgSecondary, color: ui.textMuted };
  const buttonClass =
    "flex h-5 w-5 items-center justify-center rounded opacity-50 transition-opacity hover:opacity-100";
  return (
    <div
      data-testid="pane-controls"
      data-below-search={searchOpen || undefined}
      className={`absolute right-5 z-10 flex items-center gap-0.5 ${searchOpen ? "top-11" : "top-2"}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDetach();
        }}
        className={buttonClass}
        style={style}
        title="Detach to tab"
      >
        <ExternalLink size={10} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={buttonClass}
        style={style}
        title="Close pane"
      >
        <X size={10} strokeWidth={1.5} />
      </button>
    </div>
  );
}
