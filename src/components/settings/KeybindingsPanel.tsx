import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { getDefaultKeybindings } from "../../lib/keybindings";
import { useSettingsStore } from "../../stores/settings";
import { Badge, IconButton, Input, Kbd, Section, shortcutLabel, ICON_SM } from "../../ui";
import { comboFromEvent, findConflicts, type BindingRow } from "./keybinding-utils";

const headerCell = "h-8 px-3 text-left text-caption font-medium uppercase tracking-wide text-fg-muted";

export default function KeybindingsPanel() {
  const keybindings = useSettingsStore((s) => s.settings.keybindings);
  const updateKeybinding = useSettingsStore((s) => s.updateKeybinding);
  const [recording, setRecording] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const rows: BindingRow[] = getDefaultKeybindings().map((binding) => ({
    id: binding.id,
    label: binding.label,
    keys: keybindings[binding.id] || binding.keys,
  }));
  const conflicts = findConflicts(rows);
  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter(
        (row) =>
          row.label.toLowerCase().includes(q) ||
          shortcutLabel(row.keys).toLowerCase().includes(q) ||
          row.keys.toLowerCase().includes(q)
      )
    : rows;

  // While recording, the next key press (in the capture phase, before the
  // terminal or a button sees it) becomes the shortcut. Escape cancels.
  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(null);
        return;
      }
      const combo = comboFromEvent(event);
      if (!combo) return;
      void updateKeybinding(recording, combo);
      setRecording(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, updateKeybinding]);

  return (
    <Section title="Keyboard shortcuts" description="Select the pencil, then press the new keys. Escape cancels.">
      <Input
        type="search"
        aria-label="Search shortcuts"
        placeholder="Search shortcuts"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="overflow-hidden rounded-lg border border-border bg-panel">
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className={headerCell}>
                Action
              </th>
              <th scope="col" className={headerCell}>
                Shortcut
              </th>
              <th scope="col" className="w-12 px-3">
                <span className="sr-only">Change</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isRecording = recording === row.id;
              const others = conflicts.get(row.id);
              return (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <th scope="row" className="h-row px-3 text-left font-normal text-fg">
                    {row.label}
                  </th>
                  <td className="px-3 py-1">
                    {isRecording ? (
                      <Badge tone="accent" size="md" role="status">
                        Press keys…
                      </Badge>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2">
                        <Kbd shortcut={row.keys} />
                        {others && <Badge tone="warning">Conflicts with {others.join(", ")}</Badge>}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1 text-right">
                    <IconButton
                      label={isRecording ? `Cancel recording for ${row.label}` : `Change shortcut for ${row.label}`}
                      icon={<Pencil {...ICON_SM} />}
                      pressed={isRecording}
                      onClick={() => setRecording(isRecording ? null : row.id)}
                    />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-label text-fg-muted">
                  No shortcuts match "{query.trim()}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
