import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, Check, ChevronRight, Moon, Search, SearchX, Sun } from "lucide-react";
import { Dialog, DialogContent, EmptyState, IconButton, Input, ICON_MD, ICON_SM } from "../../ui";
import { useTerminalStore } from "../../stores/terminal";
import { useThemeStore } from "../../stores/theme";
import { historyRecent } from "../../lib/ipc";
import { selectTheme } from "../../lib/theme-selection";
import { buildPaletteActions, historyActions, type PaletteAction } from "./actions";
import { displayOrder, filterActions, filterThemes, groupActions, wrapIndex } from "./filter";
import { PaletteList, type PaletteSection } from "./PaletteList";

type View = "commands" | "themes";

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

  const commandGroups = useMemo(
    () => groupActions(filterActions([...actions, ...history], query)),
    [actions, history, query]
  );
  const commandItems = useMemo(() => displayOrder(commandGroups), [commandGroups]);
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

  const sections: PaletteSection[] =
    view === "themes"
      ? [
          {
            heading: "Themes",
            items: themeItems.map((theme) => {
              const Icon = theme.variant === "light" ? Sun : Moon;
              return {
                key: theme.id,
                label: theme.name,
                icon: <Icon {...ICON_MD} />,
                trailing:
                  theme.id === activeThemeId ? (
                    <span className="inline-flex shrink-0 text-accent-fg">
                      <Check {...ICON_SM} aria-hidden />
                      <span className="sr-only">(current)</span>
                    </span>
                  ) : undefined,
              };
            }),
          },
        ]
      : commandGroups.map((group) => ({
          heading: group.category,
          items: group.actions.map((action) => {
            const Icon = action.icon;
            return {
              key: action.id,
              label: action.label,
              icon: <Icon {...ICON_MD} />,
              shortcut: action.subView ? undefined : action.keys,
              trailing: action.subView ? (
                <ChevronRight {...ICON_SM} aria-hidden className="shrink-0 text-fg-muted" />
              ) : undefined,
            };
          }),
        }));

  const trimmed = query.trim();
  const listLabel = view === "themes" ? "Themes" : "Commands";

  return (
    <DialogContent
      title="Command palette"
      hideHeader
      placement="top"
      flush
      size="lg"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        inputRef.current?.focus();
      }}
    >
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        {view === "themes" ? (
          <IconButton label="Back to commands" icon={<ArrowLeft {...ICON_MD} />} onClick={showCommands} />
        ) : (
          <Search {...ICON_MD} aria-hidden className="shrink-0 text-fg-muted" />
        )}
        <Input
          ref={inputRef}
          variant="bare"
          role="combobox"
          aria-label={view === "themes" ? "Search themes" : "Search commands"}
          aria-expanded={count > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          spellCheck={false}
          placeholder={view === "themes" ? "Search themes..." : "Type a command..."}
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {count > 0 ? (
        <PaletteList
          id={listId}
          label={listLabel}
          sections={sections}
          activeIndex={active}
          optionId={optionId}
          onHover={setSelected}
          onChoose={choose}
        />
      ) : (
        <div role="status">
          <EmptyState
            icon={<SearchX {...ICON_MD} />}
            title={
              trimmed
                ? view === "themes"
                  ? "No matching themes"
                  : "No matching commands"
                : view === "themes"
                  ? "No themes"
                  : "No commands"
            }
            description={trimmed ? `Nothing matches "${trimmed}".` : undefined}
          />
        </div>
      )}
    </DialogContent>
  );
}
