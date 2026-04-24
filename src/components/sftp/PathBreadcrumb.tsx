import { useRef, useState, useEffect } from "react";
import { ChevronRight, Star, Trash2 } from "lucide-react";
import { useSettingsStore } from "../../stores/settings";
import type { SftpBookmark } from "../../types/settings";

interface PathBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
  label?: string;
  showBookmarks?: boolean;
}

export default function PathBreadcrumb({
  path,
  onNavigate,
  label,
  showBookmarks = false,
}: PathBreadcrumbProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sftpBookmarks = useSettingsStore((s) => s.settings.sftpBookmarks);
  const setSftpBookmarks = useSettingsStore((s) => s.setSftpBookmarks);

  const isWindows = /^[A-Za-z]:[\\/]/.test(path);
  const separator = "/";
  const normalizedPath = path.replace(/\\/g, "/");

  const parts = normalizedPath.split("/").filter(Boolean);

  const segments: { name: string; fullPath: string }[] = [];

  if (isWindows) {
    if (parts.length > 0) {
      segments.push({ name: parts[0], fullPath: parts[0] + "/" });
      for (let i = 1; i < parts.length; i++) {
        segments.push({
          name: parts[i],
          fullPath: parts.slice(0, i + 1).join(separator) + (i === 0 ? "/" : ""),
        });
      }
      for (let i = 1; i < segments.length; i++) {
        segments[i].fullPath = parts[0] + "/" + parts.slice(1, i + 1).join(separator);
      }
    }
  } else {
    for (let i = 0; i < parts.length; i++) {
      segments.push({
        name: parts[i],
        fullPath: "/" + parts.slice(0, i + 1).join(separator),
      });
    }
  }

  const isBookmarked = sftpBookmarks.some((b) => b.path === path);

  const handleToggleBookmark = () => {
    if (isBookmarked) {
      setSftpBookmarks(sftpBookmarks.filter((b) => b.path !== path));
    } else {
      const name = parts[parts.length - 1] || path;
      const bookmark: SftpBookmark = {
        id: crypto.randomUUID(),
        name,
        path,
      };
      setSftpBookmarks([...sftpBookmarks, bookmark]);
    }
  };

  const handleRemoveBookmark = (id: string) => {
    setSftpBookmarks(sftpBookmarks.filter((b) => b.id !== id));
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto text-xs min-w-0 px-2 py-1 flex-1">
      {label && (
        <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted mr-1.5">
          {label}
        </span>
      )}

      {/* Root */}
      <button
        onClick={() => onNavigate(isWindows && parts.length > 0 ? parts[0] + "/" : "/")}
        className="shrink-0 text-text-secondary hover:text-text-primary transition-colors"
      >
        {isWindows && parts.length > 0 ? parts[0] + separator : "/"}
      </button>

      {/* Path segments */}
      {(isWindows ? segments.slice(1) : segments).map((seg, i, arr) => {
        const isLast = i === arr.length - 1;
        return (
          <span key={seg.fullPath} className="flex items-center gap-0.5 shrink-0">
            <ChevronRight size={10} className="text-text-muted" />
            <button
              onClick={() => onNavigate(seg.fullPath)}
              className={`transition-colors ${
                isLast
                  ? "text-accent font-medium"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {seg.name}
            </button>
          </span>
        );
      })}

      {/* Bookmark controls */}
      {showBookmarks && (
        <div ref={dropdownRef} className="relative ml-auto shrink-0 flex items-center gap-0.5">
          <button
            onClick={handleToggleBookmark}
            className={`flex size-5 items-center justify-center rounded transition-colors ${
              isBookmarked
                ? "text-warning hover:text-text-muted"
                : "text-text-muted hover:text-warning"
            }`}
            title={isBookmarked ? "Remove bookmark" : "Bookmark this path"}
          >
            <Star size={11} fill={isBookmarked ? "currentColor" : "none"} />
          </button>

          {sftpBookmarks.length > 0 && (
            <button
              onClick={() => setDropdownOpen((p) => !p)}
              className="flex size-5 items-center justify-center rounded text-text-muted hover:text-text-secondary transition-colors"
              title="Bookmarks"
            >
              <ChevronRight
                size={10}
                className={`transition-transform duration-150 ${dropdownOpen ? "rotate-90" : "rotate-0"}`}
              />
            </button>
          )}

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-border bg-bg-secondary shadow-xl overflow-hidden">
              <div className="py-1 max-h-[200px] overflow-y-auto">
                {sftpBookmarks.map((bm) => (
                  <div key={bm.id} className="group flex items-center gap-2 px-2 py-1.5 hover:bg-white/[0.06]">
                    <button
                      className="flex-1 text-left text-xs text-text-secondary hover:text-text-primary truncate"
                      onClick={() => { onNavigate(bm.path); setDropdownOpen(false); }}
                      title={bm.path}
                    >
                      <span className="font-medium">{bm.name}</span>
                      <span className="text-[10px] text-text-muted block truncate">{bm.path}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveBookmark(bm.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-error transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
