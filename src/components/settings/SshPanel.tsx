import { useSettingsStore } from "../../stores/settings";

export default function SshPanel() {
  const settings = useSettingsStore((s) => s.settings.ssh);
  const update = useSettingsStore((s) => s.update);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Connection Defaults</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Default Port</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={settings.defaultPort}
              onChange={(e) => update("ssh", { defaultPort: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Default Username</label>
            <input
              type="text"
              value={settings.defaultUsername}
              onChange={(e) => update("ssh", { defaultUsername: e.target.value })}
              placeholder="root"
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-44"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text-primary mb-3">Timeouts</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Keepalive Interval (seconds)</label>
            <input
              type="number"
              min={0}
              max={300}
              value={settings.keepaliveInterval}
              onChange={(e) => update("ssh", { keepaliveInterval: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
          <div className="flex justify-between items-center gap-4">
            <label className="text-sm text-text-secondary">Connection Timeout (seconds)</label>
            <input
              type="number"
              min={1}
              max={120}
              value={settings.connectionTimeout}
              onChange={(e) => update("ssh", { connectionTimeout: Number(e.target.value) })}
              className="bg-bg-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none w-28"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
