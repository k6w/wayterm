import { useRef, type KeyboardEvent } from "react";
import { Clock, Play } from "lucide-react";
import { isMac } from "../../lib/platform";
import {
  Button,
  ICON_SM,
  IconButton,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Textarea,
  Toolbar,
  ToolbarButton,
  ToolbarSpacer,
} from "../../ui";
import { historyStep } from "./database-form";
import type { QueryHistory } from "../../types/database";

interface QueryEditorProps {
  query: string;
  onQueryChange: (query: string) => void;
  history: QueryHistory[];
  running: boolean;
  onRun: () => void;
}

/**
 * SQL box. Up/Down recall earlier queries (as before), Mod+Enter runs, and the
 * clock menu picks any recent query.
 */
export default function QueryEditor({ query, onQueryChange, history, running, onRun }: QueryEditorProps) {
  // Position in the history while recalling; -1 is the user's own text.
  const historyIndex = useRef(-1);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (isMac ? event.metaKey : event.ctrlKey)) {
      event.preventDefault();
      historyIndex.current = -1;
      if (query.trim() && !running) onRun();
      return;
    }
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && history.length > 0) {
      event.preventDefault();
      historyIndex.current = historyStep(historyIndex.current, event.key, history.length);
      onQueryChange(historyIndex.current === -1 ? "" : history[historyIndex.current].query);
      return;
    }
    historyIndex.current = -1;
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <Textarea
        aria-label="SQL query"
        rows={6}
        className="font-mono"
        placeholder="SELECT * FROM users LIMIT 10"
        value={query}
        onChange={(e) => {
          historyIndex.current = -1;
          onQueryChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      <Toolbar aria-label="Query actions" className="gap-1">
        <ToolbarButton>
          <Button
            size="sm"
            variant="primary"
            leadingIcon={<Play {...ICON_SM} />}
            shortcut="Mod+Enter"
            loading={running}
            disabled={!query.trim()}
            onClick={() => {
              historyIndex.current = -1;
              onRun();
            }}
          >
            Run
          </Button>
        </ToolbarButton>
        <ToolbarSpacer />
        {history.length > 0 && (
          <Menu>
            <ToolbarButton asChild>
              <MenuTrigger asChild>
                <IconButton label="Query history" icon={<Clock {...ICON_SM} />} />
              </MenuTrigger>
            </ToolbarButton>
            <MenuContent align="end" className="max-h-72 w-72 overflow-y-auto">
              {history.map((item) => (
                <MenuItem
                  key={item.id}
                  onSelect={() => {
                    historyIndex.current = -1;
                    onQueryChange(item.query);
                  }}
                >
                  <span className="truncate font-mono">{item.query}</span>
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}
      </Toolbar>
    </div>
  );
}
