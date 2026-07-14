import { useSettingsStore } from "../../stores/settings";
import { useSshStore } from "../../stores/ssh";
import { useWorkspaceStore } from "../../stores/workspace";
import { getDefaultShells } from "../../lib/shell-detect";
import {
  enable as enableAutostart,
  disable as disableAutostart,
} from "@tauri-apps/plugin-autostart";
import Select from "../ui/Select";
import { Button } from "../ui/Button";
import { SettingsSection, SettingRow, Toggle, SegmentedControl, SliderField } from "./ui";
import type { StartupBehavior, AppSettings } from "../../types/settings";

export default function GeneralPanel() {
  const settings = useSettingsStore((s) => s.settings.general);
  const update = useSettingsStore((s) => s.update);
  const workspaces = useWorkspaceStore((s) => s.workspaces).filter(
    (w) => w.id !== "__session__"
  );
  const shells = getDefaultShells();

  const shellOptions = [
    { value: "", label: "System Default" },
    ...shells.map((shell) => ({ value: shell.path, label: shell.label })),
  ];

  const startupOptions: { value: StartupBehavior; label: string }[] = [
    { value: "new-tab", label: "New tab" },
    { value: "restore", label: "Restore" },
    { value: "workspace", label: "Workspace" },
  ];

  const handleAutostart = async (next: boolean) => {
    try {
      if (next) await enableAutostart();
      else await disableAutostart();
      update("general", { launchOnStartup: next });
    } catch {
      /* autostart unavailable, leave the toggle unchanged */
    }
  };

  const exportSettings = () => {
    const data = {
      version: 1,
      settings: useSettingsStore.getState().settings,
      connections: useSshStore.getState().connections,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexterm-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.version && data.settings) {
          const store = useSettingsStore.getState();
          for (const [section, values] of Object.entries(data.settings) as [
            keyof AppSettings,
            unknown,
          ][]) {
            if (typeof values === "object" && values && !Array.isArray(values)) {
              await store.update(section, values as never);
            }
          }
        }
      } catch {
        /* invalid file */
      }
    };
    input.click();
  };

  return (
    <div className="space-y-8">
      <SettingsSection title="Shell">
        <SettingRow
          label="Default shell"
          description="For new local terminals"
        >
          <Select
            value={settings.defaultShell}
            onChange={(v) => update("general", { defaultShell: v })}
            options={shellOptions}
            className="w-52"
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Startup">
        <SettingRow label="On launch">
          <SegmentedControl
            value={settings.startupBehavior}
            onChange={(v) => update("general", { startupBehavior: v })}
            options={startupOptions}
          />
        </SettingRow>
        {settings.startupBehavior === "workspace" && (
          <SettingRow
            label="Workspace"
            description="Restored on launch"
          >
            <Select
              value={settings.startupWorkspaceId ?? ""}
              onChange={(v) =>
                update("general", { startupWorkspaceId: v || null })
              }
              options={
                workspaces.length
                  ? workspaces.map((w) => ({ value: w.id, label: w.name }))
                  : [{ value: "", label: "No saved workspaces" }]
              }
              className="w-52"
            />
          </SettingRow>
        )}
      </SettingsSection>

      <SettingsSection title="Behavior">
        <SettingRow label="Check for updates">
          <Toggle
            checked={settings.checkForUpdates}
            onChange={(v) => update("general", { checkForUpdates: v })}
          />
        </SettingRow>
        <SettingRow label="Confirm on close" description="Ask before quitting with open sessions">
          <Toggle
            checked={settings.confirmOnClose}
            onChange={(v) => update("general", { confirmOnClose: v })}
          />
        </SettingRow>
        <SettingRow
          label="Close to tray"
          description="Minimize to tray instead of quitting"
        >
          <Toggle
            checked={settings.closeToTray}
            onChange={(v) => update("general", { closeToTray: v })}
          />
        </SettingRow>
        <SettingRow label="Launch on startup">
          <Toggle checked={settings.launchOnStartup} onChange={handleAutostart} />
        </SettingRow>
      </SettingsSection>

      <SettingsSection title="Notifications">
        <SettingRow label="Notify on long commands">
          <Toggle
            checked={settings.notifyOnLongCommands}
            onChange={(v) => update("general", { notifyOnLongCommands: v })}
          />
        </SettingRow>
        <SettingRow label="Threshold" description="Minimum command duration">
          <SliderField
            value={settings.longCommandThresholdSeconds}
            min={5}
            max={120}
            step={5}
            disabled={!settings.notifyOnLongCommands}
            format={(v) => `${v}s`}
            onChange={(v) =>
              update("general", { longCommandThresholdSeconds: v })
            }
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="Data"
        description="Back up or restore settings and connections"
        card={false}
      >
        <div className="flex gap-2">
          <Button variant="ghost" className="border border-border" onClick={exportSettings}>
            Export settings…
          </Button>
          <Button variant="ghost" className="border border-border" onClick={importSettings}>
            Import settings…
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
