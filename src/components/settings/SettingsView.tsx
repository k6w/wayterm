import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { EmptyState, IconButton, Input, ListRow, ICON_MD, ICON_SM, cn } from "../../ui";
import { NAV_GROUPS, PANELS, PANEL_LABEL, isPanelId, type PanelId } from "./nav";
import { searchSettings } from "./searchIndex";

/**
 * Full-window settings surface. It fills the main content region (the title
 * bar, activity bar and status bar stay around it) instead of floating as a
 * modal. The chosen panel survives closing and reopening; the search does not.
 */
export default function SettingsView() {
  const settingsOpen = useTerminalStore((s) => s.settingsOpen);
  const toggleSettings = useTerminalStore((s) => s.toggleSettings);
  const requestedPanel = useTerminalStore((s) => s.settingsPanel);
  const clearSettingsPanel = useTerminalStore((s) => s.clearSettingsPanel);
  const [activePanel, setActivePanel] = useState<PanelId>("general");

  // openSettings(panel) deep links (e.g. the SFTP pane opens "ssh").
  useEffect(() => {
    if (!requestedPanel) return;
    if (settingsOpen && isPanelId(requestedPanel)) setActivePanel(requestedPanel);
    clearSettingsPanel();
  }, [requestedPanel, settingsOpen, clearSettingsPanel]);

  if (!settingsOpen) return null;
  return <SettingsSurface activePanel={activePanel} onSelectPanel={setActivePanel} onClose={toggleSettings} />;
}

interface SettingsSurfaceProps {
  activePanel: PanelId;
  onSelectPanel: (panel: PanelId) => void;
  onClose: () => void;
}

/** Mounted only while settings is open, so the search starts empty on every open. */
function SettingsSurface({ activePanel, onSelectPanel, onClose }: SettingsSurfaceProps) {
  const [query, setQuery] = useState("");
  const results = searchSettings(query);
  const ActivePanel = PANELS[activePanel];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Open selects, menus and confirm dialogs handle Escape first and mark it handled.
      if (event.key === "Escape" && !event.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const pick = (panel: PanelId) => {
    onSelectPanel(panel);
    setQuery("");
  };

  return (
    <section
      aria-label="Settings"
      className="absolute inset-0 z-[var(--z-modal)] flex animate-nx-fade-in bg-canvas-glass nx-blur"
    >
      <div className="flex w-[232px] shrink-0 flex-col border-r border-border bg-panel-glass">
        <div className="flex flex-col gap-3 px-3 pb-2 pt-3">
          <h1 className="px-1 text-title font-semibold text-fg">Settings</h1>
          <div
            className={cn(
              "flex h-control items-center gap-2 rounded-md border border-input-border bg-input px-2",
              "focus-within:outline-solid focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-focus"
            )}
          >
            <Search {...ICON_SM} aria-hidden className="shrink-0 text-fg-muted" />
            <Input
              variant="plain"
              size="sm"
              type="search"
              autoFocus
              aria-label="Search settings"
              placeholder="Search settings"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && results && results.length > 0) {
                  event.preventDefault();
                  pick(results[0].panel);
                }
              }}
            />
          </div>
        </div>
        <nav aria-label="Settings sections" className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {results ? (
            results.length === 0 ? (
              <EmptyState title={`No settings match "${query.trim()}"`} className="px-2 py-6" />
            ) : (
              <div className="flex flex-col gap-0.5">
                {results.map((entry) => (
                  <ListRow
                    key={`${entry.panel}:${entry.label}`}
                    label={entry.label}
                    description={PANEL_LABEL[entry.panel]}
                    onSelect={() => pick(entry.panel)}
                  />
                ))}
              </div>
            )
          ) : (
            NAV_GROUPS.map((group) => (
              <div key={group.title} role="group" aria-label={group.title} className="mb-3 flex flex-col gap-0.5">
                <p aria-hidden className="px-2 pb-1 pt-2 text-caption font-medium uppercase tracking-wide text-fg-muted">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <ListRow
                      key={item.id}
                      label={item.label}
                      icon={<Icon {...ICON_MD} />}
                      selected={activePanel === item.id}
                      onSelect={() => onSelectPanel(item.id)}
                    />
                  );
                })}
              </div>
            ))
          )}
        </nav>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-6">
          <h2 className="text-title font-semibold text-fg">{PANEL_LABEL[activePanel]}</h2>
          <IconButton label="Close settings" shortcut="Escape" icon={<X {...ICON_MD} />} onClick={onClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div key={activePanel} className="mx-auto max-w-[720px] animate-nx-fade-in px-6 py-6">
            <ActivePanel />
          </div>
        </div>
      </div>
    </section>
  );
}
