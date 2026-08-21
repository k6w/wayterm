import { useSettingsStore } from "../../stores/settings";
import { Input, Section, SegmentedControl, Select, Switch } from "../../ui";
import { NumberInput, SettingRow, SettingsCard } from "./SettingRow";
import type { BellStyle, RightClickBehavior } from "../../types/settings";

const RIGHT_CLICK_OPTIONS: { value: RightClickBehavior; label: string }[] = [
  { value: "context-menu", label: "Menu" },
  { value: "paste", label: "Paste" },
];

const BELL_OPTIONS: { value: BellStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "visual", label: "Visual" },
  { value: "audio", label: "Audio" },
];

export default function TerminalPanel() {
  const settings = useSettingsStore((s) => s.settings.terminal);
  const update = useSettingsStore((s) => s.update);

  return (
    <div className="flex flex-col gap-6">
      <Section title="Scrollback">
        <SettingsCard>
          <SettingRow label="Scrollback lines">
            {(control) => (
              <NumberInput
                {...control}
                value={settings.scrollbackLines}
                min={1000}
                max={100000}
                step={1000}
                unit="lines"
                className="w-28"
                onValueChange={(v) => update("terminal", { scrollbackLines: v })}
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Behavior">
        <SettingsCard>
          <SettingRow label="Copy on select">
            {(control) => (
              <Switch
                {...control}
                checked={settings.copyOnSelect}
                onCheckedChange={(v) => update("terminal", { copyOnSelect: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Right-click behavior">
            <SegmentedControl
              aria-label="Right-click behavior"
              value={settings.rightClickBehavior}
              onValueChange={(v) => update("terminal", { rightClickBehavior: v })}
              options={RIGHT_CLICK_OPTIONS}
            />
          </SettingRow>
          <SettingRow label="Ligatures" description="Render font ligatures (e.g. Fira Code)">
            {(control) => (
              <Switch
                {...control}
                checked={settings.ligatures}
                onCheckedChange={(v) => update("terminal", { ligatures: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Bracketed paste" description="Let apps detect pasted text">
            {(control) => (
              <Switch
                {...control}
                checked={settings.bracketedPaste}
                onCheckedChange={(v) => update("terminal", { bracketedPaste: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Scroll to bottom on input">
            {(control) => (
              <Switch
                {...control}
                checked={settings.scrollToBottomOnInput}
                onCheckedChange={(v) => update("terminal", { scrollToBottomOnInput: v })}
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Session">
        <SettingsCard>
          <SettingRow label="Buffer persistence" description="Restore scrollback across restarts">
            {(control) => (
              <Switch
                {...control}
                checked={settings.bufferPersistence}
                onCheckedChange={(v) => update("terminal", { bufferPersistence: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Bell style">
            {(control) => (
              <Select
                {...control}
                value={settings.bellStyle}
                onValueChange={(v) => update("terminal", { bellStyle: v as BellStyle })}
                options={BELL_OPTIONS}
                className="w-32"
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Advanced">
        <SettingsCard>
          <SettingRow label="Word separators" description="Break word selection on double-click">
            {(control) => (
              <Input
                {...control}
                value={settings.wordSeparators}
                onChange={(e) => update("terminal", { wordSeparators: e.target.value })}
                className="w-56 font-mono"
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>
    </div>
  );
}
