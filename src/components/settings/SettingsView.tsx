import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import { useTerminalStore } from "../../stores/terminal";
import { useSettingsStore } from "../../stores/settings";
import { useThemeStore } from "../../stores/theme";
import { hexToRgba } from "../../lib/color";
import { vibrancyAlpha } from "../../lib/platform";
import { NAV_GROUPS, PANELS, PANEL_LABEL, type PanelId } from "./nav";
import { SETTINGS_SEARCH_INDEX } from "./searchIndex";

/**
 * Full-window settings surface. Fills the main content region (the app chrome
 * stays around it) rather than floating as a modal popup.
 */
export default function SettingsView() {
  const settingsOpen = useTerminalStore((s) => s.settingsOpen);
  const toggleSettings = useTerminalStore((s) => s.toggleSettings);
  const vibrancy = useSettingsStore((s) => s.settings.appearance.vibrancyEnabled);
  const opacity = useSettingsStore((s) => s.settings.appearance.windowOpacity);
  const blurIntensity = useSettingsStore((s) => s.settings.appearance.blurIntensity);
  const theme = useThemeStore((s) => s.active);
  const [activePanel, setActivePanel] = useState<PanelId>("general");
  const [query, setQuery] = useState("");

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") toggleSettings();
    },
    [toggleSettings]
  );

  useEffect(() => {
    if (!settingsOpen) return;
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [settingsOpen, handleEscape]);

  useEffect(() => {
    if (!settingsOpen) setQuery("");
  }, [settingsOpen]);

  const q = query.trim().toLowerCase();
  const results = q
    ? SETTINGS_SEARCH_INDEX.filter(
        (e) =>
          e.label.toLowerCase().includes(q) ||
          e.keywords?.toLowerCase().includes(q) ||
          PANEL_LABEL[e.panel].toLowerCase().includes(q)
      )
    : null;

  const ActivePanel = PANELS[activePanel];

  const pick = (panel: PanelId) => {
    setActivePanel(panel);
    setQuery("");
  };

  const surfaceStyle = vibrancy
    ? {
        backgroundColor: hexToRgba(
          theme.ui.bgPrimary,
          Math.min(vibrancyAlpha(opacity) + 0.14, 0.92)
        ),
        backdropFilter: `blur(${30 * blurIntensity}px) saturate(1.3)`,
        WebkitBackdropFilter: `blur(${30 * blurIntensity}px) saturate(1.3)`,
      }
    : { backgroundColor: theme.ui.bgPrimary };

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          key="settings"
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
          style={surfaceStyle}
          className="absolute inset-0 z-[var(--z-modal)] flex flex-col"
        >
          <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-5">
            <h1 className="text-sm font-semibold text-text-primary">Settings</h1>
            <div className="relative ml-2 w-64">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search settings"
                className="w-full rounded-md border border-border bg-overlay/[0.03] py-1.5 pl-8 pr-3 text-xs text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent"
              />
            </div>
            <button
              onClick={toggleSettings}
              aria-label="Close settings"
              className="ml-auto rounded-md p-1.5 text-text-muted transition-colors hover:bg-overlay/[0.08] hover:text-text-primary"
            >
              <X size={16} />
            </button>
          </header>

          <div className="flex min-h-0 flex-1">
            <nav className="w-[220px] shrink-0 overflow-y-auto border-r border-border p-3">
              {results ? (
                results.length === 0 ? (
                  <div className="px-2 py-6 text-center text-xs text-text-muted">
                    No settings match "{query}"
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {results.map((e) => (
                      <button
                        key={`${e.panel}:${e.label}`}
                        onClick={() => pick(e.panel)}
                        className="flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-overlay/[0.06]"
                      >
                        <span className="text-sm text-text-primary">{e.label}</span>
                        <span className="text-[11px] text-text-muted">
                          {PANEL_LABEL[e.panel]}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                NAV_GROUPS.map((group) => (
                  <div key={group.title} className="mb-4">
                    <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                      {group.title}
                    </div>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activePanel === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActivePanel(item.id)}
                          className={`relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                            active
                              ? "text-accent"
                              : "text-text-secondary hover:bg-overlay/[0.06] hover:text-text-primary"
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="settings-nav-active"
                              className="absolute inset-0 rounded-md bg-accent/15"
                              transition={{ type: "spring", stiffness: 500, damping: 38 }}
                            />
                          )}
                          <Icon size={15} />
                          <span className="relative">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </nav>

            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePanel}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="mx-auto max-w-[760px] px-8 py-8"
                >
                  <ActivePanel />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
