import { useSettingsStore } from "../../stores/settings";
import { getDefaultShells } from "../../lib/shell-detect";
import { enable as enableAutostart, disable as disableAutostart } from "@tauri-apps/plugin-autostart";
import Select from "../ui/Select";
import type { StartupBehavior } from "../../types/settings";

export default function GeneralPanel() {
  const settings = useSettingsStore((s) => s.settings.general);
  const update = useSettingsStore((s) => s.update);
  const shells = getDefaultShells();

  const startupOptions: { value: StartupBehavior; label: string }[] = [
    { value: "new-tab", label: "Open new tab" },
    { value: "restore", label: "Restore previous session" },
    { value: "workspace", label: "Open workspace" },
  ];

  const shellOptions = [
    { value: "", label: "System Default" },
    ...shells.map((shell) => ({ value: shell.path, label: shell.label })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Shell</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Default Shell</label>
            <Select
              value={settings.defaultShell}
              onChange={(v) => update("general", { defaultShell: v })}
              options={shellOptions}
              className="w-48"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Startup</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Startup Behavior</label>
            <div className="flex gap-2">
              {startupOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update("general", { startupBehavior: opt.value })}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    settings.startupBehavior === opt.value
                      ? "bg-accent text-white border-accent"
                      : "bg-bg-tertiary text-text-secondary border-border hover:border-accent"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Behavior</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Check for updates</label>
            <button
              onClick={() => update("general", { checkForUpdates: !settings.checkForUpdates })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.checkForUpdates ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.checkForUpdates ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Confirm on close</label>
            <button
              onClick={() => update("general", { confirmOnClose: !settings.confirmOnClose })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.confirmOnClose ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.confirmOnClose ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="flex justify-between items-center gap-4">
            <div>
              <label className="text-sm text-text-secondary">Close to tray</label>
              <p className="text-xs text-text-muted mt-0.5">Minimize to system tray instead of quitting</p>
            </div>
            <button
              onClick={() => update("general", { closeToTray: !settings.closeToTray })}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                settings.closeToTray ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.closeToTray ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="flex justify-between items-center gap-4">
            <div>
              <label className="text-sm text-text-secondary">Launch on startup</label>
              <p className="text-xs text-text-muted mt-0.5">Start Nexterm when you log in</p>
            </div>
            <button
              onClick={async () => {
                const next = !settings.launchOnStartup;
                try {
                  if (next) await enableAutostart();
                  else await disableAutostart();
                  update("general", { launchOnStartup: next });
                } catch {
                  
                }
              }}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
                settings.launchOnStartup ? "bg-accent" : "bg-bg-tertiary"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.launchOnStartup ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
