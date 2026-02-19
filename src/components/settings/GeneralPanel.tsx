import { useSettingsStore } from "../../stores/settings";
import { getDefaultShells } from "../../lib/shell-detect";
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Shell</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Default Shell</label>
            <select
              value={settings.defaultShell}
              onChange={(e) => update("general", { defaultShell: e.target.value })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none"
            >
              <option value="">System Default</option>
              {shells.map((shell) => (
                <option key={shell.path} value={shell.path}>
                  {shell.label}
                </option>
              ))}
            </select>
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
        </div>
      </div>
    </div>
  );
}
