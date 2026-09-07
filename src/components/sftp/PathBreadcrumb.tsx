import { useState } from "react";
import { Icon } from "../../ui/icons";
import { useSettingsStore } from "../../stores/settings";
import { IconButton, ListRow, Popover, PopoverContent, PopoverTrigger, cn, focusRing } from "../../ui";
import { breadcrumbs } from "./sftp-paths";

interface PathBreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
  /** Names the trail for screen readers: "{label} path". */
  label?: string;
  /** Bookmark star and the saved-bookmarks list (remote side). */
  showBookmarks?: boolean;
}

/** Clickable path trail, scrolling sideways when long, with optional bookmarks. */
export default function PathBreadcrumb({ path, onNavigate, label, showBookmarks = false }: PathBreadcrumbProps) {
  const bookmarks = useSettingsStore((s) => s.settings.sftpBookmarks);
  const setBookmarks = useSettingsStore((s) => s.setSftpBookmarks);
  const crumbs = breadcrumbs(path);
  const isBookmarked = bookmarks.some((b) => b.path === path);
  const [listOpen, setListOpen] = useState(false);

  const toggleBookmark = () => {
    if (isBookmarked) {
      setBookmarks(bookmarks.filter((b) => b.path !== path));
    } else {
      const name = crumbs.length > 1 ? crumbs[crumbs.length - 1].name : path;
      setBookmarks([...bookmarks, { id: crypto.randomUUID(), name, path }]);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <nav aria-label={label ? `${label} path` : "Path"} className="scrollbar-none min-w-0 flex-1 overflow-x-auto">
        <ol className="flex items-center gap-0.5 whitespace-nowrap text-label">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={crumb.path} className="flex items-center gap-0.5">
                {i > 0 && <Icon name="breadcrumbSeparator" size={12} strokeWidth={1.5} aria-hidden className="shrink-0 text-fg-muted" />}
                <button
                  type="button"
                  aria-current={last ? "location" : undefined}
                  onClick={() => onNavigate(crumb.path)}
                  className={cn(
                    "rounded-sm px-1 transition-colors duration-150 ease-out",
                    last ? "font-medium text-fg" : "text-fg-secondary hover:text-fg",
                    focusRing
                  )}
                >
                  {crumb.name}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      {showBookmarks && (
        <>
          <IconButton
            size="xs"
            label={isBookmarked ? "Remove bookmark" : "Bookmark this path"}
            pressed={isBookmarked}
            icon={<Icon name="favorite" size="sm" fill={isBookmarked ? "currentColor" : "none"} />}
            onClick={toggleBookmark}
          />
          {bookmarks.length > 0 && (
            <Popover open={listOpen} onOpenChange={setListOpen}>
              <PopoverTrigger asChild>
                <IconButton size="xs" label="Bookmarks" icon={<Icon name="bookmark" size="sm" />} />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <ul aria-label="Bookmarks" className="flex max-h-60 flex-col overflow-y-auto">
                  {bookmarks.map((bm) => (
                    <li key={bm.id}>
                      <ListRow
                        label={bm.name}
                        description={<span className="font-mono">{bm.path}</span>}
                        onSelect={() => {
                          onNavigate(bm.path);
                          setListOpen(false);
                        }}
                        actions={
                          <IconButton
                            size="xs"
                            label={`Remove ${bm.name}`}
                            icon={<Icon name="delete" size="sm" />}
                            onClick={() => setBookmarks(bookmarks.filter((b) => b.id !== bm.id))}
                          />
                        }
                      />
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </>
      )}
    </div>
  );
}
