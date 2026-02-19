import { useState } from "react";
import { Terminal, X } from "lucide-react";
import { motion } from "framer-motion";
import type { TerminalTab } from "../../types/terminal";

interface TabProps {
  tab: TerminalTab;
  onClose: (id: string) => void;
  onClick: (id: string) => void;
}

export default function Tab({ tab, onClose, onClick }: TabProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className={`
        relative flex h-full max-w-[200px] min-w-[120px] shrink-0 items-center gap-2
        px-3 text-xs transition-colors select-none
        ${
          tab.isActive
            ? "bg-bg-primary text-text-primary"
            : "bg-transparent text-text-secondary hover:bg-bg-tertiary"
        }
      `}
      onClick={() => onClick(tab.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Terminal className="size-3.5 shrink-0" />
      <span className="truncate">{tab.title}</span>
      {(hovered || tab.isActive) && (
        <span
          className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <X className="size-3" />
        </span>
      )}
      {tab.isActive && (
        <motion.span
          layoutId="active-tab-indicator"
          className="absolute bottom-0 left-0 h-0.5 w-full bg-accent"
        />
      )}
    </motion.button>
  );
}
