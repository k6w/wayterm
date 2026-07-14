import { useState, useEffect, useCallback } from "react";
import { Pencil } from "lucide-react";
import { getDefaultKeybindings } from "../../lib/keybindings";
import { useSettingsStore } from "../../stores/settings";
import { IconButton } from "../ui/Button";
import { SettingsSection } from "./ui";

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
    <div className="space-y-8">
      <SettingsSection
        title="Keyboard shortcuts"
        description="Click the pencil to record; Escape cancels"
        card={false}
      >
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="bg-overlay/[0.03]">
                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">
                  Action
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-text-secondary">
                  Shortcut
                </th>
                <th className="w-16 px-4 py-2 text-right text-xs font-medium text-text-secondary">
                  Edit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {defaults.map((binding) => (
                <tr key={binding.id}>
                  <td className="px-4 py-2.5 text-sm text-text-primary">{binding.label}</td>
                  <td className="px-4 py-2.5">
                    {recordingAction === binding.id ? (
                      <span className="inline-block animate-pulse rounded-md border border-accent px-3 py-1 text-sm text-accent">
                        Press keys...
                      </span>
                    ) : (
                      <kbd className="inline-flex items-center gap-1 rounded border border-border bg-overlay/[0.03] px-2 py-0.5 font-mono text-xs text-text-secondary">
                        {formatKeys(getDisplayKeys(binding.id, binding.keys))}
                      </kbd>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <IconButton
                      title="Edit"
                      active={recordingAction === binding.id}
                      onClick={() =>
                        setRecordingAction(recordingAction === binding.id ? null : binding.id)
                      }
                    >
                      <Pencil size={14} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>
    </div>
  );
}
