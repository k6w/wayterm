import { useState } from "react";
import { Layout, Save } from "lucide-react";
import type { WorkspaceMeta } from "../../types/workspace";

export default function WorkspaceList() {
  const [workspaces] = useState<WorkspaceMeta[]>([]);

  const formatDate = (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
          Workspaces
        </span>
      </div>

      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-3 py-6">
          <Layout size={18} className="text-text-muted" />
          <span className="text-xs text-text-muted">No saved workspaces</span>
          <button className="flex items-center gap-1.5 rounded-md bg-white/[0.08] px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-white/[0.14] hover:text-text-primary">
            <Save size={12} />
            <span>Save Current</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col px-1">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              className="flex items-center gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-white/[0.06]"
            >
              <Layout size={14} className="shrink-0 text-text-muted" />
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <span className="truncate text-xs text-text-secondary">
                  {ws.name}
                </span>
                <span className="text-[10px] text-text-muted">
                  {formatDate(ws.updatedAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
