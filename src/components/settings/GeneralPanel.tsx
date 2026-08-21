import { Download, Upload } from "lucide-react";
import { enable as enableAutostart, disable as disableAutostart } from "@tauri-apps/plugin-autostart";
import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { useWorkspaceStore } from "../../stores/workspace";
import { getDefaultShells } from "../../lib/shell-detect";
import { downloadTextFile } from "../../lib/download-file";
import { pickFile } from "../../lib/pick-file";
import { Button, Section, SegmentedControl, Select, Slider, Switch, ICON_SM } from "../../ui";
import { SettingRow, SettingsCard } from "./SettingRow";
import type { AppSettings, StartupBehavior } from "../../types/settings";

/** Kit Select values cannot be "" (Radix reserves it), so "system default" and "no workspace" use sentinels. */
const SYSTEM_SHELL = "__system__";
const NO_WORKSPACE = "__none__";

const STARTUP_OPTIONS: { value: StartupBehavior; label: string }[] = [
  { value: "new-tab", label: "New tab" },
  { value: "restore", label: "Restore" },
  { value: "workspace", label: "Workspace" },
];

/** Applies a settings file written by "Export settings". Unknown or malformed input changes nothing. */
export async function applySettingsFile(text: string): Promise<boolean> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return false;
  }
  if (!data || typeof data !== "object") return false;
  const { version, settings } = data as { version?: unknown; settings?: unknown };
  if (!version || !settings || typeof settings !== "object") return false;
  const store = useSettingsStore.getState();
  for (const [section, values] of Object.entries(settings) as [keyof AppSettings, unknown][]) {
    if (typeof values === "object" && values && !Array.isArray(values)) {
      await store.update(section, values as never);
    }
  }
  return true;
}

export default function GeneralPanel() {
  const settings = useSettingsStore((s) => s.settings.general);
  const update = useSettingsStore((s) => s.update);
  const workspaces = useWorkspaceStore((s) => s.workspaces).filter((w) => w.id !== "__session__");
  const shells = getDefaultShells();

  const shellOptions = [
    { value: SYSTEM_SHELL, label: "System default" },
    ...shells.map((shell) => ({ value: shell.path, label: shell.label })),
  ];
  const workspaceOptions = workspaces.length
    ? workspaces.map((w) => ({ value: w.id, label: w.name }))
    : [{ value: NO_WORKSPACE, label: "No saved workspaces", disabled: true }];

  const handleAutostart = async (next: boolean) => {
    try {
      if (next) await enableAutostart();
      else await disableAutostart();
      await update("general", { launchOnStartup: next });
    } catch {
      /* autostart unavailable: leave the switch unchanged */
    }
  };

  const exportSettings = () => {
    const data = {
      version: 1,
      settings: useSettingsStore.getState().settings,
      connections: useSshStore.getState().connections,
    };
    downloadTextFile(
      `nexterm-settings-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      "application/json"
    );
  };

  const importSettings = async () => {
    const file = await pickFile(".json");
    if (file) await applySettingsFile(await file.text());
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Shell">
        <SettingsCard>
          <SettingRow label="Default shell" description="For new local terminals">
            {(control) => (
              <Select
                {...control}
                value={settings.defaultShell || SYSTEM_SHELL}
                onValueChange={(v) => update("general", { defaultShell: v === SYSTEM_SHELL ? "" : v })}
                options={shellOptions}
                className="w-52"
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Startup">
        <SettingsCard>
          <SettingRow label="On launch">
            <SegmentedControl
              aria-label="On launch"
              value={settings.startupBehavior}
              onValueChange={(v) => update("general", { startupBehavior: v })}
              options={STARTUP_OPTIONS}
            />
          </SettingRow>
          {settings.startupBehavior === "workspace" && (
            <SettingRow label="Workspace" description="Restored on launch">
              {(control) => (
                <Select
                  {...control}
                  value={settings.startupWorkspaceId ?? (workspaces.length ? undefined : NO_WORKSPACE)}
                  placeholder="Choose a workspace"
                  onValueChange={(v) => update("general", { startupWorkspaceId: v === NO_WORKSPACE ? null : v })}
                  options={workspaceOptions}
                  className="w-52"
                />
              )}
            </SettingRow>
          )}
        </SettingsCard>
      </Section>

      <Section title="Behavior">
        <SettingsCard>
          <SettingRow label="Check for updates">
            {(control) => (
              <Switch
                {...control}
                checked={settings.checkForUpdates}
                onCheckedChange={(v) => update("general", { checkForUpdates: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Confirm on close" description="Ask before quitting with open sessions">
            {(control) => (
              <Switch
                {...control}
                checked={settings.confirmOnClose}
                onCheckedChange={(v) => update("general", { confirmOnClose: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Close to tray" description="Minimize to tray instead of quitting">
            {(control) => (
              <Switch
                {...control}
                checked={settings.closeToTray}
                onCheckedChange={(v) => update("general", { closeToTray: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Launch on startup">
            {(control) => (
              <Switch {...control} checked={settings.launchOnStartup} onCheckedChange={handleAutostart} />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Notifications">
        <SettingsCard>
          <SettingRow label="Notify on long commands">
            {(control) => (
              <Switch
                {...control}
                checked={settings.notifyOnLongCommands}
                onCheckedChange={(v) => update("general", { notifyOnLongCommands: v })}
              />
            )}
          </SettingRow>
          <SettingRow label="Threshold" description="Minimum command duration">
            {(control) => (
              <Slider
                aria-label="Threshold"
                aria-describedby={control["aria-describedby"]}
                value={settings.longCommandThresholdSeconds}
                min={5}
                max={120}
                step={5}
                disabled={!settings.notifyOnLongCommands}
                format={(v) => `${v}s`}
                onValueChange={(v) => update("general", { longCommandThresholdSeconds: v })}
              />
            )}
          </SettingRow>
        </SettingsCard>
      </Section>

      <Section title="Data" description="Back up or restore settings and connections">
        <div className="flex gap-2">
          <Button leadingIcon={<Download {...ICON_SM} />} onClick={exportSettings}>
            Export settings…
          </Button>
          <Button leadingIcon={<Upload {...ICON_SM} />} onClick={() => void importSettings()}>
            Import settings…
          </Button>
        </div>
      </Section>
    </div>
  );
}
