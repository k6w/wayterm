import { useSettingsStore } from "../../stores/settings";
import Select from "../ui/Select";
import type { BellStyle } from "../../types/settings";

export default function TerminalPanel() {
  const settings = useSettingsStore((s) => s.settings.terminal);
  const update = useSettingsStore((s) => s.update);

  const bellOptions = [
    { value: "none" as BellStyle, label: "None" },
    { value: "visual" as BellStyle, label: "Visual" },
    { value: "audio" as BellStyle, label: "Audio" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Scrollback</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Scrollback Lines</label>
            <input
              type="number"
              min={1000}
              max={100000}
              step={1000}
              value={settings.scrollbackLines}
              onChange={(e) => update("terminal", { scrollbackLines: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Behavior</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Copy on select</label>
            <button
              onClick={() => update("terminal", { copyOnSelect: !settings.copyOnSelect })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.copyOnSelect ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.copyOnSelect ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Ligatures</label>
            <button
              onClick={() => update("terminal", { ligatures: !settings.ligatures })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.ligatures ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.ligatures ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Bracketed paste</label>
            <button
              onClick={() => update("terminal", { bracketedPaste: !settings.bracketedPaste })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.bracketedPaste ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.bracketedPaste ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Scroll to bottom on input</label>
            <button
              onClick={() =>
                update("terminal", { scrollToBottomOnInput: !settings.scrollToBottomOnInput })
              }
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.scrollToBottomOnInput ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.scrollToBottomOnInput ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">History</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <div>
              <label className="text-sm text-text-secondary">Buffer Persistence</label>
              <p className="text-xs text-text-muted mt-0.5">Save and restore terminal scrollback across sessions</p>
            </div>
            <button
              onClick={() => update("terminal", { bufferPersistence: !settings.bufferPersistence })}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                settings.bufferPersistence ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.bufferPersistence ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Bell</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Bell Style</label>
            <Select
              value={settings.bellStyle}
              onChange={(v) => update("terminal", { bellStyle: v as BellStyle })}
              options={bellOptions}
              className="w-32"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Advanced</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Word Separators</label>
            <input
              type="text"
              value={settings.wordSeparators}
              onChange={(e) => update("terminal", { wordSeparators: e.target.value })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-56"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
