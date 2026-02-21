import { GitBranch, Folder, Circle } from "lucide-react";
import { motion } from "framer-motion";
import { shortenPath } from "../../lib/format";

interface ContextRibbonProps {
  cwd: string;
  gitBranch: string | null;
  gitDirty: boolean;
  sshUsername?: string;
}

export default function ContextRibbon({
  cwd,
  gitBranch,
  gitDirty,
  sshUsername,
}: ContextRibbonProps) {
  const displayPath = shortenPath(cwd, sshUsername);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2 px-3 text-xs text-text-secondary"
      style={{ height: 28 }}
    >
      {gitBranch && (
        <>
          <div className="flex items-center gap-1">
            <GitBranch size={14} className="shrink-0" />
            <span className="truncate">{gitBranch}</span>
            {gitDirty && (
              <Circle
                size={8}
                className="shrink-0 fill-warning text-warning"
              />
            )}
          </div>
          <span className="text-text-muted">{"/"}</span>
        </>
      )}
      {cwd && (
        <div className="flex items-center gap-1 truncate">
          <Folder size={14} className="shrink-0" />
          <span className="truncate">{displayPath}</span>
        </div>
      )}
    </motion.div>
  );
}
