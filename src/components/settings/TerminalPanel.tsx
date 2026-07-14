import { useSettingsStore } from "../../stores/settings";
import Select from "../ui/Select";
import { SettingsSection, SettingRow, Toggle, SegmentedControl, NumberField, TextField } from "./ui";
import type { BellStyle } from "../../types/settings";

export default function TerminalPanel() {
  const settings = useSettingsStore((s) => s.settings.terminal);
  const update = useSettingsStore((s) => s.update);

  return (
    <div className="space-y-8">
      <SettingsSection title="Scrollback">
        <SettingRow label="Scrollback lines">
          <NumberField
            value={settings.scrollbackLines}
            min={1000}
            max={100000}
            step={1000}
            unit="lines"
            className="w-32"
            onChange={(v) => update("terminal", { scrollbackLines: v })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Behavior">
        <SettingRow label="Copy on select">
          <Toggle
            checked={settings.copyOnSelect}
            onChange={(v) => update("terminal", { copyOnSelect: v })}
          />
        </SettingRow>
        <SettingRow label="Right-click behavior">
          <SegmentedControl
            value={settings.rightClickBehavior}
            onChange={(v) => update("terminal", { rightClickBehavior: v })}
            options={[
              { value: "context-menu", label: "Menu" },
              { value: "paste", label: "Paste" },
            ]}
          />
        </SettingRow>
        <SettingRow
          label="Ligatures"
          description="Render font ligatures (e.g. Fira Code)"
        >
          <Toggle
            checked={settings.ligatures}
            onChange={(v) => update("terminal", { ligatures: v })}
          />
        </SettingRow>
        <SettingRow
          label="Bracketed paste"
          description="Let apps detect pasted text"
        >
          <Toggle
            checked={settings.bracketedPaste}
            onChange={(v) => update("terminal", { bracketedPaste: v })}
          />
        </SettingRow>
        <SettingRow label="Scroll to bottom on input">
          <Toggle
            checked={settings.scrollToBottomOnInput}
            onChange={(v) => update("terminal", { scrollToBottomOnInput: v })}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Session">
        <SettingRow
          label="Buffer persistence"
          description="Restore scrollback across restarts"
        >
          <Toggle
            checked={settings.bufferPersistence}
            onChange={(v) => update("terminal", { bufferPersistence: v })}
          />
        </SettingRow>
        <SettingRow label="Bell style">
          <Select
            value={settings.bellStyle}
            onChange={(v) => update("terminal", { bellStyle: v as BellStyle })}
            options={[
              { value: "none", label: "None" },
              { value: "visual", label: "Visual" },
              { value: "audio", label: "Audio" },
            ]}
            className="w-32"
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Advanced">
        <SettingRow
          label="Word separators"
          description="Break word selection on double-click"
        >
          <TextField
            value={settings.wordSeparators}
            onChange={(v) => update("terminal", { wordSeparators: v })}
            mono
            className="w-56"
          />
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
