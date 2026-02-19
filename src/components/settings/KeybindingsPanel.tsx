import { useState, useEffect, useCallback } from "react";
import { Pencil } from "lucide-react";
import { getDefaultKeybindings } from "../../lib/keybindings";
import { useSettingsStore } from "../../stores/settings";

export default function KeybindingsPanel() {
  const keybindings = useSettingsStore((s) => s.settings.keybindings);
  const updateKeybinding = useSettingsStore((s) => s.updateKeybinding);
  const [recordingAction, setRecordingAction] = useState<string | null>(null);
  const defaults = getDefaultKeybindings();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recordingAction) return;

      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setRecordingAction(null);
        return;
      }

      const ignore = ["Control", "Shift", "Alt", "Meta"];
      if (ignore.includes(e.key)) return;

      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.metaKey) parts.push("Meta");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");

      let key = e.key;
      if (key === " ") key = "Space";
      if (key.length === 1) key = key.toLowerCase();
      parts.push(key);

      const combo = parts.join("+");
      updateKeybinding(recordingAction, combo);
      setRecordingAction(null);
    },
    [recordingAction, updateKeybinding]
  );

  useEffect(() => {
    if (recordingAction) {
      window.addEventListener("keydown", handleKeyDown, true);
      return () => window.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [recordingAction, handleKeyDown]);

  const getDisplayKeys = (actionId: string, defaultKeys: string): string => {
    return keybindings[actionId] || defaultKeys;
  };

  const formatKeys = (keys: string): string => {
    return keys
      .split("+")
      .map((part) => {
        switch (part) {
          case "Control":
            return "Ctrl";
          case "Meta":
            return "Cmd";
          case "Shift":
            return "Shift";
          case "Alt":
            return "Alt";
          default:
            return part.length === 1 ? part.toUpperCase() : part;
        }
      })
      .join(" + ");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Keyboard Shortcuts</h3>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-tertiary">
                <th className="text-left text-xs font-medium text-text-secondary px-4 py-2">
                  Action
                </th>
                <th className="text-left text-xs font-medium text-text-secondary px-4 py-2">
                  Shortcut
                </th>
                <th className="text-right text-xs font-medium text-text-secondary px-4 py-2 w-16">
                  Edit
                </th>
              </tr>
            </thead>
            <tbody>
              {defaults.map((binding) => (
                <tr key={binding.id} className="border-t border-border">
                  <td className="px-4 py-2.5 text-sm text-text-primary">{binding.label}</td>
                  <td className="px-4 py-2.5">
                    {recordingAction === binding.id ? (
                      <span className="inline-block px-3 py-1 text-sm text-accent border border-accent rounded-md animate-pulse">
                        Press keys...
                      </span>
                    ) : (
                      <kbd className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono text-text-secondary bg-bg-tertiary border border-border rounded">
                        {formatKeys(getDisplayKeys(binding.id, binding.keys))}
                      </kbd>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() =>
                        setRecordingAction(recordingAction === binding.id ? null : binding.id)
                      }
                      className="p-1 text-text-muted hover:text-text-primary transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
