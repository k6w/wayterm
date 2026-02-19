import { useState } from "react";
import { FolderOpen, Server, ChevronRight, Plus } from "lucide-react";
import type { SshConnection } from "../../types/ssh";

interface ConnectionFolder {
  path: string;
  connections: SshConnection[];
}

export default function ConnectionTree() {
  const [folders] = useState<ConnectionFolder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Connections
        </span>
        <button className="flex size-5 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/[0.08] hover:text-text-secondary">
          <Plus size={14} />
        </button>
      </div>

      {folders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-3 py-6">
          <Server size={18} className="text-text-muted" />
          <span className="text-xs text-text-muted">No connections</span>
          <button className="rounded-md bg-white/[0.08] px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/[0.14] hover:text-text-primary">
            Add Connection
          </button>
        </div>
      ) : (
        <div className="flex flex-col px-1">
          {folders.map((folder) => (
            <div key={folder.path}>
              <button
                onClick={() => toggleFolder(folder.path)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
              >
                <ChevronRight
                  size={14}
                  className={`shrink-0 transition-transform ${
                    expandedFolders.has(folder.path) ? "rotate-90" : ""
                  }`}
                />
                <FolderOpen size={14} className="shrink-0 text-text-muted" />
                <span className="truncate text-xs">{folder.path}</span>
              </button>

              {expandedFolders.has(folder.path) && (
                <div className="ml-4 flex flex-col">
                  {folder.connections.map((conn) => (
                    <button
                      key={conn.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.06]"
                    >
                      <Server size={14} className="shrink-0 text-text-muted" />
                      <div className="flex min-w-0 flex-col items-start">
                        <span className="truncate text-xs text-text-secondary">
                          {conn.name}
                        </span>
                        <span className="truncate text-[10px] text-text-muted">
                          {conn.host}:{conn.port}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
