import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "../../ui/icons";
import { Dialog, DialogContent, Input, ICON_MD } from "../../ui";
import type { ThemeDefinition } from "../../types/theme";
import { useTerminalStore } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { historyRecent } from "../../lib/ipc";
import { selectTheme } from "../../lib/theme-selection";
import { buildPaletteActions, historyActions, type PaletteAction } from "./actions";
import { displayOrder, filterActions, filterThemes, groupActions, matchRanges, wrapIndex } from "./filter";
import { getRecents, recordRecent } from "./recents";
import { restoreFocusAfterPalette } from "./restore-focus";
import { PaletteList, type PaletteItem, type PaletteSection } from "./PaletteList";

type View = "commands" | "themes";

/** Four-colour preview of a theme: canvas, accent, text and a terminal green. */
function ThemeSwatch({ theme }: { theme: ThemeDefinition }) {
  const colors = [theme.chrome.canvas, theme.chrome.accent, theme.terminal.foreground, theme.terminal.ansi[2]];
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden className="overflow-hidden rounded-sm">
      {colors.map((fill, i) => (
        <rect key={i} x={(i % 2) * 10} y={Math.floor(i / 2) * 10} width={10} height={10} fill={fill} />
      ))}
    </svg>
  );
}

function FooterHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-border bg-kbd px-1 font-sans text-caption leading-none text-kbd-fg">
        {keys}
      </kbd>
      <span>{label}</span>
    </span>
  );
}

function closePalette(): void {
  const { commandPaletteOpen, toggleCommandPalette } = useTerminalStore.getState();
  if (commandPaletteOpen) toggleCommandPalette();
}

/**
 * Command palette (Mod+Shift+P). The body mounts on every open, so the query,
 * the selection and the command list start fresh each time.
 */
export default function CommandPalette() {
  const open = useTerminalStore((s) => s.commandPaletteOpen);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closePalette();
      }}
    >
      {open && <PaletteBody />}
    </Dialog>
  );
}

function PaletteBody() {
  const [actions] = useState(buildPaletteActions);
  const [history, setHistory] = useState<PaletteAction[]>([]);
  const [view, setView] = useState<View>("commands");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previousFocus] = useState(() => document.activeElement);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  const themes = useThemeStore((s) => s.themes);
  const activeThemeId = useThemeStore((s) => s.activeThemeId);
  const previewTheme = useThemeStore((s) => s.previewTheme);

  useEffect(() => {
    let cancelled = false;
    historyRecent(20)
      .then((entries) => {
        if (!cancelled) setHistory(historyActions(entries));
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Closing without choosing (Escape, click outside, running a command) drops
  // any theme preview, so the active theme is shown again.
  useEffect(
    () => () => {
      const store = useThemeStore.getState();
      if (store.previewThemeId) store.previewTheme(null);
    },
    []
  );

  const [recentIds] = useState(getRecents);
  const suggested = useMemo(
    () =>
      query.trim()
        ? []
        : recentIds.flatMap((id) => {
            const found = actions.find((action) => action.id === id);
            return found ? [found] : [];
          }),
    [actions, recentIds, query]
  );
  const commandGroups = useMemo(() => {
    const skip = new Set(suggested.map((action) => action.id));
    return groupActions(filterActions([...actions, ...history], query).filter((action) => !skip.has(action.id)));
  }, [actions, history, query, suggested]);
  const commandItems = useMemo(() => [...suggested, ...displayOrder(commandGroups)], [suggested, commandGroups]);
  const themeItems = useMemo(() => filterThemes(Object.values(themes), query), [themes, query]);

  const count = view === "themes" ? themeItems.length : commandItems.length;
  const active = count === 0 ? -1 : Math.min(selected, count - 1);
  const activeId = active >= 0 ? optionId(active) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const changeQuery = (value: string) => {
    setQuery(value);
    setSelected(0);
  };

  const showThemes = () => {
    setView("themes");
    changeQuery("");
  };

  const showCommands = () => {
    previewTheme(null);
    setView("commands");
    changeQuery("");
    inputRef.current?.focus();
  };

  const choose = (index: number) => {
    if (view === "themes") {
      const theme = themeItems[index];
      if (!theme) return;
      void selectTheme(theme.id);
      closePalette();
      return;
    }
    const action = commandItems[index];
    if (!action) return;
    if (action.subView === "themes") {
      showThemes();
      return;
    }
    recordRecent(action.id);
    closePalette();
    requestAnimationFrame(() => action.handler());
  };

  const move = (delta: number) => {
    if (count === 0) return;
    const next = wrapIndex(active, delta, count);
    setSelected(next);
    if (view === "themes") previewTheme(themeItems[next].id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Enter":
        event.preventDefault();
        if (active >= 0) choose(active);
        break;
      case "Backspace":
        if (view === "themes" && query === "") {
          event.preventDefault();
          showCommands();
        }
        break;
    }
  };

  const commandItem = (action: PaletteAction, keyPrefix = "", showCategory = false): PaletteItem => {
    const Icon = action.icon;
    return {
      key: keyPrefix + action.id,
      label: action.label,
      ranges: matchRanges(action.label, query),
      icon: <Icon {...ICON_MD} />,
      subtitle: showCategory ? action.category : undefined,
      shortcut: action.subView ? undefined : action.keys,
      trailing: action.subView ? <Icon name="drillIn" size="sm" aria-hidden className="shrink-0 text-fg-muted" /> : undefined,
    };
  };

  const sections: PaletteSection[] =
    view === "themes"
      ? [
          {
            heading: "Themes",
            items: themeItems.map((theme) => ({
              key: theme.id,
              label: theme.name,
              ranges: matchRanges(theme.name, query),
              icon: <ThemeSwatch theme={theme} />,
              subtitle: theme.variant === "light" ? "Light" : "Dark",
              trailing:
                theme.id === activeThemeId ? (
                  <span className="inline-flex shrink-0 text-accent-fg">
                    <Icon name="selected" size="sm" aria-hidden />
                    <span className="sr-only">(current)</span>
                  </span>
                ) : undefined,
            })),
          },
        ]
      : [
          ...(suggested.length > 0
            ? [{ heading: "Suggested", items: suggested.map((action) => commandItem(action, "suggested-", true)) }]
            : []),
          ...commandGroups.map((group) => ({
            heading: group.category,
            items: group.actions.map((action) => commandItem(action)),
          })),
        ];

  const trimmed = query.trim();
  const listLabel = view === "themes" ? "Themes" : "Commands";

  return (
    <DialogContent
      title="Command palette"
      hideHeader
      placement="palette"
      surface="glass"
      flush
      size="lg"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        restoreFocusAfterPalette(previousFocus);
      }}
    >
      <div className="flex h-13 shrink-0 items-center gap-3 border-b border-border px-4">
        <Icon name="search" size="md" aria-hidden className="shrink-0 text-fg-muted" />
        <Input
          ref={inputRef}
          variant="plain"
          size="lg"
          role="combobox"
          aria-label={view === "themes" ? "Search themes" : "Search commands"}
          aria-expanded={count > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          plainText
          placeholder={view === "themes" ? "Search themes…" : "Search commands, connections, themes…"}
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {view === "themes" && (
          <button
            type="button"
            aria-label="Back to commands"
            onMouseDown={(event) => event.preventDefault()}
            onClick={showCommands}
            className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border border-border bg-raised pl-1.5 pr-2 text-label text-fg-secondary transition-colors duration-100 hover:bg-hover"
          >
            <Icon name="back" size="sm" aria-hidden />
            Themes
          </button>
        )}
      </div>
      {count > 0 ? (
        <PaletteList
          id={listId}
          label={listLabel}
          sections={sections}
          activeIndex={active}
          optionId={optionId}
          onHover={(index) => {
            setSelected(index);
            if (view === "themes") previewTheme(themeItems[index]?.id ?? null);
          }}
          onChoose={choose}
        />
      ) : (
        <div role="status" className="flex flex-col items-center gap-1 px-6 py-10 text-center">
          <p className="text-body font-medium text-fg">
            {trimmed
              ? view === "themes"
                ? "No matching themes"
                : "No matching commands"
              : view === "themes"
                ? "No themes"
                : "No commands"}
          </p>
          {trimmed && <p className="max-w-full truncate text-label text-fg-muted">{`Nothing matches "${trimmed}".`}</p>}
        </div>
      )}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-border px-4 text-label text-fg-muted">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="newTerminal" size="sm" aria-hidden />
          nexterm
        </span>
        <span className="inline-flex items-center gap-4" data-testid="palette-hints">
          <FooterHint keys="↑↓" label="Navigate" />
          <FooterHint keys="↵" label="Run" />
          {view === "themes" ? <FooterHint keys="⌫" label="Back" /> : null}
          <FooterHint keys="esc" label="Close" />
        </span>
      </div>
    </DialogContent>
  );
}
